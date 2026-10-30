use std::{ collections::{HashMap, HashSet, VecDeque}, fs, path::{Component, Path, PathBuf}, };
use log::{error, info, warn};
use once_cell::sync::OnceCell;
use serde_json::{json, Value};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};
use tauri::Emitter;
use tokio::{process::Command, sync::{RwLock, Notify}, io::{AsyncBufReadExt, BufReader, AsyncWriteExt, AsyncRead}};
use tokio::fs as async_fs;
use chrono::Local;
use crate::plugin_server::{get_active_port, start_plugin_server, DEFAULT_PORT};

// Global process table: plugin_id -> Child process
static PROCESS_TABLE: OnceCell<Arc<RwLock<HashMap<String, tokio::process::Child>>>> = OnceCell::new();
static PROCESS_REAPER_STARTED: OnceCell<()> = OnceCell::new();
static EXPECTED_PROCESS_EXITS: OnceCell<Arc<RwLock<HashSet<String>>>> = OnceCell::new();

// Global logs table: plugin_id -> captured logs (stdout + stderr)
static LOGS_TABLE: OnceCell<Arc<RwLock<HashMap<String, VecDeque<String>>>>> = OnceCell::new();

// Set once the frontend has registered its plugin event listeners
// (PluginAPI.initialize -> notify_frontend_ready). Plugin auto-start waits on
// this so an auto-started plugin's onLoad blocking-UI call (`plugin/api_request`)
// isn't emitted and dropped before the frontend is listening.
static FRONTEND_READY: AtomicBool = AtomicBool::new(false);
static FRONTEND_READY_NOTIFY: OnceCell<Notify> = OnceCell::new();

// Fallback so plugins still auto-start on a headless/failed-frontend launch,
// where notify_frontend_ready never arrives.
const FRONTEND_READY_TIMEOUT_SECS: u64 = 10;

const MAX_LOG_LINES: usize = 5000; // per plugin in-memory
const MAX_LOG_FILE_BYTES: u64 = 5 * 1024 * 1024; // 5MB per plugin log file
const MAX_LOG_BACKUPS: u8 = 2; // plugin.log.1 .. plugin.log.3
const PROCESS_REAPER_INTERVAL_SECS: u64 = 2;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

fn expected_process_exits() -> Arc<RwLock<HashSet<String>>> {
  EXPECTED_PROCESS_EXITS
    .get_or_init(|| Arc::new(RwLock::new(HashSet::new())))
    .clone()
}

fn emit_plugin_lifecycle(
  app_handle: &AppHandle,
  plugin_id: &str,
  status: &str,
  error: Option<String>,
  exit_code: Option<i32>,
  signal: Option<String>,
  expected: Option<bool>,
) {
  let _ = app_handle.emit("plugin/lifecycle", json!({
    "id": plugin_id,
    "status": status,
    "error": error,
    "exitCode": exit_code,
    "signal": signal,
    "expected": expected,
  }));
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
  // (subfolder with manifest.json and the file referenced by manifest.main)
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        let manifest_path = path.join("manifest.json");
        if let Ok(info) = read_manifest_info(&manifest_path) {
          if path.join(info.main).exists() {
            return true;
          }
        }
      }
    }
  }
  false
}

pub fn ensure_plugins_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
  let path_resolver = app_handle.path();
  
  // Prefer app_data_dir for writable location
  let app_data_dir = path_resolver.app_data_dir()
    .map_err(|e| format!("App data dir not available: {}", e))?;
  let plugins_dir = app_data_dir.join("plugins");
  
  // Create directory if it doesn't exist
  if !plugins_dir.exists() {
    fs::create_dir_all(&plugins_dir)
      .map_err(|e| format!("Failed to create plugins directory: {}", e))?;
    info!("Created plugins directory at {}", plugins_dir.display());
  }
  
  Ok(plugins_dir)
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
  
  // Strategy 6: Fallback to app_data_dir/plugins (writable, can be empty)
  if let Ok(p) = ensure_plugins_dir(app_handle) {
    return Some(p);
  }
  
  error!("No plugins directory found in any expected location!");
  None
}

pub struct ManifestInfo {
  pub id: Option<String>,
  pub main: PathBuf,
}

/// Extended manifest with all parsed fields and validation state.
#[allow(dead_code)]
pub struct ValidatedManifest {
  pub id: Option<String>,
  pub name: String,
  pub version: String,
  pub description: String,
  pub author: String,
  pub main: PathBuf,
  pub permissions: Vec<String>,
  pub dotx_version: String,
  pub platforms: Vec<String>,
}

/// Known permission strings accepted in manifest.json `permissions`.
const KNOWN_PERMISSIONS: &[&str] = &["net", "network", "env", "run", "ffi", "sys", "read", "write", "hrtime", "all"];

/// Known platform strings accepted in manifest.json `platforms`.
pub const KNOWN_PLATFORMS: &[&str] = &["windows", "macos", "linux"];

/// The current OS as it should appear in manifest.json `platforms` entries.
pub fn current_os_name() -> &'static str {
  if cfg!(target_os = "windows") {
    "windows"
  } else if cfg!(target_os = "macos") {
    "macos"
  } else if cfg!(target_os = "linux") {
    "linux"
  } else {
    std::env::consts::OS
  }
}

/// Environment variables a plugin inherits from Dot X without asking for the
/// `env` permission. Without that permission the plugin's process environment is
/// cleared down to this list (see `baseline_plugin_env`), which is what keeps user
/// secrets out of reach: Deno itself gets unscoped `--allow-env`, because npm
/// packages such as `debug` (bundled into every SDK plugin via socket.io-client)
/// enumerate `process.env` on import and Deno only allows that with the unscoped
/// flag. The runtime-injected `DOTX_PLUGIN_*` variables are set separately. None
/// of these hold user secrets; anything else requires `env` in manifest.json.
const BASELINE_ENV_VARS: &[&str] = &[
  // Read by the SDK logger.
  "DOTX_PLUGIN_LOG_LEVEL",
  // Windows system variables. Winsock fails to initialise without SYSTEMROOT, so
  // the plugin could not reach the plugin server; PATH and PATHEXT let plugins
  // approved for `run` resolve commands by name.
  "SYSTEMROOT",
  "WINDIR",
  "PATH",
  "PATHEXT",
  // Node compatibility. Widely read at import time by npm packages.
  "NODE_ENV",
  "NODE_DEBUG",
  "NODE_OPTIONS",
  "NODE_PATH",
  "DEBUG",
  // Colour and TTY detection (chalk, supports-color and friends).
  "NO_COLOR",
  "FORCE_COLOR",
  "COLORTERM",
  "TERM",
  "TERM_PROGRAM",
  "ANSICON",
  "CI",
  // os.tmpdir() and date handling. These leak no more than the plugin's own
  // directory, which the plugin can already read.
  "TMPDIR",
  "TEMP",
  "TMP",
  "TZ",
];

/// Validate all manifest fields, permission values, version format, and
/// dotxVersion compatibility.  Returns the full parsed manifest or a list
/// of every problem found (so callers can surface them all at once).
pub fn validate_manifest(manifest_path: &Path) -> Result<ValidatedManifest, Vec<String>> {
  let contents = std::fs::read_to_string(manifest_path)
    .map_err(|e| vec![format!("Failed to read {}: {}", manifest_path.display(), e)])?;
  let json: Value = serde_json::from_str(&contents)
    .map_err(|e| vec![format!("Failed to parse {}: {}", manifest_path.display(), e)])?;

  let mut errors: Vec<String> = Vec::new();

  // --- required string fields ---
  let id = json.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
  let name = require_string(&json, "name", &mut errors);
  let version = require_string(&json, "version", &mut errors);
  let description = require_string(&json, "description", &mut errors);
  let author = require_string(&json, "author", &mut errors);
  let dotx_version = require_string(&json, "dotxVersion", &mut errors);

  // --- main (reuse existing path-safety validation) ---
  let main = match json.get("main").and_then(|v| v.as_str()) {
    Some(raw) => match normalize_manifest_main_path(raw) {
      Ok(p) => p,
      Err(e) => { errors.push(e); PathBuf::new() }
    },
    None => { errors.push("manifest.json is missing a string \"main\" field".to_string()); PathBuf::new() }
  };

  // --- permissions ---
  let permissions = match json.get("permissions").and_then(|v| v.as_array()) {
    Some(arr) => {
      let mut perms: Vec<String> = Vec::new();
      for (i, entry) in arr.iter().enumerate() {
        match entry.as_str() {
          Some(s) => {
            let p = s.trim().to_lowercase();
            if !KNOWN_PERMISSIONS.contains(&p.as_str()) {
              errors.push(format!("Unknown permission \"{}\" at permissions[{}]", p, i));
            }
            perms.push(p);
          }
          None => errors.push(format!("permissions[{}] must be a string", i)),
        }
      }
      perms
    }
    None => { errors.push("manifest.json is missing a \"permissions\" array".to_string()); Vec::new() }
  };

  // --- platforms (optional; omit to support all platforms) ---
  let platforms = match json.get("platforms") {
    None => Vec::new(),
    Some(Value::Array(arr)) => {
      let mut plats: Vec<String> = Vec::new();
      for (i, entry) in arr.iter().enumerate() {
        match entry.as_str() {
          Some(s) => {
            let p = s.trim().to_lowercase();
            if !KNOWN_PLATFORMS.contains(&p.as_str()) {
              errors.push(format!("Unknown platform \"{}\" at platforms[{}]", p, i));
            }
            plats.push(p);
          }
          None => errors.push(format!("platforms[{}] must be a string", i)),
        }
      }
      plats
    }
    Some(_) => {
      errors.push("manifest.json \"platforms\" must be an array of strings".to_string());
      Vec::new()
    }
  };
  if !platforms.is_empty() && !platforms.iter().any(|p| p == current_os_name()) {
    errors.push(format!(
      "Plugin only supports platform(s) [{}] but the current platform is \"{}\"",
      platforms.join(", "), current_os_name()
    ));
  }

  // --- version format (semver) ---
  if let Some(ref v) = version {
    if semver::Version::parse(v).is_err() {
      errors.push(format!("\"version\" value \"{}\" is not valid semver", v));
    }
  }

  // --- dotxVersion compatibility ---
  if let Some(ref constraint_str) = dotx_version {
    check_dotx_version_compat(constraint_str, &mut errors);
  }

  if !errors.is_empty() {
    return Err(errors);
  }

  Ok(ValidatedManifest {
    id,
    name: name.unwrap(),
    version: version.unwrap(),
    description: description.unwrap(),
    author: author.unwrap(),
    main,
    permissions,
    dotx_version: dotx_version.unwrap(),
    platforms,
  })
}

fn require_string(json: &Value, field: &str, errors: &mut Vec<String>) -> Option<String> {
  match json.get(field) {
    Some(v) => match v.as_str() {
      Some(s) if !s.trim().is_empty() => Some(s.to_string()),
      Some(_) => { errors.push(format!("manifest.json \"{}\" must not be empty", field)); None }
      None => { errors.push(format!("manifest.json \"{}\" must be a string", field)); None }
    },
    None => { errors.push(format!("manifest.json is missing a \"{}\" field", field)); None }
  }
}

pub fn check_dotx_version_compat(constraint_str: &str, errors: &mut Vec<String>) {
  check_dotx_version_against(constraint_str, env!("CARGO_PKG_VERSION"), errors);
}

fn check_dotx_version_against(constraint_str: &str, app_version_str: &str, errors: &mut Vec<String>) {
  // semver ranges never match a pre-release (">=1.0.0" rejects "2.0.0-1"), so compare
  // against the release the app is building toward.
  let app_version = match semver::Version::parse(app_version_str) {
    Ok(v) => semver::Version::new(v.major, v.minor, v.patch),
    Err(_) => {
      // If our own version isn't parseable, skip the check.
      warn!("Could not parse app version \"{}\" as semver; skipping dotxVersion check", app_version_str);
      return;
    }
  };

  let req = match semver::VersionReq::parse(constraint_str) {
    Ok(r) => r,
    Err(_) => {
      errors.push(format!(
        "\"dotxVersion\" value \"{}\" is not a valid semver requirement", constraint_str
      ));
      return;
    }
  };

  if !req.matches(&app_version) {
    errors.push(format!(
      "Plugin requires dotxVersion {} but the current app version is {}",
      constraint_str, app_version_str
    ));
  }
}

pub fn normalize_manifest_main_path(raw: &str) -> Result<PathBuf, String> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Err("manifest.json is missing a non-empty string \"main\" field".to_string());
  }

  let candidate = Path::new(trimmed);
  if candidate.is_absolute() {
    return Err("manifest.json \"main\" must be a relative path".to_string());
  }

  let mut normalized = PathBuf::new();
  for component in candidate.components() {
    match component {
      Component::Normal(part) => normalized.push(part),
      Component::CurDir => {}
      Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
        return Err("manifest.json \"main\" must stay inside the plugin root".to_string());
      }
    }
  }

  if normalized.as_os_str().is_empty() {
    return Err("manifest.json is missing a non-empty string \"main\" field".to_string());
  }

  Ok(normalized)
}

pub fn read_manifest_info(manifest_path: &Path) -> Result<ManifestInfo, String> {
  let contents = fs::read_to_string(manifest_path)
    .map_err(|e| format!("Failed to read {}: {}", manifest_path.display(), e))?;
  let json: Value = serde_json::from_str(&contents)
    .map_err(|e| format!("Failed to parse {}: {}", manifest_path.display(), e))?;

  let id = json.get("id").and_then(|x| x.as_str()).map(|s| s.to_string());
  let main_raw = json
    .get("main")
    .and_then(|x| x.as_str())
    .ok_or_else(|| format!("manifest.json missing string \"main\" field in {}", manifest_path.display()))?;
  let main = normalize_manifest_main_path(main_raw)?;

  Ok(ManifestInfo { id, main })
}

pub fn find_plugin_dir_by_id(app_handle: &AppHandle, plugin_id: &str) -> Option<PathBuf> {
  // Search both resolve_plugins_dir and ensure_plugins_dir so that plugins
  // installed via the marketplace (app_data_dir) are also found.
  let mut dirs_to_search: Vec<PathBuf> = Vec::new();
  if let Some(dir) = resolve_plugins_dir(app_handle) {
    dirs_to_search.push(dir);
  }
  if let Ok(dir) = ensure_plugins_dir(app_handle) {
    let canonical = dir.canonicalize().unwrap_or_else(|_| dir.clone());
    let already = dirs_to_search.iter().any(|d| {
      d.canonicalize().unwrap_or_else(|_| d.clone()) == canonical
    });
    if !already {
      dirs_to_search.push(dir);
    }
  }

  for plugins_dir in dirs_to_search {
    let read_dir = match fs::read_dir(&plugins_dir) {
      Ok(d) => d,
      Err(_) => continue,
    };
    for entry in read_dir.flatten() {
      let path = entry.path();
      if !path.is_dir() { continue; }
      let manifest_path = path.join("manifest.json");
      if !manifest_path.exists() { continue; }

      let manifest = match read_manifest_info(&manifest_path) {
        Ok(info) => info,
        Err(_) => continue,
      };
      if !path.join(&manifest.main).exists() { continue; }

      let id = manifest.id
        .unwrap_or_else(|| entry.file_name().to_string_lossy().to_string());
      if id == plugin_id { return Some(path); }
    }
  }
  None
}

fn read_permissions_from_manifest(dir: &Path) -> (Vec<String>, Vec<String>) {
  let manifest_path = dir.join("manifest.json");
  if !manifest_path.exists() {
    return (Vec::new(), vec![format!("manifest.json not found in {}", dir.display())]);
  }

  let contents = match fs::read_to_string(&manifest_path) {
    Ok(c) => c,
    Err(e) => return (Vec::new(), vec![format!("Failed to read {}: {}", manifest_path.display(), e)]),
  };

  let json: Value = match serde_json::from_str(&contents) {
    Ok(v) => v,
    Err(e) => return (Vec::new(), vec![format!("Failed to parse {}: {}", manifest_path.display(), e)]),
  };

  let permissions_value = json.get("permissions");
  let permissions_array = match permissions_value.and_then(|v| v.as_array()) {
    Some(a) => a,
    None => return (Vec::new(), vec![format!("permissions must be an array in {}", manifest_path.display())]),
  };

  let mut normalized: HashSet<String> = HashSet::new();
  let mut warnings: Vec<String> = Vec::new();

  for entry in permissions_array {
    match entry.as_str() {
      Some(s) => {
        let p = s.trim().to_lowercase();
        if !p.is_empty() {
          normalized.insert(p);
        }
      }
      None => warnings.push(format!("Non-string permission in {}", manifest_path.display())),
    }
  }

  (normalized.into_iter().collect(), warnings)
}

/// The parent-environment variables a plugin without the `env` permission
/// inherits: the `BASELINE_ENV_VARS` that are set, looked up through `lookup` so
/// tests need not touch the real environment.
fn baseline_plugin_env(lookup: impl Fn(&str) -> Option<String>) -> Vec<(&'static str, String)> {
  BASELINE_ENV_VARS
    .iter()
    .filter_map(|var| lookup(var).map(|value| (*var, value)))
    .collect()
}

/// Whether the plugin's approved manifest permissions grant full environment
/// access. When they do not, `spawn_deno_process` clears the plugin's OS
/// environment down to `BASELINE_ENV_VARS`, which covers both `Deno.env` and any
/// child process the plugin spawns via the `run` permission.
fn manifest_grants_env(permissions: &[String]) -> bool {
  permissions.iter().any(|p| p == "env" || p == "all")
}

fn build_deno_permission_args(plugin_dir: &Path, permissions: &[String], port: u16) -> Vec<String> {
  let mut flags: Vec<String> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();
  let mut net_scopes: HashSet<String> = HashSet::new();
  let mut allow_all_net = false;
  // Baseline runtime capability, not a manifest permission. Deno needs unscoped
  // --allow-env because npm dependencies enumerate process.env on import. What the
  // plugin can actually read is limited by clearing its OS environment in
  // spawn_deno_process unless the manifest asks for "env". User-approved plugin
  // permissions are read from manifest.json and applied further down.
  flags.push("--allow-env".to_string());
  seen.insert("--allow-env".to_string());
  let mut allow_sys_all = false;
  let mut sys_scopes: HashSet<String> = HashSet::new();
  sys_scopes.insert("homedir".to_string());
  sys_scopes.insert("uid".to_string());
  sys_scopes.insert("gid".to_string());
  sys_scopes.insert("userInfo".to_string());

  let mut path_variants: Vec<String> = Vec::new();
  let original = plugin_dir.to_string_lossy().to_string();
  path_variants.push(original.clone());
  path_variants.push(original.replace("\\", "/"));

  if let Ok(canon) = plugin_dir.canonicalize() {
    let canon_str = canon.to_string_lossy().to_string();
    path_variants.push(canon_str.clone());
    path_variants.push(canon_str.replace("\\", "/"));
    if let Some(stripped) = canon_str.strip_prefix(r"\\?\") {
      let stripped_owned = stripped.to_string();
      path_variants.push(stripped_owned.clone());
      path_variants.push(stripped_owned.replace("\\", "/"));
    }
  }

  let mut seen_paths: HashSet<String> = HashSet::new();
  for p in path_variants {
    if seen_paths.insert(p.clone()) {
      let read_flag = format!("--allow-read={}", p);
      let write_flag = format!("--allow-write={}", p);
      if seen.insert(read_flag.clone()) {
        flags.push(read_flag);
      }
      if seen.insert(write_flag.clone()) {
        flags.push(write_flag);
      }
    }
  }

  net_scopes.insert(format!("127.0.0.1:{}", port));
  net_scopes.insert(format!("localhost:{}", port));

  for perm in permissions {
    let flag = match perm.as_str() {
      "net" | "network" => {
        allow_all_net = true;
        None
      }
      // Handled in spawn_deno_process by not clearing the environment.
      "env" => None,
      "run" => Some("--allow-run".to_string()),
      "ffi" => Some("--allow-ffi".to_string()),
      "sys" => {
        allow_sys_all = true;
        None
      }
      "read" => Some("--allow-read".to_string()),
      "write" => Some("--allow-write".to_string()),
      "hrtime" => Some("--allow-hrtime".to_string()),
      "all" => Some("--allow-all".to_string()),
      _ => None,
    };

    if let Some(f) = flag {
      if seen.insert(f.clone()) {
        flags.push(f);
      }
    }
  }

  if allow_all_net {
    if seen.insert("--allow-net".to_string()) {
      flags.push("--allow-net".to_string());
    }
  } else if !net_scopes.is_empty() {
    let joined = net_scopes.into_iter().collect::<Vec<String>>().join(",");
    let scoped = format!("--allow-net={}", joined);
    if seen.insert(scoped.clone()) {
      flags.push(scoped);
    }
  }

  if allow_sys_all {
    if seen.insert("--allow-sys".to_string()) {
      flags.push("--allow-sys".to_string());
    }
  } else if !sys_scopes.is_empty() {
    let joined = sys_scopes.into_iter().collect::<Vec<String>>().join(",");
    let scoped = format!("--allow-sys={}", joined);
    if seen.insert(scoped.clone()) {
      flags.push(scoped);
    }
  }

  flags
}

async fn is_running(app_handle: &AppHandle, plugin_id: &str) -> bool {
  reap_exited_processes(app_handle).await;
  let table = process_table();
  let map = table.read().await;
  map.contains_key(plugin_id)
}

#[cfg(unix)]
fn exit_signal(status: &std::process::ExitStatus) -> Option<String> {
  use std::os::unix::process::ExitStatusExt;
  status.signal().map(|signal| signal.to_string())
}

#[cfg(not(unix))]
fn exit_signal(_status: &std::process::ExitStatus) -> Option<String> {
  None
}

async fn reap_exited_processes(app_handle: &AppHandle) {
  let table = process_table();
  let mut map = table.write().await;

  let mut exited_plugins: Vec<(String, Option<i32>, Option<String>)> = Vec::new();
  for (id, child) in map.iter_mut() {
    match child.try_wait() {
      Ok(Some(status)) => {
        info!("Plugin {} exited with status {}", id, status);
        exited_plugins.push((id.clone(), status.code(), exit_signal(&status)));
      }
      Ok(None) => {}
      Err(e) => {
        warn!("Failed to inspect plugin {} process state: {}", id, e);
        exited_plugins.push((id.clone(), None, None));
      }
    }
  }

  for (id, exit_code, signal) in exited_plugins {
    map.remove(&id);
    let expected = {
      let expected_exits = expected_process_exits();
      let mut expected_map = expected_exits.write().await;
      expected_map.remove(&id)
    };
    emit_plugin_lifecycle(
      app_handle,
      &id,
      "exited",
      None,
      exit_code,
      signal,
      Some(expected),
    );
  }
}

fn ensure_process_reaper_started(app_handle: AppHandle) {
  PROCESS_REAPER_STARTED.get_or_init(|| {
    let app_handle = app_handle.clone();
    tokio::spawn(async move {
      loop {
        reap_exited_processes(&app_handle).await;
        tokio::time::sleep(std::time::Duration::from_secs(PROCESS_REAPER_INTERVAL_SECS)).await;
      }
    });
  });
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

fn normalized_plugin_platform() -> String {
  let os = if cfg!(target_os = "windows") {
    "windows"
  } else if cfg!(target_os = "macos") {
    "macos"
  } else if cfg!(target_os = "linux") {
    "linux"
  } else {
    std::env::consts::OS
  };

  let arch = match std::env::consts::ARCH {
    "x86_64" => "x64",
    "aarch64" => "arm64",
    other => other,
  };

  format!("{}-{}", os, arch)
}

async fn spawn_deno_process(app_handle: &AppHandle, dir: &Path, plugin_id: &str) -> Result<tokio::process::Child, String> {
  let manifest_path = dir.join("manifest.json");

  // Full manifest validation — reject invalid plugins before spawning.
  let validated = validate_manifest(&manifest_path).map_err(|errs| {
    format!("Plugin {} has an invalid manifest:\n  - {}", plugin_id, errs.join("\n  - "))
  })?;

  let entry_path = dir.join(&validated.main);
  if !entry_path.exists() {
    return Err(format!(
      "Entry point {} not found for plugin {}",
      validated.main.display(),
      plugin_id
    ));
  }

  let manifest = read_manifest_info(&manifest_path)?;

  // Get the active plugin server port
  let port = get_active_port();
  if port == 0 {
    warn!("Plugin server port not yet available, using default 3001 for plugin {}", plugin_id);
  }
  let safe_port = if port > 0 { port } else { 3001 };
  let port_str = safe_port.to_string();

  let (manifest_permissions, manifest_warnings) = read_permissions_from_manifest(dir);
  for w in manifest_warnings {
    warn!("{}", w);
  }
  let permission_flags = build_deno_permission_args(dir, &manifest_permissions, safe_port);
  let plugin_dir = dir.to_string_lossy().to_string();
  let platform_id = normalized_plugin_platform();

  // Spawn `deno run ... <manifest.main>` with stdout/stderr piped
  let deno_bin = resolve_deno_path(app_handle).unwrap_or_else(|| PathBuf::from("deno"));
  let mut cmd = Command::new(deno_bin);
  #[cfg(target_os = "windows")]
  cmd.creation_flags(CREATE_NO_WINDOW);

  cmd.arg("run")
    .arg("--unstable-detect-cjs");

  for flag in &permission_flags {
    cmd.arg(flag);
  }

  // Deno gets unscoped --allow-env (see build_deno_permission_args), so the
  // process environment is the boundary. Without a manifest-approved `env`
  // permission, clear it down to the baseline so neither Deno.env nor a child
  // process spawned via `run` can see the user's other variables.
  if !manifest_grants_env(&manifest_permissions) {
    cmd.env_clear();
    cmd.envs(baseline_plugin_env(|var| std::env::var(var).ok()));
  }

  cmd.arg(&manifest.main)
    .current_dir(dir)
    .env("DOTX_PLUGIN_ID", plugin_id)
    .env("DOTX_PLUGIN_DIR", &plugin_dir)
    .env("DOTX_PLUGIN_PLATFORM", &platform_id)
    .env("DOTX_PLUGIN_PORT", &port_str)
    .stdin(std::process::Stdio::null())
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::piped());

  info!("Starting plugin {} with port {}", plugin_id, port_str);
  cmd.spawn().map_err(|e| format!("Failed to start Deno for {}: {}", plugin_id, e))
}

async fn start_plugin_internal(app_handle: &AppHandle, plugin_id: &str) -> Result<(), String> {
  ensure_process_reaper_started(app_handle.clone());

  if is_running(app_handle, plugin_id).await {
    return Ok(());
  }

  ensure_plugin_server_running(app_handle).await?;

  emit_plugin_lifecycle(app_handle, plugin_id, "starting", None, None, None, Some(false));

  let dir = match find_plugin_dir_by_id(app_handle, plugin_id) {
    Some(dir) => dir,
    None => {
      let error = format!("Plugin {} not found", plugin_id);
      emit_plugin_lifecycle(app_handle, plugin_id, "start_failed", Some(error.clone()), None, None, Some(false));
      return Err(error);
    }
  };

  let mut child = match spawn_deno_process(app_handle, &dir, plugin_id).await {
    Ok(child) => child,
    Err(error) => {
      emit_plugin_lifecycle(app_handle, plugin_id, "start_failed", Some(error.clone()), None, None, Some(false));
      return Err(error);
    }
  };

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

async fn ensure_plugin_server_running(app_handle: &AppHandle) -> Result<u16, String> {
  let active_port = get_active_port();
  if active_port > 0 {
    return Ok(active_port);
  }

  start_plugin_server(app_handle.clone(), DEFAULT_PORT).await
}

async fn stop_plugin_internal(app_handle: &AppHandle, plugin_id: &str) -> Result<(), String> {
  let table = process_table();
  let mut map = table.write().await;
  if let Some(mut child) = map.remove(plugin_id) {
    if let Ok(Some(status)) = child.try_wait() {
      info!("Plugin {} was already stopped with status {}", plugin_id, status);
      emit_plugin_lifecycle(
        app_handle,
        plugin_id,
        "stopped",
        None,
        status.code(),
        exit_signal(&status),
        Some(true),
      );
      return Ok(());
    }

    // Try to terminate process
    if let Err(e) = child.kill().await {
      // It's possible the process already exited; log and continue
      error!("Failed to kill plugin {}: {}", plugin_id, e);
    }
    info!("Stopped plugin {}", plugin_id);
    emit_plugin_lifecycle(app_handle, plugin_id, "stopped", None, None, None, Some(true));
    
    // Note: We keep logs in memory even after plugin stops for debugging
    Ok(())
  } else {
    // Not running; treat as success
    emit_plugin_lifecycle(app_handle, plugin_id, "stopped", None, None, None, Some(true));
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
pub async fn stop_plugin(app_handle: AppHandle, plugin_id: String) -> Result<String, String> {
  stop_plugin_internal(&app_handle, &plugin_id).await?;
  Ok(format!("Plugin {} stopped", plugin_id))
}

#[tauri::command]
pub async fn restart_plugin(app_handle: AppHandle, plugin_id: String) -> Result<String, String> {
  let _ = stop_plugin_internal(&app_handle, &plugin_id).await; // ignore error if not running
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

fn frontend_ready_notify() -> &'static Notify {
  FRONTEND_READY_NOTIFY.get_or_init(Notify::new)
}

/// Called from the frontend (`notify_frontend_ready`) once PluginAPI's event
/// listeners are live. Idempotent.
fn mark_frontend_ready() {
  FRONTEND_READY.store(true, Ordering::Release);
  frontend_ready_notify().notify_waiters();
}

/// Resolve once the frontend has signalled ready, or after a fallback timeout.
async fn wait_for_frontend_ready() {
  if FRONTEND_READY.load(Ordering::Acquire) {
    return;
  }
  let notified = frontend_ready_notify().notified();
  tokio::pin!(notified);
  // Register as a waiter before the final flag check so a concurrent
  // mark_frontend_ready() can't slip between the check and the await.
  notified.as_mut().enable();
  if FRONTEND_READY.load(Ordering::Acquire) {
    return;
  }
  tokio::select! {
    _ = notified => info!("Frontend ready; proceeding with plugin auto-start"),
    _ = tokio::time::sleep(std::time::Duration::from_secs(FRONTEND_READY_TIMEOUT_SECS)) => {
      warn!("Frontend not ready after {}s; auto-starting plugins anyway", FRONTEND_READY_TIMEOUT_SECS);
    }
  }
}

pub fn auto_start_enabled_plugins(app_handle: AppHandle) {
  tauri::async_runtime::spawn(async move {
    match ensure_plugin_server_running(&app_handle).await {
      Ok(port) => info!("Plugin server ready on port {} before plugin auto-start", port),
      Err(e) => {
        error!("Failed to start plugin server before plugin auto-start: {}", e);
        return;
      }
    }

    // Wait for the frontend's plugin API listeners before starting plugins, so
    // a plugin's onLoad blocking-UI call isn't dropped (see FRONTEND_READY).
    wait_for_frontend_ready().await;

    match start_enabled_plugins(app_handle).await {
      Ok(count) => info!("Auto-started {} enabled plugins", count),
      Err(e) => error!("Failed to auto-start plugins: {}", e),
    }
  });
}

#[tauri::command]
pub fn notify_frontend_ready() {
  mark_frontend_ready();
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

#[cfg(test)]
mod tests {
  use super::{baseline_plugin_env, build_deno_permission_args, check_dotx_version_against, manifest_grants_env};
  use std::path::Path;

  fn flags_for(permissions: &[&str]) -> Vec<String> {
    let owned: Vec<String> = permissions.iter().map(|p| p.to_string()).collect();
    build_deno_permission_args(Path::new("C:\\plugins\\example"), &owned, 9001)
  }

  fn owned(permissions: &[&str]) -> Vec<String> {
    permissions.iter().map(|p| p.to_string()).collect()
  }

  #[test]
  fn manifest_without_env_or_all_does_not_grant_env() {
    assert!(!manifest_grants_env(&owned(&[])));
    assert!(!manifest_grants_env(&owned(&["run", "net"])));
  }

  #[test]
  fn manifest_env_permission_grants_env() {
    assert!(manifest_grants_env(&owned(&["env"])));
  }

  #[test]
  fn manifest_all_permission_grants_env() {
    assert!(manifest_grants_env(&owned(&["all"])));
  }

  #[test]
  fn deno_always_gets_unscoped_allow_env() {
    // npm's `debug` enumerates process.env on import, which Deno only allows with
    // the unscoped flag; the environment itself is scrubbed at spawn instead.
    for permissions in [&[][..], &["env"][..], &["run", "net"][..]] {
      let flags = flags_for(permissions);
      assert_eq!(flags.iter().filter(|f| *f == "--allow-env").count(), 1, "{:?}", flags);
      assert!(!flags.iter().any(|f| f.starts_with("--allow-env=")), "{:?}", flags);
    }
  }

  #[test]
  fn baseline_env_drops_variables_outside_the_allowlist() {
    let env = baseline_plugin_env(|var| match var {
      "SYSTEMROOT" => Some("C:\\Windows".to_string()),
      "NODE_ENV" => Some("production".to_string()),
      "DOTX_TEST_SECRET" | "GITHUB_TOKEN" => Some("secret".to_string()),
      _ => None,
    });

    assert_eq!(env, vec![("SYSTEMROOT", "C:\\Windows".to_string()), ("NODE_ENV", "production".to_string())]);
  }

  #[test]
  fn baseline_env_keeps_what_deno_needs_to_reach_the_plugin_server() {
    // Without SYSTEMROOT, Winsock fails to initialise (os error 10106).
    let env = baseline_plugin_env(|var| Some(var.to_string()));
    assert!(env.iter().any(|(var, _)| *var == "SYSTEMROOT"), "{:?}", env);
  }

  #[test]
  fn all_permission_still_grants_allow_all() {
    let flags = flags_for(&["all"]);

    assert!(flags.iter().any(|f| f == "--allow-all"), "{:?}", flags);
  }

  fn errors_for(constraint: &str, app_version: &str) -> Vec<String> {
    let mut errors = Vec::new();
    check_dotx_version_against(constraint, app_version, &mut errors);
    errors
  }

  #[test]
  fn prerelease_app_satisfies_lower_bound() {
    assert!(errors_for(">=1.0.0", "2.0.0-1").is_empty());
  }

  #[test]
  fn prerelease_app_is_treated_as_its_release() {
    assert!(errors_for(">=2.0.0", "2.0.0-1").is_empty());
    assert!(errors_for("^2.0.0", "2.0.0-1").is_empty());
  }

  #[test]
  fn rejects_app_older_than_requirement() {
    assert_eq!(errors_for(">=3.0.0", "2.0.0-1").len(), 1);
    assert_eq!(errors_for(">=2.1.0", "2.0.0").len(), 1);
  }

  #[test]
  fn rejects_invalid_requirement() {
    assert_eq!(errors_for("not-a-range", "2.0.0").len(), 1);
  }
}
