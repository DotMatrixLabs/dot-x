use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{Manager, AppHandle, Window};
use log::{info, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMessage {
    pub plugin_id: String,
    pub message_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub connected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIElement {
    pub id: String,
    pub element_type: String,
    pub config: serde_json::Value,
    pub plugin_id: String,
}

pub struct PluginConnection {
    pub id: String,
    pub info: PluginInfo,
    pub sender: mpsc::UnboundedSender<Message>,
}

pub struct PluginServer {
    pub connections: Arc<RwLock<HashMap<String, PluginConnection>>>,
    pub ui_elements: Arc<RwLock<HashMap<String, UIElement>>>,
    pub app_handle: AppHandle,
    pub port: u16,
    pub is_running: Arc<RwLock<bool>>,
}

impl PluginServer {
    pub fn new(app_handle: AppHandle, port: u16) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            ui_elements: Arc::new(RwLock::new(HashMap::new())),
            app_handle,
            port,
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut is_running = self.is_running.write().await;
        if *is_running {
            return Ok(());
        }

        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", self.port)).await?;
        *is_running = true;
        drop(is_running);

        info!("Plugin WebSocket server started on port {}", self.port);
        
        // Emit to frontend that server started
        let _ = self.app_handle.emit_all("plugin_server/started", json!({ "port": self.port }));

        let connections = Arc::clone(&self.connections);
        let ui_elements = Arc::clone(&self.ui_elements);
        let app_handle = self.app_handle.clone();
        let is_running = Arc::clone(&self.is_running);

        tokio::spawn(async move {
            while *is_running.read().await {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        debug!("New connection from {}", addr);
                        
                        let connections = Arc::clone(&connections);
                        let ui_elements = Arc::clone(&ui_elements);
                        let app_handle = app_handle.clone();
                        
                        tokio::spawn(async move {
                            if let Err(e) = Self::handle_connection(stream, connections, ui_elements, app_handle).await {
                                error!("Error handling connection: {}", e);
                            }
                        });
                    }
                    Err(e) => {
                        error!("Error accepting connection: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn stop(&self) {
        let mut is_running = self.is_running.write().await;
        *is_running = false;
        
        // Disconnect all plugins
        let mut connections = self.connections.write().await;
        for (plugin_id, connection) in connections.drain() {
            let _ = connection.sender.send(Message::Close(None));
            debug!("Disconnected plugin: {}", plugin_id);
        }
        
        // Clear UI elements
        let mut ui_elements = self.ui_elements.write().await;
        ui_elements.clear();
        
        info!("Plugin WebSocket server stopped");
        let _ = self.app_handle.emit_all("plugin_server/stopped", json!({}));
    }

    async fn handle_connection(
        stream: tokio::net::TcpStream,
        connections: Arc<RwLock<HashMap<String, PluginConnection>>>,
        ui_elements: Arc<RwLock<HashMap<String, UIElement>>>,
        app_handle: AppHandle,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let ws_stream = accept_async(stream).await?;
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();
        
        let (tx, mut rx) = mpsc::unbounded_channel();
        
        // Handle outgoing messages
        let sender_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if ws_sender.send(msg).await.is_err() {
                    break;
                }
            }
        });

        let mut plugin_id: Option<String> = None;

        // Handle incoming messages
        while let Some(message) = ws_receiver.next().await {
            match message? {
                Message::Text(text) => {
                    if let Ok(msg) = serde_json::from_str::<PluginMessage>(&text) {
                        match msg.message_type.as_str() {
                            "register" => {
                                if let Ok(info) = serde_json::from_value::<PluginInfo>(msg.data) {
                                    plugin_id = Some(info.id.clone());
                                    
                                    let connection = PluginConnection {
                                        id: info.id.clone(),
                                        info: info.clone(),
                                        sender: tx.clone(),
                                    };
                                    
                                    connections.write().await.insert(info.id.clone(), connection);
                                    
                                    info!("Plugin registered: {} ({})", info.name, info.id);
                                    
                                    // Emit to frontend
                                    let _ = app_handle.emit_all("plugin/connected", json!({
                                        "plugin_id": info.id,
                                        "info": info
                                    }));
                                    
                                    // Send registration acknowledgment
                                    let ack = PluginMessage {
                                        plugin_id: info.id.clone(),
                                        message_type: "register_ack".to_string(),
                                        data: json!({ "status": "success" }),
                                    };
                                    let _ = tx.send(Message::Text(serde_json::to_string(&ack)?));
                                }
                            }
                            "api_request" => {
                                if let Some(ref pid) = plugin_id {
                                    // Forward API request to frontend
                                    let _ = app_handle.emit_all("plugin/api_request", json!({
                                        "plugin_id": pid,
                                        "request": msg.data
                                    }));
                                }
                            }
                            "ui_element" => {
                                if let Some(ref pid) = plugin_id {
                                    if let Ok(element) = serde_json::from_value::<UIElement>(msg.data) {
                                        let element_with_plugin = UIElement {
                                            plugin_id: pid.clone(),
                                            ..element
                                        };
                                        
                                        ui_elements.write().await.insert(element_with_plugin.id.clone(), element_with_plugin.clone());
                                        
                                        // Emit to frontend
                                        let _ = app_handle.emit_all("plugin/ui_element", json!({
                                            "plugin_id": pid,
                                            "element": element_with_plugin
                                        }));
                                    }
                                }
                            }
                            _ => {
                                // Forward other messages to frontend
                                if let Some(ref pid) = plugin_id {
                                    let _ = app_handle.emit_all("plugin/message", json!({
                                        "plugin_id": pid,
                                        "message": msg
                                    }));
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    debug!("Plugin connection closed");
                    break;
                }
                _ => {}
            }
        }

        // Clean up when connection closes
        if let Some(pid) = plugin_id {
            connections.write().await.remove(&pid);
            
            // Remove UI elements for this plugin
            let mut elements = ui_elements.write().await;
            elements.retain(|_, element| element.plugin_id != pid);
            
            info!("Plugin disconnected: {}", pid);
            let _ = app_handle.emit_all("plugin/disconnected", json!({ "plugin_id": pid }));
        }

        sender_task.abort();
        Ok(())
    }

    pub async fn send_to_plugin(&self, plugin_id: &str, message: PluginMessage) -> Result<(), String> {
        let connections = self.connections.read().await;
        if let Some(connection) = connections.get(plugin_id) {
            let msg_text = serde_json::to_string(&message).map_err(|e| e.to_string())?;
            connection.sender.send(Message::Text(msg_text)).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err(format!("Plugin {} not found", plugin_id))
        }
    }

    pub async fn get_connected_plugins(&self) -> Vec<PluginInfo> {
        let connections = self.connections.read().await;
        connections.values().map(|conn| conn.info.clone()).collect()
    }

    pub async fn get_ui_elements(&self) -> Vec<UIElement> {
        let ui_elements = self.ui_elements.read().await;
        ui_elements.values().cloned().collect()
    }
}

// Global server instance
static mut PLUGIN_SERVER: Option<Arc<PluginServer>> = None;
static INIT: std::sync::Once = std::sync::Once::new();

pub fn get_plugin_server() -> Option<Arc<PluginServer>> {
    unsafe { PLUGIN_SERVER.as_ref().cloned() }
}

pub fn init_plugin_server(app_handle: AppHandle, port: u16) -> Arc<PluginServer> {
    unsafe {
        INIT.call_once(|| {
            let server = Arc::new(PluginServer::new(app_handle, port));
            PLUGIN_SERVER = Some(server);
        });
        PLUGIN_SERVER.as_ref().unwrap().clone()
    }
}

// Tauri commands
#[tauri::command]
pub async fn start_plugin_server(port: u16) -> Result<String, String> {
    if let Some(server) = get_plugin_server() {
        server.start().await.map_err(|e| e.to_string())?;
        Ok(format!("Plugin server started on port {}", port))
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn stop_plugin_server() -> Result<String, String> {
    if let Some(server) = get_plugin_server() {
        server.stop().await;
        Ok("Plugin server stopped".to_string())
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn send_to_plugin(plugin_id: String, message: PluginMessage) -> Result<String, String> {
    if let Some(server) = get_plugin_server() {
        server.send_to_plugin(&plugin_id, message).await?;
        Ok("Message sent".to_string())
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_connected_plugins() -> Result<Vec<PluginInfo>, String> {
    if let Some(server) = get_plugin_server() {
        Ok(server.get_connected_plugins().await)
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

#[tauri::command]
pub async fn get_ui_elements() -> Result<Vec<UIElement>, String> {
    if let Some(server) = get_plugin_server() {
        Ok(server.get_ui_elements().await)
    } else {
        Err("Plugin server not initialized".to_string())
    }
}

// Helper macro for JSON serialization
macro_rules! json {
    ($($tt:tt)*) => {
        serde_json::json!($($tt)*)
    };
}

use json; 