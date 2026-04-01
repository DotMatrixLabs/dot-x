// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{error, info, trace};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, Wry};
use std::fs;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
use hex;
use windows_volume_control::{AudioController, CoinitMode};
use tauri_plugin_autostart::MacosLauncher;
use midir::{MidiOutput};
use std::collections::HashMap;
use std::fmt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
mod decker;
mod midi;
mod power_monitor;
mod plugin_server;
mod plugin_runtime;
use plugin_runtime::{resolve_plugins_dir, ensure_plugins_dir, find_plugin_dir_by_id, normalize_manifest_main_path, read_manifest_info, validate_manifest};
use semver;
use once_cell::sync::OnceCell;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
#[cfg(target_os = "windows")]
use window_vibrancy::{apply_blur, apply_mica};

use active_win_pos_rs::get_active_window;
use brightness::{Brightness, BrightnessDevice};
use chrono::Local;
use futures::TryStreamExt;
use sentry::{self, Client};
use std::thread;
use std::time::Duration;
use tauri_plugin_aptabase::EventTracker;
use tauri_plugin_cli::CliExt;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

static APP: OnceCell<tauri::AppHandle> = OnceCell::new();

// create the error type that represents all errors possible in our program
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    SessionNotFound,
    Connection,
    InitError,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Error::Io(inner) => write!(f, "IO Error: {}", inner),
            Error::SessionNotFound => write!(f, "Session not found"),
            Error::Connection => write!(f, "Decker error"),
            Error::InitError => write!(f, "Initialization error"),
        }
    }
}

// we must manually implement serde::Serialize
impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[derive(serde::Serialize)]
struct CustomResponse {
    app_list: Vec<String>,
}

#[derive(serde::Serialize)]
struct ControllerResponse {
    response: Vec<String>,
}

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[derive(serde::Serialize)]
struct MidiPortNames {
    names: Vec<String>,
}

#[tauri::command]
fn list_installed_plugins(app_handle: AppHandle) -> Result<Vec<serde_json::Value>, String> {
    // Collect all directories to scan, deduplicating by canonical path.
    // We scan both resolve_plugins_dir (dev/bundled plugins) and
    // ensure_plugins_dir (app_data_dir, where marketplace installs land)
    // so that plugins from either location are always listed.
    let mut dirs_to_scan: Vec<PathBuf> = Vec::new();

    if let Some(dir) = resolve_plugins_dir(&app_handle) {
        dirs_to_scan.push(dir);
    }
    if let Ok(dir) = ensure_plugins_dir(&app_handle) {
        let canonical = dir.canonicalize().unwrap_or_else(|_| dir.clone());
        let already = dirs_to_scan.iter().any(|d| {
          d.canonicalize().unwrap_or_else(|_| d.clone()) == canonical
        });
        if !already {
            dirs_to_scan.push(dir);
        }
    }

    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut results: Vec<serde_json::Value> = Vec::new();

    for plugins_dir in dirs_to_scan {
        let read_dir = match fs::read_dir(&plugins_dir) {
            Ok(d) => d,
            Err(_) => continue,
        };
        for entry_result in read_dir {
            let entry = match entry_result { Ok(e) => e, Err(_) => continue };
            let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };
            if !metadata.is_dir() { continue; }

            let folder_path = entry.path();
            let manifest_path = folder_path.join("manifest.json");
            if !manifest_path.exists() { continue; }

            let manifest_info = match read_manifest_info(&manifest_path) {
                Ok(info) => info,
                Err(_) => continue,
            };
            if !folder_path.join(&manifest_info.main).exists() { continue; }

            let manifest_str = match fs::read_to_string(&manifest_path) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let mut manifest_json: serde_json::Value = match serde_json::from_str(&manifest_str) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let id = manifest_info.id
                .unwrap_or_else(|| entry.file_name().to_string_lossy().to_string());

            // Skip duplicates (same plugin in both directories)
            if seen_ids.contains(&id) { continue; }
            seen_ids.insert(id.clone());

            if manifest_json.get("id").and_then(|v| v.as_str()).is_none() {
                if let Some(obj) = manifest_json.as_object_mut() {
                    obj.insert("id".to_string(), serde_json::Value::String(id));
                }
            }
            if let Some(obj) = manifest_json.as_object_mut() {
                obj.insert("_hasEntryPoint".to_string(), serde_json::Value::Bool(true));
                obj.insert(
                    "_entryPoint".to_string(),
                    serde_json::Value::String(manifest_info.main.to_string_lossy().to_string())
                );
            }

            // Run full manifest validation and attach results.
            let validation_errors: Vec<String> = match validate_manifest(&manifest_path) {
                Ok(_) => Vec::new(),
                Err(errs) => errs,
            };
            if let Some(obj) = manifest_json.as_object_mut() {
                obj.insert(
                    "_validationErrors".to_string(),
                    serde_json::Value::Array(
                        validation_errors.iter().map(|e| serde_json::Value::String(e.clone())).collect()
                    ),
                );
            }

            results.push(manifest_json);
        }
    }

    Ok(results)
}

#[tauri::command]
fn get_plugins_folder(app_handle: AppHandle) -> Result<String, String> {
    let plugins_dir = ensure_plugins_dir(&app_handle)?;
    Ok(plugins_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_plugins_folder(app_handle: AppHandle) -> Result<(), String> {
  let plugins_dir = ensure_plugins_dir(&app_handle)?;
  use tauri_plugin_shell::ShellExt;
  // Shell open is deprecated, but we'll use it for now
  let _ = app_handle.shell().open(plugins_dir.to_string_lossy().to_string(), None);
  Ok(())
}

fn download_bytes_with_progress(
    client: &reqwest::blocking::Client,
    url: &str,
    stage: &str,
    progress_start: u8,
    progress_end: u8,
    emit_progress: &impl Fn(&str, u8),
) -> Result<Vec<u8>, String> {
    let mut response = client
        .get(url)
        .send()
        .map_err(|e| format!("Failed to download package: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download package: HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut buf = Vec::new();
    let mut chunk = [0u8; 8192];
    let mut downloaded: u64 = 0;

    emit_progress(stage, progress_start);
    loop {
        let n = response
            .read(&mut chunk)
            .map_err(|e| format!("Error reading package: {}", e))?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
        downloaded += n as u64;
        if total > 0 {
            let span = progress_end.saturating_sub(progress_start) as f64;
            let pct = progress_start as f64 + (downloaded as f64 / total as f64) * span;
            emit_progress(stage, pct.round().clamp(progress_start as f64, progress_end as f64) as u8);
        }
    }
    emit_progress(stage, progress_end);

    Ok(buf)
}

fn calculate_sha256_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("sha256-{}", hex::encode(hasher.finalize()))
}

/// Validate a marketplace manifest. Delegates to the shared `validate_manifest`
/// for field/compat checks, then verifies the id matches the expected plugin_id.
///
/// `manifest_path` is used for the shared validator; `plugin_id` is the
/// registry-provided id that the manifest must match.
fn validate_marketplace_manifest_at_path(manifest_path: &Path, plugin_id: &str) -> Result<PathBuf, String> {
    let validated = validate_manifest(manifest_path).map_err(|errs| errs.join("; "))?;

    let manifest_id = validated.id
        .ok_or_else(|| "manifest.json is missing a string \"id\" field".to_string())?;
    if manifest_id != plugin_id {
        return Err(format!(
            "Manifest id '{}' does not match plugin id '{}'",
            manifest_id, plugin_id
        ));
    }

    Ok(validated.main)
}

/// In-memory variant for the zip inspection path where we only have parsed JSON
/// (no file path). Performs the same field checks.
fn validate_marketplace_manifest(manifest_json: &Value, plugin_id: &str) -> Result<PathBuf, String> {
    let manifest_id = manifest_json
        .get("id")
        .and_then(|id| id.as_str())
        .ok_or_else(|| "manifest.json is missing a string \"id\" field".to_string())?;
    if manifest_id != plugin_id {
        return Err(format!(
            "Manifest id '{}' does not match plugin id '{}'",
            manifest_id, plugin_id
        ));
    }

    // Required string fields
    for field in &["name", "version", "description", "author", "dotxVersion"] {
        match manifest_json.get(*field).and_then(|v| v.as_str()) {
            Some(s) if !s.trim().is_empty() => {}
            _ => return Err(format!("manifest.json is missing a non-empty string \"{}\" field", field)),
        }
    }

    // version must be valid semver
    if let Some(v) = manifest_json.get("version").and_then(|v| v.as_str()) {
        if semver::Version::parse(v).is_err() {
            return Err(format!("\"version\" value \"{}\" is not valid semver", v));
        }
    }

    // dotxVersion compatibility check
    if let Some(constraint_str) = manifest_json.get("dotxVersion").and_then(|v| v.as_str()) {
        let app_version_str = env!("CARGO_PKG_VERSION");
        if let Ok(app_version) = semver::Version::parse(app_version_str) {
            if let Ok(req) = semver::VersionReq::parse(constraint_str) {
                if !req.matches(&app_version) {
                    return Err(format!(
                        "Plugin requires dotxVersion {} but the current app version is {}",
                        constraint_str, app_version_str
                    ));
                }
            } else {
                return Err(format!(
                    "\"dotxVersion\" value \"{}\" is not a valid semver requirement", constraint_str
                ));
            }
        }
    }

    // permissions must be an array of strings
    let permissions = manifest_json
        .get("permissions")
        .and_then(|p| p.as_array())
        .ok_or_else(|| "manifest.json is missing a \"permissions\" array".to_string())?;
    if permissions.iter().any(|entry| !entry.is_string()) {
        return Err("manifest.json permissions must contain only strings".to_string());
    }

    let main_raw = manifest_json
        .get("main")
        .and_then(|main| main.as_str())
        .ok_or_else(|| "manifest.json is missing a string \"main\" field".to_string())?;
    let main_path = normalize_manifest_main_path(main_raw)?;

    Ok(main_path)
}

fn inspect_plugin_zip(package_bytes: &[u8]) -> Result<(), String> {
    let reader = Cursor::new(package_bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Failed to read plugin zip: {}", e))?;

    let mut has_manifest = false;
    let mut manifest_content: Option<String> = None;
    let mut archive_paths: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("Zip entry error: {}", e))?;
        if file.is_dir() {
            continue;
        }

        let entry_path = file
            .enclosed_name()
            .ok_or_else(|| "Plugin zip contains an invalid path".to_string())?;
        archive_paths.insert(entry_path.to_path_buf());

        if entry_path == Path::new("manifest.json") {
            has_manifest = true;
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| format!("Failed to read manifest.json from zip: {}", e))?;
            manifest_content = Some(contents);
        }
    }

    if !has_manifest {
        return Err("Plugin zip must contain manifest.json at the archive root".to_string());
    }
    let manifest_json: Value = serde_json::from_str(
        manifest_content
            .as_deref()
            .ok_or_else(|| "Plugin zip is missing readable manifest.json at the archive root".to_string())?
    )
    .map_err(|e| format!("Failed to parse manifest.json from zip: {}", e))?;
    let main_path = validate_marketplace_manifest(
        &manifest_json,
        manifest_json
            .get("id")
            .and_then(|id| id.as_str())
            .ok_or_else(|| "manifest.json is missing a string \"id\" field".to_string())?,
    )?;
    if !archive_paths.contains(&main_path) {
        return Err(format!(
            "Plugin zip must contain {} as declared by manifest.json main",
            main_path.display()
        ));
    }

    Ok(())
}

fn extract_plugin_zip(package_bytes: &[u8], destination: &Path) -> Result<(), String> {
    let reader = Cursor::new(package_bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("Failed to read plugin zip: {}", e))?;

    fs::create_dir_all(destination)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;

    for i in 0..archive.len() {
        let mut zipped_file = archive.by_index(i).map_err(|e| format!("Zip entry error: {}", e))?;
        let entry_path = zipped_file
            .enclosed_name()
            .ok_or_else(|| "Plugin zip contains an invalid path".to_string())?
            .to_owned();
        let out_path = destination.join(&entry_path);

        if zipped_file.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Create dir failed: {}", e))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Create dir failed: {}", e))?;
        }

        let mut outfile = File::create(&out_path).map_err(|e| format!("Create file failed: {}", e))?;
        std::io::copy(&mut zipped_file, &mut outfile).map_err(|e| format!("Write file failed: {}", e))?;

        #[cfg(unix)]
        {
            let mut mode = zipped_file.unix_mode().unwrap_or(0o644);
            if entry_path.starts_with("bin/") {
                mode |= 0o755;
            }
            fs::set_permissions(&out_path, fs::Permissions::from_mode(mode))
                .map_err(|e| format!("Failed to set permissions on {}: {}", out_path.display(), e))?;
        }
    }

    Ok(())
}

fn validate_extracted_plugin_dir(plugin_dir: &Path, plugin_id: &str) -> Result<(), String> {
    let manifest_path = plugin_dir.join("manifest.json");

    if !manifest_path.exists() {
        return Err("Extracted plugin is missing manifest.json at the plugin root".to_string());
    }

    let main_path = validate_marketplace_manifest_at_path(&manifest_path, plugin_id)?;
    if !plugin_dir.join(&main_path).exists() {
        return Err(format!(
            "Extracted plugin is missing {} as declared by manifest.json main",
            main_path.display()
        ));
    }

    Ok(())
}

fn approval_entry_matches_plugin_id(entry: &Value, plugin_id: &str) -> bool {
    if entry.as_str() == Some(plugin_id) {
        return true;
    }

    let Some(object) = entry.as_object() else {
        return false;
    };

    object
        .get("pluginId")
        .or_else(|| object.get("id"))
        .and_then(|value| value.as_str())
        == Some(plugin_id)
}

#[tauri::command]
async fn install_marketplace_plugin(app_handle: AppHandle, plugin_id: String, registry_url: String) -> Result<(), String> {
    // Stop any running instance before replacing files.
    let _ = plugin_runtime::stop_plugin(plugin_id.clone()).await;

    // Resolve paths before entering the blocking thread.
    // Always install to app_data_dir/plugins (the writable user data location).
    let plugins_dir = ensure_plugins_dir(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("App data dir not available: {}", e))?;

    // Emit the very first progress event from the async context
    let _ = app_handle.emit("plugin-install-progress", json!({
          "pluginId": &plugin_id, "stage": "fetching_registry", "progress": 0u8,
    }));

    tokio::task::spawn_blocking(move || {
        let emit_progress = |stage: &str, progress: u8| {
            let _ = app_handle.emit("plugin-install-progress", json!({
                "pluginId": &plugin_id,
                "stage": stage,
                "progress": progress,
            }));
        };

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let response = client
            .get(&registry_url)
            .send()
            .map_err(|e| format!("Failed to fetch registry: {}", e))?;
        let registry: Value = response
            .json()
            .map_err(|e| format!("Failed to parse registry: {}", e))?;
        emit_progress("fetching_registry", 5u8);

        let plugins = registry
            .get("plugins")
            .and_then(|p| p.as_array())
            .ok_or_else(|| "Registry plugins array not found".to_string())?;

        let plugin_entry = plugins
            .iter()
            .find(|p| p.get("id").and_then(|id| id.as_str()) == Some(plugin_id.as_str()))
            .ok_or_else(|| format!("Plugin {} not found in registry", plugin_id))?;

        let package_format = plugin_entry
            .get("package_format")
            .and_then(|f| f.as_str())
            .ok_or_else(|| "package_format not found in registry".to_string())?;
        if package_format != "zip" {
            return Err(format!("Unsupported package_format '{}'", package_format));
        }

        let package_url = plugin_entry
            .get("package_url")
            .and_then(|u| u.as_str())
            .ok_or_else(|| "package_url not found in registry".to_string())?
            .to_string();
        let expected_hash = plugin_entry
            .get("package_integrity_hash")
            .and_then(|h| h.as_str())
            .ok_or_else(|| "package_integrity_hash not found in registry".to_string())?
            .to_string();

        let temp_base = app_data_dir.join("plugins").join(".tmp");
        fs::create_dir_all(&temp_base)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        let temp_dir = temp_base.join(format!(
            "{}-{}",
            plugin_id,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        ));
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp plugin directory: {}", e))?;
        let extracted_dir = temp_dir.join("plugin");

        let result: Result<(), String> = (|| {
            info!("Downloading plugin package from {}", package_url);
            let package_bytes = download_bytes_with_progress(
                &client,
                &package_url,
                "downloading_package",
                5,
                75,
                &emit_progress,
            )?;

            emit_progress("verifying_package", 80);
            let computed_hash = calculate_sha256_bytes(&package_bytes);
            if computed_hash != expected_hash {
                return Err("Integrity check failed: downloaded package does not match the expected checksum. Please try again.".to_string());
            }
            inspect_plugin_zip(&package_bytes)?;

            emit_progress("extracting_package", 85);
            extract_plugin_zip(&package_bytes, &extracted_dir)?;

            emit_progress("validating_package", 92);
            validate_extracted_plugin_dir(&extracted_dir, &plugin_id)?;

            emit_progress("installing", 96);
            let plugin_dir = plugins_dir.join(&plugin_id);
            if plugin_dir.exists() {
                info!("Removing existing plugin directory: {}", plugin_dir.display());
                fs::remove_dir_all(&plugin_dir)
                    .map_err(|e| format!("Failed to remove existing plugin directory: {}", e))?;
            }

            fs::rename(&extracted_dir, &plugin_dir)
                .map_err(|e| format!("Failed to install extracted plugin directory: {}", e))?;

            emit_progress("done", 100);
            info!("Successfully installed plugin: {}", plugin_id);
            Ok(())
        })();

        let _ = fs::remove_dir_all(&temp_dir);
        result
    }).await.unwrap_or_else(|e| Err(format!("Install task failed: {}", e)))?;
    Ok(())
}

#[tauri::command]
async fn uninstall_marketplace_plugin(app_handle: AppHandle, plugin_id: String) -> Result<(), String> {
    // Stop plugin if running
    let _ = plugin_runtime::stop_plugin(plugin_id.clone()).await;

    // Find plugin directory (search all candidate locations, same as list_installed_plugins)
    let plugin_dir = find_plugin_dir_by_id(&app_handle, &plugin_id)
        .ok_or_else(|| format!("Plugin {} not found", plugin_id))?;

    // Remove plugin directory
    fs::remove_dir_all(&plugin_dir)
        .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;

    // Remove from plugin config state
    let path_resolver = app_handle.path();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(p) = path_resolver.app_data_dir() {
        candidates.push(p.join("plugins.json"));
    }
    if let Ok(p) = path_resolver.app_config_dir() {
        candidates.push(p.join("plugins.json"));
    }

    for config_path in candidates {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(mut config) = serde_json::from_str::<Value>(&content) {
                let mut changed = false;

                if let Some(enabled) = config.get_mut("enabled").and_then(|e| e.as_array_mut()) {
                    let len_before = enabled.len();
                    enabled.retain(|v| v.as_str() != Some(&plugin_id));
                    changed |= enabled.len() != len_before;
                  }

                  if let Some(approved) = config.get_mut("approved").and_then(|a| a.as_array_mut()) {
                      let len_before = approved.len();
                      approved.retain(|value| !approval_entry_matches_plugin_id(value, &plugin_id));
                      changed |= approved.len() != len_before;
                  }

                if changed {
                    if let Ok(updated_content) = serde_json::to_string_pretty(&config) {
                        let _ = fs::write(&config_path, updated_content);
                    }
                }
            }
        }
    }

    info!("Successfully uninstalled plugin: {}", plugin_id);
    Ok(())
}


#[tauri::command]
fn get_available_midi_output_port_names() -> Result<MidiPortNames, Error> {
    let mut available_ports: Vec<String> = Vec::new();

    // Explicitly handle the error and convert it to Box<dyn Error>
    let midi_out_result = MidiOutput::new("Decker Output");

    let midi_out = match midi_out_result {
        Ok(midi_out) => midi_out,
        Err(_error) => {
            // Handle the error here, or return it if you prefer.
            return Err(Error::InitError);
        }
    };

    let output_ports_result = midi::midi::get_available_output_ports();
    let output_ports = match output_ports_result {
        Ok(output_ports) => output_ports,
        Err(_error) => {
            // Handle the error here, or return it if you prefer.
            return Err(Error::InitError);
        }
    };

    for (_i, p) in output_ports.iter().enumerate() {
        let port_name_result = midi_out.port_name(p);
        let _port_name = match port_name_result {
            Ok(port_name) => available_ports.push(port_name),
            Err(error) => {
                // Handle the error here, or return it if you prefer.
                error!("Dot X Error: {:?}", error);
                return Err(Error::InitError);
            }
        };
    }

    let available_ports_response = MidiPortNames {
        names: available_ports,
    };
    Ok(available_ports_response)
}

#[tauri::command]
fn get_installed_apps() -> Result<CustomResponse, Error> {
    let apps = installed::list().expect("list apps");
    let mut app_list = Vec::new();
    for app in apps {
        // metadata accessor fns, these are only evaluated when used
        let name = app.name().to_string();
        app_list.push(name);
    }
    // Create the Response struct
    let app_list_response = CustomResponse { app_list: app_list };
    Ok(app_list_response)
}

#[tauri::command]
fn get_all_session_names() -> Result<Vec<String>, Error> {
    unsafe {
        let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
        controller.GetSessions();
        controller.GetDefaultAudioEnpointVolumeControl();
        controller.GetAllProcessSessions();
        controller.GetAllAudioDevices();

        // Collect all session names
        let all_session_names = controller.get_all_session_names();

        Ok(all_session_names)
    }
}

fn value_to_i32_vec(value: &Value) -> Option<Vec<i32>> {
    if let Value::Array(array) = value {
        let mut i32_vec = Vec::new();

        for v in array {
            if let Some(i) = v.as_i64() {
                i32_vec.push(i as i32);
            } else {
                return None;
            }
        }

        Some(i32_vec)
    } else {
        None
    }
}

fn value_to_object_vec(value: &Value) -> Option<Vec<(String, String)>> {
    let mut object_vec = Vec::new();

    if let Value::Array(items) = value {
        object_vec = items
            .into_iter()
            .filter_map(|item| {
                if let Value::Object(obj) = item {
                    // Extract values from the object
                    let cc_value = obj
                        .get("CCValue")
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .unwrap_or_else(String::new); // If the value is null, return an empty string
                    let channel = obj
                        .get("channel")
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .unwrap_or_else(String::new); // If the value is null, return an empty string
                    // Return the tuple
                    Some((channel, cc_value))
                } else {
                    Some((String::new(), String::new())) // Create an empty tuple for the indexes containing Null
                }
            })
            .collect();
    } else {
        error!("Expected a JSON array.");
    }
    Some(object_vec)
}

#[tauri::command]
fn attach_midi_device(
    output_name: &str,
    output_port: u32,
    midi_sliders: Value,
    midi_configuration: Value,
) -> Result<(), Error> {
    let midi_sliders_vec = value_to_i32_vec(&midi_sliders).unwrap_or_default();
    let midi_configuration_vec = value_to_object_vec(&midi_configuration).unwrap_or_default();
    let midi_controller = midi::midi::new(
        "Decker",
        output_port,
        midi_sliders_vec,
        midi_configuration_vec,
    );
    match midi_controller {
        Ok(_midi_controller) => {
            info!("Midi port {}: Port name: {}", output_port, output_name);
            unsafe {
                midi::midi::ENABLED = true;
            }
        }
        Err(error) => {
            error!("[attach_midi_device] Dot X Error: {:?}", error);
            return Err(Error::Connection);
        }
    }
    Ok(())
}

#[tauri::command]
fn detach_midi_device() -> Result<(), Error> {
    unsafe {
        midi::midi::ENABLED = false;
    }
    Ok(())
}

#[tauri::command]
fn get_active_app_name() -> String {
    match get_active_window() {
        Ok(active_window) => {
            println!("Active window: {:?}", active_window);
            active_window.app_name.to_string()
        }
        Err(err) => {
            eprintln!("Failed to get active window: {:?}", err);
            "Unknown".to_string() // Return a default value if an error occurs
        }
    }
}

#[tauri::command]
fn set_application_volume(name: &str, volume: f32) -> Result<(), Error> {
    unsafe {
        let controller = get_initialized_audio_controller();

        // println!("All session names: {:?}", controller.get_all_session_names());

        // Get the current session by name
        let current_sessions = controller.get_sessions_by_name(name.to_string());

        //if multiple sessions are found, change the volume for all of them
        if !current_sessions.is_empty() {
            for session in current_sessions {
                println!("Setting volume for session: {}", name);
                println!("{}", session.getVolume().to_string());
                if volume < 0.01 {
                    session.setMute(true);
                    // Also set application volume to 0. This is not actually needed, but it's visually pleasing since the slider is at 0 and makes it easier to see which applications are muted.
                    session.setVolume(0.0);
                } else {
                    session.setMute(false);
                    session.setVolume(volume);
                }
            }
        } else {
            // Handle the case where the session was not found (e.g., return an error)
            return Err(Error::SessionNotFound);
        }
    }

    Ok(())
}

// Helper function to create and initialize an AudioController
unsafe fn get_initialized_audio_controller() -> AudioController {
    let mut controller = unsafe { AudioController::init(Some(CoinitMode::ApartmentThreaded)) };
    unsafe { controller.GetSessions(); }
    unsafe { controller.GetDefaultAudioEnpointVolumeControl(); }
    unsafe { controller.GetAllProcessSessions(); }
    unsafe { controller.GetAllAudioDevices(); }
    controller
}

#[tauri::command]
fn get_all_audio_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = get_initialized_audio_controller();
        let all_device_names = controller.get_all_device_names();
        println!("All device names: {:?}", all_device_names);
        Ok(all_device_names)
    }
}

#[tauri::command]
fn get_output_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = get_initialized_audio_controller();
        let output_device_names = controller.get_output_device_names();
        Ok(output_device_names)
    }
}

#[tauri::command]
fn get_input_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = get_initialized_audio_controller();
        let input_device_names = controller.get_input_device_names();
        Ok(input_device_names)
    }
}

#[tauri::command]
async fn set_screen_brightness(brightness: f32, screens: Value) -> Result<(), Error> {
    let _screen_names: Vec<String> = screens
        .as_array()
        .unwrap_or(&Vec::new())
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    // Set the screen brightness using the provided value
    set_brightness((brightness * 100.0) as u32).await;

    Ok(())
}

async fn set_brightness(percentage: u32) {
    println!("Setting brightness to {}%", percentage);
    if let Err(e) = brightness::brightness_devices()
        .try_for_each(|mut dev| async move {
            if let Err(err) = dev.set(percentage).await {
                eprintln!(
                    "Failed to set brightness for device {}: {:?}",
                    dev.device_name()
                        .await
                        .unwrap_or_else(|_| "Unknown".to_string()),
                    err
                );
            }
            Ok(())
        })
        .await
    {
        eprintln!("Error iterating over brightness devices: {:?}", e);
    }
}

async fn show_brightness(dev: &BrightnessDevice) -> Result<(), brightness::Error> {
    println!(
        "Brightness of device {} is {}%",
        dev.device_name().await?,
        dev.get().await?
    );
    Ok(())
}

#[tauri::command]
fn connect_decker(window: WebviewWindow, port_name: &str, inverted: bool) -> Result<(), Error> {
    println!(
        "Connecting Decker at port: {}, inverted: {}",
        port_name, inverted
    );
    decker::initialize_decker(window, port_name, inverted)?;
    info!("Decker connected at {}", port_name);
    Ok(())
}

#[tauri::command]
fn disconnect_decker() -> Result<(), Error> {
    decker::disconnect_decker();
    info!("Decker disconnected");
    Ok(())
}

fn build_tray(app: &tauri::AppHandle<Wry>) -> tauri::Result<(Menu<Wry>, TrayIcon<Wry>)> {
    let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
    let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show, &hide, &PredefinedMenuItem::separator(app)?, &quit])
        .build()?;

    let tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => {
                info!("Quitting Dot X");
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = app_handle.track_event("app_exited", None);
                });
                std::process::exit(0);
            }
            "hide" => {
                info!("Hiding Dot X");
                trace!("HIDING!");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "show" => {
                info!("Showing Dot X");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok((menu, tray))
}

fn show_notification(app: &tauri::AppHandle, title: &str, body: &str) {
    info!(
        "Showing notification || Title: {} | Message: {}",
        title, body
    );
    if let Err(err) = app.notification().builder().title(title).body(body).show() {
        error!("Failed to show notification: {err}");
    }
}

#[derive(Clone, serde::Serialize)]
struct InstancePayload {
    args: Vec<String>,
    cwd: String,
}

fn start_aptabase_heartbeat(app: tauri::AppHandle) {
    thread::spawn(move || {
        loop {
            let _ = app.track_event("app_heartbeat💓", None);
            thread::sleep(Duration::from_secs(1 * 60 * 59)); //heartbeat every hour (I'm concerned exactly 1 hour will make a new session, so I'm doing 59 minutes - you got a problem with that? That's what I thought.)
        }
    });
}

fn setup_panic_handler(client: Client) {
    std::panic::set_hook(Box::new(move |panic_info| {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let panic_message = format!("[{}] Panic occurred: {}", timestamp, panic_info);

        // Log using the log crate
        error!("{}", panic_message);

        // Also send to Sentry
        sentry::capture_message(&panic_message, sentry::Level::Fatal);

        client.flush(Some(std::time::Duration::from_secs(2)));
    }));
}

fn find_executable_recursive(base: &std::path::Path, name: &str) -> Option<std::path::PathBuf> {
    if let Ok(mut entries) = fs::read_dir(base) {
        while let Some(Ok(entry)) = entries.next() {
            let p = entry.path();
            if p.is_dir() {
                if let Some(found) = find_executable_recursive(&p, name) { return Some(found); }
            } else if let Some(fname) = p.file_name() {
                if fname.eq_ignore_ascii_case(name) { return Some(p); }
            }
        }
    }
    None
}

fn ensure_deno_extracted(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let path_resolver = app.path();
    let data_dir = path_resolver.app_data_dir().map_err(|e| format!("App data dir not available: {}", e))?;
    let deno_dir = data_dir.join("deno");
    let exe_name = if cfg!(target_os = "windows") { "deno.exe" } else { "deno" };
    let deno_exe_default = deno_dir.join(exe_name);
    if deno_exe_default.exists() {
        return Ok(deno_exe_default);
    }

    if let Some(found) = find_executable_recursive(&deno_dir, exe_name) { return Ok(found); }

    fs::create_dir_all(&deno_dir).map_err(|e| format!("Failed to create deno dir: {}", e))?;

    #[cfg(target_os = "windows")]
    let archive_rel = "resources/deno/deno-x86_64-pc-windows-msvc.zip";
    #[cfg(not(target_os = "windows"))]
    let archive_rel = "resources/deno/unsupported-platform"; // placeholder

    let archive_path = path_resolver.resolve(archive_rel, tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Bundled Deno archive not found at {}: {}", archive_rel, e))?;

    if cfg!(target_os = "windows") {
        let file = File::open(&archive_path).map_err(|e| format!("Failed to open Deno zip: {}", e))?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read Deno zip: {}", e))?;
        for i in 0..zip.len() {
            let mut zipped_file = zip.by_index(i).map_err(|e| format!("Zip entry error: {}", e))?;
            let entry_path = match zipped_file.enclosed_name() { Some(p) => p.to_owned(), None => continue };
            let out_path = deno_dir.join(entry_path);
            if zipped_file.is_dir() {
                fs::create_dir_all(&out_path).map_err(|e| format!("Create dir failed: {}", e))?;
            } else {
                if let Some(parent) = out_path.parent() { fs::create_dir_all(parent).map_err(|e| format!("Create dir failed: {}", e))?; }
                let mut outfile = File::create(&out_path).map_err(|e| format!("Create file failed: {}", e))?;
                std::io::copy(&mut zipped_file, &mut outfile).map_err(|e| format!("Write file failed: {}", e))?;
            }
        }
    } else {
        return Err("Bundled Deno not available for this platform".to_string());
    }

    if deno_exe_default.exists() {
        return Ok(deno_exe_default);
    }
    if let Some(found) = find_executable_recursive(&deno_dir, exe_name) { return Ok(found); }

    Err("Deno executable not found after extraction".to_string())
}

#[tokio::main]
async fn main() {

    let client = sentry::init((
        "https://473d7b762855b5baa461a7921a5f95cc@sentry-ingest.frogbyte.io/4",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            attach_stacktrace: true,
            ..Default::default()
        },
    ));

    // Initialize minidump first
    let _guard = tauri_plugin_sentry::minidump::init(&client);

    // Then set up panic handler
    setup_panic_handler(client.clone());

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_installed_apps,
            get_all_session_names,
            set_application_volume,
            connect_decker,
            decker::get_devices,
            decker::send_decker_command,
            get_available_midi_output_port_names,
            attach_midi_device,
            detach_midi_device,
            get_active_app_name,
            disconnect_decker,
            set_screen_brightness,
            get_all_audio_devices,
            get_output_devices,
            get_input_devices,
            plugin_server::start_plugin_server,
            plugin_server::stop_plugin_server,
            plugin_server::send_to_plugin,
            plugin_server::send_to_plugin_with_ack,
            plugin_server::get_connected_plugins,
            plugin_server::send_api_response,
            plugin_server::broadcast_to_plugins,
            plugin_server::get_plugin_server_port,
            plugin_runtime::start_plugin,
            plugin_runtime::stop_plugin,
            plugin_runtime::restart_plugin,
            plugin_runtime::start_enabled_plugins,
            plugin_runtime::get_plugin_logs,
            plugin_runtime::clear_plugin_logs,
            list_installed_plugins,
            get_plugins_folder,
            open_plugins_folder,
            install_marketplace_plugin,
            uninstall_marketplace_plugin
        ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_aptabase::Builder::new("A-EU-7429874879").build()) // 👈 this is where you enter your App Key
        .plugin(tauri_plugin_sentry::init(&client))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                if matches!(window.is_visible(), Ok(false)) {
                    let _ = window.show();
                    show_notification(app, "Dot X", "Dot X is already running");
                }
                if matches!(window.is_minimized(), Ok(true)) {
                    let _ = window.unminimize();
                }
                let _ = window.set_focus();
            } else {
                error!("Main window not found during single-instance handling");
            }
        }))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            {
                power_monitor::setup_power_monitoring();
            }
            start_aptabase_heartbeat(app.handle().clone());
            let mut props_map = HashMap::new();
            props_map.insert("slider_amount".to_string(), Value::String("5".to_string()));

            // Convert the HashMap to a serde_json::Value and send event on async runtime
            let props_value = json!(props_map);
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = app_handle.track_event("app_started", Some(props_value));
                });
            }
            let Some(window) = app.get_webview_window("main") else {
                error!("Main window not found during setup");
                return Ok(());
            };
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            // Apply Windows window effects
            #[cfg(target_os = "windows")]
            {
                if let Err(err) = apply_mica(&window, None) {
                    trace!("Mica application failed: {err:?}, falling back to blur");
                    let _ = apply_blur(&window, Some((25, 10, 30, 255)));
                }
            }

            let (_menu, _tray) = build_tray(&app.handle())?;

            // This gets any command line arguments passed to the app
            let matches = app.cli().matches().unwrap_or_default();
            if let Some(hidden) = matches.args.get("hidden") {
                if hidden.value == Value::Bool(true) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                }
            }

            info!("Starting Dot X with version {:?}", sentry::release_name!());

            // Ensure bundled Deno is available and export its path
            match ensure_deno_extracted(&app.handle()) {
                Ok(p) => {
                    unsafe {
                        std::env::set_var("DOTX_DENO_PATH", p.to_string_lossy().to_string());
                    }
                    info!("Deno ready at {}", p.display());
                }
                Err(e) => {
                    error!("Deno bootstrap failed: {}", e);
                }
            }

            // Store global handle and auto-start enabled plugins
            APP.set(app.handle().clone()).expect("error setting up app");
            plugin_runtime::auto_start_enabled_plugins(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_app_handle() -> &'static AppHandle {
    APP.get().expect("AppHandle not initialized")
}

fn get_suspend_dim_enabled() -> bool {
    let app_handle = get_app_handle();
    match app_handle.store("config.json") {
        Ok(store) => store
            .get("suspendDimEnabled")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        Err(err) => {
            error!("Failed to open config store: {err}");
            false
        }
    }
}
