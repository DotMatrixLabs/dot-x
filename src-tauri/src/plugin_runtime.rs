use std::{ collections::{HashMap, VecDeque}, fs, path::{Path, PathBuf}, };
use log::{error, info};
use once_cell::sync::OnceCell;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tauri::Emitter;
use tokio::{process::Command, sync::RwLock, io::{AsyncBufReadExt, BufReader, AsyncWriteExt, AsyncRead}};
use tokio::fs as async_fs;
use chrono::Local;

// Global process table: plugin_id -> Child process
static PROCESS_TABLE: OnceCell<Arc<RwLock<HashMap<String, tokio::process::Child>>>> = OnceCell::new();

// Global logs table: plugin_id -> captured logs (stdout + stderr)
static LOGS_TABLE: OnceCell<Arc<RwLock<HashMap<String, VecDeque<String>>>>> = OnceCell::new();

const MAX_LOG_LINES: usize = 5000; // per plugin in-memory
const MAX_LOG_FILE_BYTES: u64 = 5 * 1024 * 1024; // 5MB per plugin log file
const MAX_LOG_BACKUPS: u8 = 2; // plugin.log.1 .. plugin.log.3

fn process_table() -> Arc<RwLock<HashMap<String, tokio::process::Child>>> {
  PROCESS_TABLE
    .get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
    .clone()
}

fn logs_table() -> Arc<RwLock<HashMap<String, VecDeque<String>>>> {
  LOGS_TABLE
    .get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
    .clone()
}

fn make_backup_path(base: &Path, index: u8) -> PathBuf {
  let mut s = base.to_string_lossy().to_string();
  s.push('.');
  s.push_str(&index.to_string());
  PathBuf::from(s)
}

async fn rotate_logs_if_needed(log_path: &Path) -> Result<(), String> {
  if let Ok(meta) = async_fs::metadata(log_path).await {
    if meta.len() <= MAX_LOG_FILE_BYTES { return Ok(()); }
  } else {
    return Ok(());
  }

  // Remove oldest backup
  let oldest = make_backup_path(log_path, MAX_LOG_BACKUPS);
  let _ = async_fs::remove_file(&oldest).await;

  // Shift backups
  let mut idx = MAX_LOG_BACKUPS;
  while idx > 1 {
    let src = make_backup_path(log_path, idx - 1);
    let dst = make_backup_path(log_path, idx);
    if async_fs::metadata(&src).await.is_ok() {
      let _ = async_fs::rename(&src, &dst).await;
    }
    idx -= 1;
  }

  if async_fs::metadata(log_path).await.is_ok() {
    let _ = async_fs::rename(log_path, make_backup_path(log_path, 1)).await;
  }

  let _ = async_fs::File::create(log_path).await.map_err(|e| format!("Failed to create new log file: {}", e))?;
  Ok(())
}

async fn append_log_line_to_file(dir: &Path, kind: &str, line: &str) -> Result<(), String> {
  let path = dir.join("plugin.log");
  let mut file = async_fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(&path)
    .await
    .map_err(|e| format!("Open log file failed: {}", e))?;

  let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
  let to_write = format!("[{}] [{}] {}\n", timestamp, kind, line);
  file.write_all(to_write.as_bytes()).await.map_err(|e| format!("Write log failed: {}", e))?;
  file.flush().await.map_err(|e| format!("Flush log failed: {}", e))?;
  drop(file);

  rotate_logs_if_needed(&path).await
}

async fn push_memory_log(plugin_id: &str, line: String) {
  let table = logs_table();
  let mut map = table.write().await;
  let entry = map.entry(plugin_id.to_string()).or_insert_with(|| VecDeque::with_capacity(MAX_LOG_LINES + 128));
  entry.push_back(line);
  if entry.len() > MAX_LOG_LINES {
    let overflow = entry.len() - MAX_LOG_LINES;
    for _ in 0..overflow { let _ = entry.pop_front(); }
  }
}

fn spawn_log_task<R>(plugin_id: String, app_handle: AppHandle, dir: PathBuf, stream: R, kind: &'static str)
where
  R: AsyncRead + Unpin + Send + 'static,
{
  tokio::spawn(async move {
    let reader = BufReader::new(stream);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
      let mem_line = format!("[{}] {}", kind, line);
      push_memory_log(&plugin_id, mem_line).await;
      let _ = append_log_line_to_file(&dir, kind, &line).await;

      let _ = app_handle.emit("plugin-log", serde_json::json!({
        "pluginId": plugin_id,
        "type": kind,
        "message": line
      }));
    }
  });
}

pub fn has_valid_plugins(dir: &Path) -> bool {
  // Check if directory contains at least one valid plugin
  // (subfolder with manifest.json and main.js)
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        let has_manifest = path.join("manifest.json").exists();
        let has_main = path.join("main.js").exists();
        if has_manifest && has_main {
          return true;
        }
      }
    }
  }
  false
}

pub fn resolve_plugins_dir(app_handle: &AppHandle) -> Option<PathBuf> {
  let path_resolver = app_handle.path();
  
  // Strategy 1: Try explicit DOTX_PLUGINS_PATH environment variable
  if let Ok(p) = std::env::var("DOTX_PLUGINS_PATH") {
    let path = PathBuf::from(p);
    if path.exists() && has_valid_plugins(&path) { 
      return Some(path); 
    }
  }
  
  // Strategy 2: Try plugins relative to current working directory (dev mode - prioritize this)
  if let Ok(cwd) = std::env::current_dir() {
    let candidate = cwd.join("plugins");
    if candidate.exists() && has_valid_plugins(&candidate) { 
      return Some(candidate); 
    }
    
    let candidate = cwd.join("..").join("plugins");
    if candidate.exists() && has_valid_plugins(&candidate) {
      if let Ok(normalized) = candidate.canonicalize() {
        return Some(normalized);
      }
    }
  }
  
  // Strategy 3: Try relative to app executable location
  if let Ok(exe_path) = std::env::current_exe() {
    if let Some(exe_dir) = exe_path.parent() {
      // Check ../plugins (one level up from executable - common in dev)
      let candidate = exe_dir.join("..").join("plugins");
      if candidate.exists() && has_valid_plugins(&candidate) { 
        if let Ok(normalized) = candidate.canonicalize() {
          return Some(normalized);
        }
      }
      
      // Check plugins next to executable
      let candidate = exe_dir.join("plugins");
      if candidate.exists() && has_valid_plugins(&candidate) { 
        return Some(candidate); 
      }
    }
  }
  
  // Strategy 4: Try ../plugins relative to Resource (works in bundled app)
  if let Ok(p) = path_resolver.resolve("../plugins", tauri::path::BaseDirectory::Resource) {
    if p.exists() && has_valid_plugins(&p) { 
      return Some(p); 
    }
  }
  
  // Strategy 5: Try plugins relative to Resource (works if bundled in resources)
  if let Ok(p) = path_resolver.resolve("plugins", tauri::path::BaseDirectory::Resource) {
    if p.exists() && has_valid_plugins(&p) { 
      return Some(p); 
    }
  }
  
  error!("No plugins directory with valid plugins found in any expected location!");
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
  let path_resolver = app_handle.path();
  if let Ok(base) = path_resolver.app_data_dir() {
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

  // Spawn `deno run --allow-all main.js` with stdout/stderr piped
  let deno_bin = resolve_deno_path(app_handle).unwrap_or_else(|| PathBuf::from("deno"));
  let mut cmd = Command::new(deno_bin);
  cmd.arg("run")
    .arg("--allow-all")
    .arg("--unstable-detect-cjs")
    .arg("main.js")
    .current_dir(dir)
    .env("DOTX_PLUGIN_ID", plugin_id)
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped());

  cmd.spawn().map_err(|e| format!("Failed to start Deno for {}: {}", plugin_id, e))
}

async fn start_plugin_internal(app_handle: &AppHandle, plugin_id: &str) -> Result<(), String> {
  if is_running(plugin_id).await {
    return Ok(());
  }

  let dir = find_plugin_dir_by_id(app_handle, plugin_id)
    .ok_or_else(|| format!("Plugin {} not found", plugin_id))?;

  let mut child = spawn_deno_process(app_handle, &dir, plugin_id).await?;

  // Capture stdout
  if let Some(stdout) = child.stdout.take() {
    spawn_log_task(plugin_id.to_string(), app_handle.clone(), dir.clone(), stdout, "stdout");
  }

  // Capture stderr
  if let Some(stderr) = child.stderr.take() {
    spawn_log_task(plugin_id.to_string(), app_handle.clone(), dir.clone(), stderr, "stderr");
  }

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
    
    // Note: We keep logs in memory even after plugin stops for debugging
    Ok(())
  } else {
    // Not running; treat as success
    Ok(())
  }
}

fn read_enabled_plugin_ids(app_handle: &AppHandle) -> Vec<String> {
  // Try common store locations used by tauri-plugin-store
  let mut candidates: Vec<PathBuf> = Vec::new();
  let path_resolver = app_handle.path();
  if let Ok(p) = path_resolver.app_data_dir() {
    candidates.push(p.join("plugins.json"));
  }
  if let Ok(p) = path_resolver.app_config_dir() {
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

#[tauri::command]
pub async fn get_plugin_logs(plugin_id: String) -> Result<String, String> {
  let logs = logs_table();
  let map = logs.read().await;
  
  if let Some(lines) = map.get(&plugin_id) {
    if lines.is_empty() {
      Ok("No logs available yet. Logs will appear once the plugin produces output.".to_string())
    } else {
      Ok(lines.iter().cloned().collect::<Vec<String>>().join("\n"))
    }
  } else {
    Ok("No logs available for this plugin. Make sure the plugin is running.".to_string())
  }
}

#[tauri::command]
pub async fn clear_plugin_logs(plugin_id: String) -> Result<String, String> {
  let logs = logs_table();
  let mut map = logs.write().await;
  
  if let Some(lines) = map.get_mut(&plugin_id) {
    lines.clear();
    Ok(format!("Logs cleared for plugin {}", plugin_id))
  } else {
    Ok(format!("No logs to clear for plugin {}", plugin_id))
  }
}


