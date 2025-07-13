use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::fs;
use serde::{Deserialize, Serialize};
use tauri::api::path::app_data_dir;
use tauri::{Config, PackageInfo};
use serde_json::Value;
use log::{info, error, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub main: String,
    pub permissions: Vec<String>,
    #[serde(rename = "dotxVersion")]
    pub dotx_version: Option<String>,
    pub license: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub engines: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub id: String,
    pub enabled: bool,
    pub folder_path: String,
    pub auto_start: bool,
    pub last_modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginProcess {
    pub id: String,
    pub pid: u32,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub permissions: Vec<String>,
}

pub struct PluginManager {
    pub plugins_dir: PathBuf,
    pub active_processes: HashMap<String, PluginProcess>,
}

impl PluginManager {
    pub fn new(config: &Config, package_info: &PackageInfo) -> Result<Self, Box<dyn std::error::Error>> {
        let app_data = app_data_dir(config, &package_info.name)
            .ok_or("Failed to get app data directory")?;
        
        let plugins_dir = app_data.join("plugins");
        
        // Create plugins directory if it doesn't exist
        if !plugins_dir.exists() {
            fs::create_dir_all(&plugins_dir)?;
            info!("Created plugins directory: {:?}", plugins_dir);
        }
        
        Ok(PluginManager {
            plugins_dir,
            active_processes: HashMap::new(),
        })
    }

    pub fn discover_plugins(&self) -> Result<Vec<PluginConfig>, Box<dyn std::error::Error>> {
        let mut plugins = Vec::new();
        
        if !self.plugins_dir.exists() {
            return Ok(plugins);
        }

        for entry in fs::read_dir(&self.plugins_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                let manifest_path = path.join("manifest.json");
                if manifest_path.exists() {
                    match self.load_manifest(&manifest_path) {
                        Ok(manifest) => {
                            let config = PluginConfig {
                                id: manifest.id.clone(),
                                enabled: false, // Default to disabled
                                folder_path: path.to_string_lossy().to_string(),
                                auto_start: false,
                                last_modified: None,
                            };
                            plugins.push(config);
                            info!("Discovered plugin: {} at {:?}", manifest.name, path);
                        }
                        Err(e) => {
                            error!("Failed to load manifest for plugin at {:?}: {}", path, e);
                        }
                    }
                }
            }
        }
        
        Ok(plugins)
    }

    pub fn load_manifest(&self, manifest_path: &PathBuf) -> Result<PluginManifest, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(manifest_path)?;
        let manifest: PluginManifest = serde_json::from_str(&content)?;
        Ok(manifest)
    }

    pub fn start_plugin(&mut self, plugin_config: &PluginConfig) -> Result<(), Box<dyn std::error::Error>> {
        let plugin_path = PathBuf::from(&plugin_config.folder_path);
        let manifest_path = plugin_path.join("manifest.json");
        let manifest = self.load_manifest(&manifest_path)?;
        
        // Check if main.js exists
        let main_js_path = plugin_path.join(&manifest.main);
        if !main_js_path.exists() {
            return Err(format!("Main file not found: {:?}", main_js_path).into());
        }

        // Validate permissions
        if !self.validate_permissions(&manifest.permissions) {
            return Err("Invalid permissions in manifest".into());
        }

        // Build Deno command with permissions
        let mut deno_cmd = Command::new("deno");
        deno_cmd
            .arg("run")
            .arg("--allow-net=localhost:8080") // Allow connection to RPC server
            .arg("--allow-read") // Allow reading files
            .arg("--unstable");

        // Add specific permissions based on manifest
        for permission in &manifest.permissions {
            match permission.as_str() {
                "storage.local" => {
                    deno_cmd.arg("--allow-write");
                }
                "system.volume" => {
                    deno_cmd.arg("--allow-run");
                }
                "system.rgb" => {
                    deno_cmd.arg("--allow-run");
                }
                "ui.commands" | "ui.toasts" | "ui.actionSelector" | "ui.settings" | "ui.topBar" => {
                    // These are handled via RPC, no additional permissions needed
                }
                _ => {
                    warn!("Unknown permission: {}", permission);
                }
            }
        }

        deno_cmd
            .arg(main_js_path)
            .current_dir(&plugin_path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Start the process
        let mut child = deno_cmd.spawn()?;
        let pid = child.id();
        
        // Store the process info
        let process = PluginProcess {
            id: manifest.id.clone(),
            pid,
            started_at: chrono::Utc::now(),
            permissions: manifest.permissions.clone(),
        };
        
        self.active_processes.insert(manifest.id.clone(), process);
        
        info!("Started plugin: {} (PID: {})", manifest.name, pid);
        
        // Spawn a thread to monitor the process
        let plugin_id = manifest.id.clone();
        let plugin_name = manifest.name.clone();
        
        tokio::spawn(async move {
            match child.wait() {
                Ok(status) => {
                    if status.success() {
                        info!("Plugin {} exited successfully", plugin_name);
                    } else {
                        error!("Plugin {} exited with error: {}", plugin_name, status);
                    }
                }
                Err(e) => {
                    error!("Error waiting for plugin {}: {}", plugin_name, e);
                }
            }
        });

        Ok(())
    }

    pub fn stop_plugin(&mut self, plugin_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(process) = self.active_processes.remove(plugin_id) {
            // Try to terminate the process gracefully
            #[cfg(unix)]
            {
                let _ = Command::new("kill")
                    .arg("-TERM")
                    .arg(process.pid.to_string())
                    .output();
            }
            
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/PID", &process.pid.to_string()])
                    .output();
            }
            
            info!("Stopped plugin: {} (PID: {})", plugin_id, process.pid);
            Ok(())
        } else {
            Err(format!("Plugin {} not found in active processes", plugin_id).into())
        }
    }

    pub fn get_active_plugins(&self) -> Vec<&PluginProcess> {
        self.active_processes.values().collect()
    }

    pub fn is_plugin_running(&self, plugin_id: &str) -> bool {
        self.active_processes.contains_key(plugin_id)
    }

    fn validate_permissions(&self, permissions: &[String]) -> bool {
        const VALID_PERMISSIONS: &[&str] = &[
            "ui.commands",
            "ui.toasts", 
            "ui.actionSelector",
            "ui.settings",
            "ui.topBar",
            "storage.local",
            "system.volume",
            "system.rgb",
            "system.brightness",
            "system.notifications",
        ];

        permissions.iter().all(|p| VALID_PERMISSIONS.contains(&p.as_str()))
    }
}

// Tauri commands
#[tauri::command]
pub async fn start_plugins(
    plugin_configs: Vec<PluginConfig>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let mut started_plugins = Vec::new();
    let config = app_handle.config();
    let package_info = app_handle.package_info();
    
    let mut manager = PluginManager::new(config, package_info)
        .map_err(|e| format!("Failed to create plugin manager: {}", e))?;

    for plugin_config in plugin_configs {
        if plugin_config.enabled {
            match manager.start_plugin(&plugin_config) {
                Ok(()) => {
                    started_plugins.push(plugin_config.id.clone());
                    info!("Successfully started plugin: {}", plugin_config.id);
                }
                Err(e) => {
                    error!("Failed to start plugin {}: {}", plugin_config.id, e);
                    // Continue with other plugins instead of failing completely
                }
            }
        }
    }

    Ok(started_plugins)
}

#[tauri::command]
pub async fn discover_plugins(
    app_handle: tauri::AppHandle,
) -> Result<Vec<PluginConfig>, String> {
    let config = app_handle.config();
    let package_info = app_handle.package_info();
    
    let manager = PluginManager::new(config, package_info)
        .map_err(|e| format!("Failed to create plugin manager: {}", e))?;

    manager.discover_plugins()
        .map_err(|e| format!("Failed to discover plugins: {}", e))
}

#[tauri::command]
pub async fn stop_plugin(
    plugin_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let config = app_handle.config();
    let package_info = app_handle.package_info();
    
    let mut manager = PluginManager::new(config, package_info)
        .map_err(|e| format!("Failed to create plugin manager: {}", e))?;

    manager.stop_plugin(&plugin_id)
        .map_err(|e| format!("Failed to stop plugin: {}", e))
}

#[tauri::command]
pub async fn get_active_plugins(
    app_handle: tauri::AppHandle,
) -> Result<Vec<PluginProcess>, String> {
    let config = app_handle.config();
    let package_info = app_handle.package_info();
    
    let manager = PluginManager::new(config, package_info)
        .map_err(|e| format!("Failed to create plugin manager: {}", e))?;

    Ok(manager.get_active_plugins().into_iter().cloned().collect())
} 