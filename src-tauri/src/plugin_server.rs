use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU16, Ordering};
use tokio::sync::{mpsc, RwLock};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use log::{info, error, debug, warn};
use socketioxide::{SocketIo, extract::{SocketRef, Data, AckSender}};
use serde_json::Value;
use futures_util::{pin_mut, StreamExt};

// Constants for port range
const DEFAULT_PORT: u16 = 3001;
const PORT_RANGE_START: u16 = 3001;
const PORT_RANGE_END: u16 = 3099;

// Global atomic to store the actual port being used
static ACTIVE_PORT: AtomicU16 = AtomicU16::new(0);

/// Get the currently active plugin server port
pub fn get_active_port() -> u16 {
    ACTIVE_PORT.load(Ordering::SeqCst)
}

/// Set the active plugin server port
fn set_active_port(port: u16) {
    ACTIVE_PORT.store(port, Ordering::SeqCst);
}

/// Find an available port in the given range
async fn find_available_port(preferred: u16) -> Result<u16, String> {
    // First try the preferred port
    if let Ok(listener) = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", preferred)).await {
        drop(listener);
        return Ok(preferred);
    }

    warn!("Preferred port {} is busy, searching for available port...", preferred);

    // Try ports in range
    for port in PORT_RANGE_START..=PORT_RANGE_END {
        if port == preferred {
            continue; // Already tried
        }
        if let Ok(listener) = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
            drop(listener);
            info!("Found available port: {}", port);
            return Ok(port);
        }
    }

    Err(format!("No available port found in range {}-{}", PORT_RANGE_START, PORT_RANGE_END))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SliderState {
    pub id: String,
    pub value: f64,
}
// Define SliderStates struct if not imported from elsewhere
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SliderStates {
    pub states: Vec<SliderState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub connected_at: String,
    #[serde(rename = "sdkVersion")]
    pub sdk_version: Option<String>,
    #[serde(rename = "hostApiVersion")]
    pub host_api_version: Option<String>,
    pub capabilities: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiRequest {
    pub method: String,
    pub params: Option<serde_json::Value>,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse {
    pub request_id: String,
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

pub struct PluginConnection {
    pub id: String,
    pub info: PluginInfo,
    pub socket_id: String,
}

pub struct PluginServer {
    pub connections: Arc<RwLock<HashMap<String, PluginConnection>>>,
    pub app_handle: AppHandle,
    pub port: u16,
    pub is_running: Arc<RwLock<bool>>,
    pub io: Option<SocketIo>,
    pub pending_requests: Arc<RwLock<HashMap<String, mpsc::UnboundedSender<ApiResponse>>>>,
}

impl PluginServer {
    pub fn new(app_handle: AppHandle, port: u16) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            port,
            is_running: Arc::new(RwLock::new(false)),
            io: None,
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut is_running = self.is_running.write().await;
        if *is_running {
            return Ok(());
        }

        // Find an available port
        let actual_port = find_available_port(self.port).await
            .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::AddrInUse, e)) as Box<dyn std::error::Error + Send + Sync>)?;

        // Update port if different from requested
        if actual_port != self.port {
            info!("Using port {} instead of requested port {}", actual_port, self.port);
            self.port = actual_port;
        }

        // Store the active port globally
        set_active_port(self.port);

        let connections = Arc::clone(&self.connections);
        let app_handle = self.app_handle.clone();
        let pending_requests = Arc::clone(&self.pending_requests);

        // Create socket.io server
        let (layer, io) = SocketIo::new_layer();
        self.io = Some(io.clone());

        println!("plugin server started on port {}", self.port);

        // Handle plugin connections
        io.ns("/", {
            println!("plugin server ns");
            let connections = Arc::clone(&connections);
            let app_handle = app_handle.clone();
            let pending_requests = Arc::clone(&pending_requests);

            move |socket: SocketRef| {
                let connections = Arc::clone(&connections);
                let app_handle = app_handle.clone();
                let pending_requests = Arc::clone(&pending_requests);

                // Handle plugin registration
                socket.on("register", {
                    let connections = Arc::clone(&connections);
                    let app_handle = app_handle.clone();
                    let socket_id = socket.id.to_string();

                    move |socket_ref: SocketRef, Data::<PluginInfo>(plugin_info), ack: AckSender| {
                        let connections = Arc::clone(&connections);
                        let app_handle = app_handle.clone();
                        let socket_id = socket_id.clone();
                        // Join a room named by plugin_id so io.to(plugin_id) works
                        let _ = socket_ref.join(plugin_info.id.clone());

                        tokio::spawn(async move {
                            info!("Plugin registered: {} ({})", plugin_info.name, plugin_info.id);

                            let connection = PluginConnection {
                                id: plugin_info.id.clone(),
                                info: plugin_info.clone(),
                                socket_id: socket_id.clone(),
                            };

                            connections.write().await.insert(plugin_info.id.clone(), connection);

                            // Emit to frontend
                            let _ = app_handle.emit("plugin/lifecycle", serde_json::json!({
                                "id": &plugin_info.id,
                                "name": &plugin_info.name,
                                "version": &plugin_info.version,
                                "connected_at": &plugin_info.connected_at,
                                "sdkVersion": &plugin_info.sdk_version,
                                "hostApiVersion": &plugin_info.host_api_version,
                                "capabilities": &plugin_info.capabilities,
                                "status": "connected",
                                "error": null,
                                "exitCode": null,
                                "signal": null,
                                "expected": false,
                            }));
                            let _ = app_handle.emit("plugin/connected", &plugin_info);

                            // Send acknowledgment
                            let ack_payload = serde_json::json!({
                                "status": "success",
                                "message": "Plugin registered successfully"
                            });
                            // Note: ack is moved into this task; keep signature as-is so we can send it here
                            let _ = ack.send(&ack_payload);
                        });
                    }
                });

                // Handle API requests from plugins (waitforack pattern)
                socket.on("api_request", {
                    let app_handle = app_handle.clone();
                    let pending_requests = Arc::clone(&pending_requests);
                    let connections = Arc::clone(&connections);

                    move |_socket: SocketRef, Data::<ApiRequest>(api_request), ack: AckSender| {
                        let app_handle = app_handle.clone();
                        let pending_requests = Arc::clone(&pending_requests);
                        let connections = Arc::clone(&connections);
                        let socket_id = _socket.id.to_string();

                        tokio::spawn(async move {
                            debug!("Received API request: {} from plugin", api_request.method);

                            // Create response channel
                            let (tx, mut rx) = mpsc::unbounded_channel();
                            pending_requests.write().await.insert(api_request.request_id.clone(), tx);

                            // Resolve plugin_id by socket_id
                            let plugin_id = {
                                let connections_lock = connections.read().await;
                                connections_lock.iter()
                                    .find(|(_, conn)| conn.socket_id == socket_id)
                                    .map(|(id, _)| id.clone())
                            };

                            // Forward to frontend via tauri invoke
                            let frontend_message = serde_json::json!({
                                "request_id": api_request.request_id,
                                "method": api_request.method,
                                "params": api_request.params,
                                "plugin_id": plugin_id
                            });

                            if let Err(e) = app_handle.emit("plugin/api_request", &frontend_message) {
                                error!("Failed to forward API request to frontend: {}", e);
                                let error_response = ApiResponse {
                                    request_id: api_request.request_id.clone(),
                                    success: false,
                                    data: None,
                                    error: Some("Failed to forward request to frontend".to_string()),
                                };
                                let _ = ack.send(&error_response);
                                return;
                            }

                            // Wait for response from frontend (with timeout)
                            let response = tokio::time::timeout(
                                std::time::Duration::from_secs(30),
                                rx.recv()
                            ).await;

                            let api_response = match response {
                                Ok(Some(resp)) => resp,
                                Ok(None) => ApiResponse {
                                    request_id: api_request.request_id.clone(),
                                    success: false,
                                    data: None,
                                    error: Some("Response channel closed".to_string()),
                                },
                                Err(_) => ApiResponse {
                                    request_id: api_request.request_id.clone(),
                                    success: false,
                                    data: None,
                                    error: Some("Request timeout".to_string()),
                                },
                            };

                            // Clean up pending request
                            pending_requests.write().await.remove(&api_request.request_id);

                            // Send response back to plugin
                            let _ = ack.send(&api_response);
                        });
                    }
                });

                // Forward generic plugin responses to the frontend
                socket.on("plugin.response", {
                    let connections = Arc::clone(&connections);
                    let app_handle = app_handle.clone();
                    move |socket: SocketRef, Data::<Value>(response), _ack: AckSender| {
                        let connections = Arc::clone(&connections);
                        let app_handle = app_handle.clone();
                        let socket_id = socket.id.to_string();
                        tokio::spawn(async move {
                            // Find plugin_id by socket_id
                            let plugin_id = {
                                let connections_lock = connections.read().await;
                                connections_lock.iter()
                                    .find(|(_, conn)| conn.socket_id == socket_id)
                                    .map(|(id, _)| id.clone())
                            };
                            // Forward to frontend for visibility/back-compat
                            let payload = serde_json::json!({
                                "plugin_id": plugin_id,
                                "response": response
                            });
                            let _ = app_handle.emit("plugin/response", &payload);
                        });
                    }
                });

                // Handle disconnect
                socket.on_disconnect({
                    let connections = Arc::clone(&connections);
                    let app_handle = app_handle.clone();

                    move |socket: SocketRef| {
                        let connections = Arc::clone(&connections);
                        let app_handle = app_handle.clone();
                        let socket_id = socket.id.to_string();

                        tokio::spawn(async move {
                            // Find and remove the plugin connection
                            let mut connections_lock = connections.write().await;
                            let plugin_id = connections_lock.iter()
                                .find(|(_, conn)| conn.socket_id == socket_id)
                                .map(|(id, _)| id.clone());

                            if let Some(plugin_id) = plugin_id {
                                connections_lock.remove(&plugin_id);
                                info!("Plugin disconnected: {}", plugin_id);

                                // Emit to frontend with consistent payload shape
                                let _ = app_handle.emit("plugin/disconnected", serde_json::json!({
                                    "id": plugin_id
                                }));
                            }
                        });
                    }
                });
            }
        });

        // Start the HTTP server with socket.io
        let app = axum::Router::new().layer(layer);

        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", self.port)).await?;
        *is_running = true;
        drop(is_running);

        info!("Plugin Socket.IO server started on port {}", self.port);

        // Emit to frontend that server started
        let _ = self.app_handle.emit("plugin_server/started", serde_json::json!({ "port": self.port }));

        let is_running = Arc::clone(&self.is_running);
        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                error!("Plugin server error: {}", e);
            }
            let mut running = is_running.write().await;
            *running = false;
        });

        Ok(())
    }

    pub async fn stop(&self) {
        let mut is_running = self.is_running.write().await;
        *is_running = false;

        // Clear connections
        let mut connections = self.connections.write().await;
        connections.clear();

        // Clear pending requests
        let mut pending_requests = self.pending_requests.write().await;
        pending_requests.clear();
        // no additional pending maps to clear

        info!("Plugin Socket.IO server stopped");
        let _ = self.app_handle.emit("plugin_server/stopped", serde_json::json!({}));
    }

    pub async fn send_api_response(&self, response: ApiResponse) -> Result<(), String> {
        let pending_requests = self.pending_requests.read().await;
        if let Some(sender) = pending_requests.get(&response.request_id) {
            sender.send(response).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err(format!("No pending request found for id: {}", response.request_id))
        }
    }

    pub async fn get_connected_plugins(&self) -> Vec<PluginInfo> {
        let connections = self.connections.read().await;
        connections.values().map(|conn| conn.info.clone()).collect()
    }

    pub async fn send_to_plugin(&self, plugin_id: &str, event: &str, data: Value) -> Result<(), String> {
        let connections = self.connections.read().await;
        if let Some(_connection) = connections.get(plugin_id) {
            if let Some(io) = &self.io {
                let event_string = event.to_string();
                println!("Sending event to plugin: {} {} {:?}", plugin_id, event_string, data);
                io.to(plugin_id.to_string())
                    .emit(event_string, &data)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(())
            } else {
                Err("Socket.IO server not initialized".to_string())
            }
        } else {
            Err(format!("Plugin {} not connected", plugin_id))
        }
    }

    

    pub async fn send_to_plugin_with_ack(&self, plugin_id: &str, event: &str, data: Value) -> Result<ApiResponse, String> {
        // Ensure the plugin is connected and the server is initialized
        let connections = self.connections.read().await;
        if !connections.contains_key(plugin_id) {
            return Err(format!("Plugin {} not connected", plugin_id));
        }
        let io = self.io.as_ref().ok_or_else(|| "Socket.IO server not initialized".to_string())?;

        // Emit and await the acknowledgment using Socket.IO's default timeout
        let event_string = event.to_string();
        let payload = data.clone();
        match io
            .to(plugin_id.to_string())
            .emit_with_ack(event_string, &payload)
            .await
        {
            Ok(ack_stream) => {
                pin_mut!(ack_stream);
                match ack_stream.next().await {
                    Some((_sid, Ok(value))) => Ok(ApiResponse {
                        request_id: "".to_string(),
                        success: true,
                        data: Some(value),
                        error: None,
                    }),
                    Some((_sid, Err(e))) => Err(e.to_string()),
                    None => Err("Ack stream closed".to_string()),
                }
            }
            Err(err) => {
                println!("Ack error {:?}", err);
                Err(err.to_string())
            }
        }
    }
}

// Global server instance
static mut PLUGIN_SERVER: Option<Arc<RwLock<PluginServer>>> = None;

pub fn initialize_plugin_server(app_handle: AppHandle, port: u16) {
    unsafe {
        let server_ptr = std::ptr::addr_of_mut!(PLUGIN_SERVER);
        if (*server_ptr).is_none() {
            let server = PluginServer::new(app_handle, port);
            *server_ptr = Some(Arc::new(RwLock::new(server)));
            info!("Plugin server initialized on port {}", port);
        }
    }
}

pub fn get_plugin_server() -> Option<Arc<RwLock<PluginServer>>> {
    unsafe {
        let server_ptr = std::ptr::addr_of!(PLUGIN_SERVER);
        (*server_ptr).as_ref().cloned()
    }
}

// Tauri commands
#[tauri::command]
pub async fn start_plugin_server(app_handle: AppHandle, port: u16) -> Result<u16, String> {
    println!("Starting plugin server on port {}", port);

    // Initialize server if it doesn't exist
    if get_plugin_server().is_none() {
        initialize_plugin_server(app_handle, port);
    }

    if let Some(server_arc) = get_plugin_server() {
        let (is_running, current_port) = {
            let server = server_arc.read().await;
            let running = *server.is_running.read().await;
            (running, server.port)
        };

        if is_running {
            println!("Plugin server is already running on port {}", current_port);
            return Ok(current_port);
        }

        println!("Starting plugin server...");
        let mut server = server_arc.write().await;
        match server.start().await {
            Ok(()) => {
                let actual_port = server.port;
                println!("Plugin server started successfully on port {}", actual_port);
                Ok(actual_port)
            }
            Err(e) => {
                error!("Failed to start plugin server: {}", e);
                Err(format!("Failed to start plugin server: {}", e))
            }
        }
    } else {
        error!("Failed to initialize plugin server");
        Err("Failed to initialize plugin server".to_string())
    }
}

#[tauri::command]
pub async fn stop_plugin_server() -> Result<String, String> {
    if let Some(server_arc) = get_plugin_server() {
        let server = server_arc.read().await;
        server.stop().await;
        Ok("Plugin server stopped".to_string())
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn send_api_response(response: ApiResponse) -> Result<String, String> {
    if let Some(server_arc) = get_plugin_server() {
        let server = server_arc.read().await;
        server.send_api_response(response).await?;
        Ok("Response sent".to_string())
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_connected_plugins() -> Result<Vec<PluginInfo>, String> {
    if let Some(server_arc) = get_plugin_server() {
        let server = server_arc.read().await;
        Ok(server.get_connected_plugins().await)
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn send_to_plugin(plugin_id: String, event: String, data: Value) -> Result<String, String> {
    if let Some(server_arc) = get_plugin_server() {
        let server = server_arc.read().await;
        server.send_to_plugin(&plugin_id, &event, data).await?;
        Ok("Message sent".to_string())
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn send_to_plugin_with_ack(plugin_id: String, event: String, data: Value) -> Result<ApiResponse, String> {
    if let Some(server_arc) = get_plugin_server() {
        let server = server_arc.read().await;
        server.send_to_plugin_with_ack(&plugin_id, &event, data).await
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn broadcast_to_plugins(event: String, data: Value) -> Result<String, String> {
    if let Some(server_arc) = get_plugin_server() {
        let server = server_arc.read().await;
        let connections = server.connections.read().await;
        for plugin_id in connections.keys() {
            if let Err(e) = server.send_to_plugin(plugin_id, &event, data.clone()).await {
                error!("Failed to send to plugin {}: {}", plugin_id, e);
            }
        }
        Ok("Broadcast sent".to_string())
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_plugin_server_port() -> Result<u16, String> {
    let port = get_active_port();
    if port == 0 {
        Err("Plugin server not started".to_string())
    } else {
        Ok(port)
    }
}
