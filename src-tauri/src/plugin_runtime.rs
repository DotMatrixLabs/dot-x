use std::{ collections::HashMap, fs, path::{Path, PathBuf}, };
use log::{error, info};
use once_cell::sync::OnceCell;
use serde_json::Value;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::{process::Command, sync::RwLock};

// Global process table: plugin_id -> Child process
static PROCESS_TABLE: OnceCell<Arc<RwLock<HashMap<String, tokio::process::Child>>>> = OnceCell::new();

fn process_table() -> Arc<RwLock<HashMap<String, tokio::process::Child>>> {
  PROCESS_TABLE
    .get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
    .clone()
}

fn resolve_plugins_dir(app_handle: &AppHandle) -> Option<PathBuf> {
  if let Some(p) = app_handle.path_resolver().resolve_resource("../plugins") {
    if p.exists() { return Some(p); }
  }
  if let Some(p) = app_handle.path_resolver().resolve_resource("plugins") {
    if p.exists() { return Some(p); }
  }
  if let Ok(cwd) = std::env::current_dir() {
    let candidate = cwd.join("plugins");
    if candidate.exists() { return Some(candidate); }
    let candidate = cwd.join("..\\plugins");
    if candidate.exists() { return Some(candidate); }
  }
  None
}

fn read_manifest_id(manifest_path: &Path) -> Option<String> {
  let s = fs::read_to_string(manifest_path).ok()?;
  let v: Value = serde_json::from_str(&s).ok()?;
  v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string())
}

fn find_plugin_dir_by_id(app_handle: &AppHandle, plugin_id: &str) -> Option<PathBuf> {
  let plugins_dir = resolve_plugins_dir(app_handle)?;
  let read_dir = fs::read_dir(&plugins_dir).ok()?;
  for entry in read_dir.flatten() {
    let path = entry.path();
    if !path.is_dir() { continue; }
    let manifest_path = path.join("manifest.json");
    let main_js = path.join("main.js");
    if !manifest_path.exists() || !main_js.exists() { continue; }

    let id = read_manifest_id(&manifest_path)
      .unwrap_or_else(|| entry.file_name().to_string_lossy().to_string());
    if id == plugin_id { return Some(path); }
  }
  None
}

async fn is_running(plugin_id: &str) -> bool {
  let table = process_table();
  let map = table.read().await;
  map.contains_key(plugin_id)
}

fn resolve_deno_path(app_handle: &AppHandle) -> Option<PathBuf> {
  if let Ok(p) = std::env::var("DOTX_DENO_PATH") {
    let path = PathBuf::from(p);
    if path.exists() { return Some(path); }
  }
  if let Some(base) = app_handle.path_resolver().app_data_dir() {
    let exe_name = if cfg!(target_os = "windows") { "deno.exe" } else { "deno" };
    let candidate = base.join("deno").join(exe_name);
    if candidate.exists() { return Some(candidate); }
  }
  None
}

async fn spawn_deno_process(app_handle: &AppHandle, dir: &Path, plugin_id: &str) -> Result<tokio::process::Child, String> {
  // Basic existence checks
  let main_js = dir.join("main.js");
  if !main_js.exists() {
    return Err(format!("main.js not found for plugin {}", plugin_id));
  }

  // Spawn `deno run --allow-all main.js`
  let deno_bin = resolve_deno_path(app_handle).unwrap_or_else(|| PathBuf::from("deno"));
  let mut cmd = Command::new(deno_bin);
  cmd.arg("run")
    .arg("--allow-all")
    .arg("--unstable-detect-cjs")
    .arg("main.js")
    .current_dir(dir)
    .env("DOTX_PLUGIN_ID", plugin_id);

  cmd.spawn().map_err(|e| format!("Failed to start Deno for {}: {}", plugin_id, e))
}

async fn start_plugin_internal(app_handle: &AppHandle, plugin_id: &str) -> Result<(), String> {
  if is_running(plugin_id).await {
    return Ok(());
  }

  let dir = find_plugin_dir_by_id(app_handle, plugin_id)
    .ok_or_else(|| format!("Plugin {} not found", plugin_id))?;

  let child = spawn_deno_process(app_handle, &dir, plugin_id).await?;
  let table = process_table();
  let mut map = table.write().await;
  map.insert(plugin_id.to_string(), child);
  info!("Started plugin {}", plugin_id);
  Ok(())
}

async fn stop_plugin_internal(plugin_id: &str) -> Result<(), String> {
  let table = process_table();
  let mut map = table.write().await;
  if let Some(mut child) = map.remove(plugin_id) {
    // Try to terminate process
    if let Err(e) = child.kill().await {
      // It's possible the process already exited; log and continue
      error!("Failed to kill plugin {}: {}", plugin_id, e);
    }
    info!("Stopped plugin {}", plugin_id);
    Ok(())
  } else {
    // Not running; treat as success
    Ok(())
  }
}

fn read_enabled_plugin_ids(app_handle: &AppHandle) -> Vec<String> {
  // Try common store locations used by tauri-plugin-store
  let mut candidates: Vec<PathBuf> = Vec::new();
  if let Some(p) = app_handle.path_resolver().app_data_dir() {
    candidates.push(p.join("plugins.json"));
  }
  if let Some(p) = app_handle.path_resolver().app_config_dir() {
    candidates.push(p.join("plugins.json"));
  }

  for path in candidates {
    if let Ok(s) = fs::read_to_string(&path) {
      if let Ok(v) = serde_json::from_str::<Value>(&s) {
        // Expect shape: { "enabled": ["pluginId", ...] }
        if let Some(arr) = v.get("enabled").and_then(|x| x.as_array()) {
          let mut ids: Vec<String> = Vec::new();
          for item in arr {
            if let Some(id) = item.as_str() { ids.push(id.to_string()); }
          }
          if !ids.is_empty() { return ids; }
        }
      }
    }
  }
  Vec::new()
}

#[tauri::command]
pub async fn start_plugin(app_handle: AppHandle, plugin_id: String) -> Result<String, String> {
  start_plugin_internal(&app_handle, &plugin_id).await?;
  Ok(format!("Plugin {} started", plugin_id))
}

#[tauri::command]
pub async fn stop_plugin(plugin_id: String) -> Result<String, String> {
  stop_plugin_internal(&plugin_id).await?;
  Ok(format!("Plugin {} stopped", plugin_id))
}

#[tauri::command]
pub async fn restart_plugin(app_handle: AppHandle, plugin_id: String) -> Result<String, String> {
  let _ = stop_plugin_internal(&plugin_id).await; // ignore error if not running
  start_plugin_internal(&app_handle, &plugin_id).await?;
  Ok(format!("Plugin {} restarted", plugin_id))
}

#[tauri::command]
pub async fn start_enabled_plugins(app_handle: AppHandle) -> Result<usize, String> {
  let ids = read_enabled_plugin_ids(&app_handle);
  let mut started = 0usize;
  for id in ids {
    if start_plugin_internal(&app_handle, &id).await.is_ok() {
      started += 1;
    }
  }
  Ok(started)
}

pub fn auto_start_enabled_plugins(app_handle: AppHandle) {
  tauri::async_runtime::spawn(async move {
    match start_enabled_plugins(app_handle).await {
      Ok(count) => info!("Auto-started {} enabled plugins", count),
      Err(e) => error!("Failed to auto-start plugins: {}", e),
    }
  });
}


