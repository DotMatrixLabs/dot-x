use std::fs;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use log::info;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

use crate::plugin_runtime;
use crate::plugin_runtime::{
    ensure_plugins_dir,
    find_plugin_dir_by_id,
    normalize_manifest_main_path,
    read_manifest_info,
    resolve_plugins_dir,
    validate_manifest,
};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[tauri::command]
pub fn list_installed_plugins(app_handle: AppHandle) -> Result<Vec<serde_json::Value>, String> {
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
pub fn get_plugins_folder(app_handle: AppHandle) -> Result<String, String> {
    let plugins_dir = ensure_plugins_dir(&app_handle)?;
    Ok(plugins_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_plugins_folder(app_handle: AppHandle) -> Result<(), String> {
    let plugins_dir = ensure_plugins_dir(&app_handle)?;
    use tauri_plugin_shell::ShellExt;
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

    for field in &["name", "version", "description", "author", "dotxVersion"] {
        match manifest_json.get(*field).and_then(|v| v.as_str()) {
            Some(s) if !s.trim().is_empty() => {}
            _ => return Err(format!("manifest.json is missing a non-empty string \"{}\" field", field)),
        }
    }

    if let Some(v) = manifest_json.get("version").and_then(|v| v.as_str()) {
        if semver::Version::parse(v).is_err() {
            return Err(format!("\"version\" value \"{}\" is not valid semver", v));
        }
    }

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

fn replace_installed_plugin_dir(plugins_dir: &Path, plugin_id: &str, extracted_dir: &Path) -> Result<(), String> {
    let plugin_dir = plugins_dir.join(plugin_id);
    if plugin_dir.exists() {
        info!("Removing existing plugin directory: {}", plugin_dir.display());
        fs::remove_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to remove existing plugin directory: {}", e))?;
    }

    fs::rename(extracted_dir, &plugin_dir)
        .map_err(|e| format!("Failed to install extracted plugin directory: {}", e))?;

    info!("Successfully installed plugin: {}", plugin_id);
    Ok(())
}

fn download_text_with_progress(
    client: &reqwest::blocking::Client,
    url: &str,
    stage: &str,
    progress_start: u8,
    progress_end: u8,
    emit_progress: &impl Fn(&str, u8),
) -> Result<String, String> {
    let bytes = download_bytes_with_progress(
        client,
        url,
        stage,
        progress_start,
        progress_end,
        emit_progress,
    )?;

    String::from_utf8(bytes)
        .map_err(|e| format!("Downloaded text was not valid UTF-8: {}", e))
}

fn registry_entry_integrity_hash(plugin_entry: &Value) -> Option<String> {
    plugin_entry
        .get("package_integrity_hash")
        .or_else(|| plugin_entry.get("integrity_hash"))
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
}

fn install_marketplace_zip_plugin(
    client: &reqwest::blocking::Client,
    plugin_entry: &Value,
    plugin_id: &str,
    plugins_dir: &Path,
    extracted_dir: &Path,
    emit_progress: &impl Fn(&str, u8),
) -> Result<(), String> {
    let package_url = plugin_entry
        .get("package_url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| "package_url not found in registry".to_string())?
        .to_string();
    let expected_hash = registry_entry_integrity_hash(plugin_entry)
        .ok_or_else(|| "package_integrity_hash not found in registry".to_string())?;

    info!("Downloading plugin package from {}", package_url);
    let package_bytes = download_bytes_with_progress(
        client,
        &package_url,
        "downloading_package",
        5,
        75,
        emit_progress,
    )?;

    emit_progress("verifying_package", 80);
    let computed_hash = calculate_sha256_bytes(&package_bytes);
    if computed_hash != expected_hash {
        return Err("Integrity check failed: downloaded package does not match the expected checksum. Please try again.".to_string());
    }
    inspect_plugin_zip(&package_bytes)?;

    emit_progress("extracting_package", 85);
    extract_plugin_zip(&package_bytes, extracted_dir)?;

    emit_progress("validating_package", 92);
    validate_extracted_plugin_dir(extracted_dir, plugin_id)?;

    emit_progress("installing", 96);
    replace_installed_plugin_dir(plugins_dir, plugin_id, extracted_dir)?;
    emit_progress("done", 100);
    Ok(())
}

fn install_marketplace_manifest_plugin(
    client: &reqwest::blocking::Client,
    plugin_entry: &Value,
    plugin_id: &str,
    plugins_dir: &Path,
    extracted_dir: &Path,
    emit_progress: &impl Fn(&str, u8),
) -> Result<(), String> {
    let manifest_url = plugin_entry
        .get("manifest_url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| "manifest_url not found in registry".to_string())?
        .to_string();
    let index_url = plugin_entry
        .get("index_url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| "index_url not found in registry".to_string())?
        .to_string();
    let expected_hash = registry_entry_integrity_hash(plugin_entry);

    let manifest_text = download_text_with_progress(
        client,
        &manifest_url,
        "downloading_package",
        5,
        25,
        emit_progress,
    )?;
    let manifest_json: Value = serde_json::from_str(&manifest_text)
        .map_err(|e| format!("Failed to parse manifest.json from registry: {}", e))?;
    let main_path = validate_marketplace_manifest(&manifest_json, plugin_id)?;

    let entry_bytes = download_bytes_with_progress(
        client,
        &index_url,
        "downloading_package",
        25,
        75,
        emit_progress,
    )?;

    if let Some(expected_hash) = expected_hash {
        emit_progress("verifying_package", 80);
        let computed_hash = calculate_sha256_bytes(&entry_bytes);
        if computed_hash != expected_hash {
            return Err("Integrity check failed: downloaded package does not match the expected checksum. Please try again.".to_string());
        }
    }

    emit_progress("extracting_package", 85);
    fs::create_dir_all(extracted_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;
    fs::write(extracted_dir.join("manifest.json"), manifest_text.as_bytes())
        .map_err(|e| format!("Failed to write manifest.json: {}", e))?;

    let main_target_path = extracted_dir.join(&main_path);
    if let Some(parent) = main_target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create plugin entry directory: {}", e))?;
    }
    fs::write(&main_target_path, &entry_bytes)
        .map_err(|e| format!("Failed to write plugin entry point: {}", e))?;

    emit_progress("validating_package", 92);
    validate_extracted_plugin_dir(extracted_dir, plugin_id)?;

    emit_progress("installing", 96);
    replace_installed_plugin_dir(plugins_dir, plugin_id, extracted_dir)?;
    emit_progress("done", 100);
    Ok(())
}

fn is_plugin_enabled_in_store(app_handle: &AppHandle, plugin_id: &str) -> bool {
    let path_resolver = app_handle.path();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(p) = path_resolver.app_data_dir() {
        candidates.push(p.join("plugins.json"));
    }
    if let Ok(p) = path_resolver.app_config_dir() {
        candidates.push(p.join("plugins.json"));
    }

    for config_path in candidates {
        let Ok(content) = fs::read_to_string(&config_path) else {
            continue;
        };
        let Ok(config) = serde_json::from_str::<Value>(&content) else {
            continue;
        };
        let Some(enabled) = config.get("enabled").and_then(|value| value.as_array()) else {
            continue;
        };

        if enabled.iter().any(|value| value.as_str() == Some(plugin_id)) {
            return true;
        }
    }

    false
}

fn normalize_loose_semver(version: &str) -> String {
    let trimmed = version.trim();
    if trimmed.starts_with('v') && trimmed.chars().nth(1).map(|ch| ch.is_ascii_digit()).unwrap_or(false) {
        trimmed[1..].to_string()
    } else {
        trimmed.to_string()
    }
}

fn parse_loose_semver(version: &str) -> Option<semver::Version> {
    semver::Version::parse(version.trim())
        .ok()
        .or_else(|| semver::Version::parse(&normalize_loose_semver(version)).ok())
}

#[tauri::command]
pub async fn check_marketplace_plugin_updates(app_handle: AppHandle, registry_url: String) -> Result<Vec<serde_json::Value>, String> {
    let installed_plugins = list_installed_plugins(app_handle)?;

    tokio::task::spawn_blocking(move || -> Result<Vec<serde_json::Value>, String> {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

        let registry_response = client
            .get(&registry_url)
            .send()
            .map_err(|e| format!("Failed to fetch registry: {}", e))?;
        let registry: Value = registry_response
            .json()
            .map_err(|e| format!("Failed to parse registry: {}", e))?;
        let registry_plugins = registry
            .get("plugins")
            .and_then(|plugins| plugins.as_array())
            .ok_or_else(|| "Registry plugins array not found".to_string())?;

        let installed_versions: std::collections::HashMap<String, String> = installed_plugins
            .iter()
            .filter_map(|plugin| {
                let plugin_id = plugin.get("id").and_then(|value| value.as_str())?;
                let version = plugin.get("version").and_then(|value| value.as_str())?;
                Some((plugin_id.to_string(), normalize_loose_semver(version)))
            })
            .collect();

        let mut updates = Vec::new();

        for registry_plugin in registry_plugins {
            let Some(plugin_id) = registry_plugin.get("id").and_then(|value| value.as_str()) else {
                continue;
            };
            let Some(installed_version) = installed_versions.get(plugin_id) else {
                continue;
            };

            let latest_version = if let Some(manifest_url) = registry_plugin.get("manifest_url").and_then(|value| value.as_str()) {
                match client.get(manifest_url).send() {
                    Ok(response) if response.status().is_success() => {
                        match response.json::<Value>() {
                            Ok(manifest) => manifest
                                .get("version")
                                .and_then(|value| value.as_str())
                                .map(normalize_loose_semver)
                                .or_else(|| registry_plugin.get("version").and_then(|value| value.as_str()).map(normalize_loose_semver)),
                            Err(_) => registry_plugin.get("version").and_then(|value| value.as_str()).map(normalize_loose_semver),
                        }
                    }
                    _ => registry_plugin.get("version").and_then(|value| value.as_str()).map(normalize_loose_semver),
                }
            } else {
                registry_plugin.get("version").and_then(|value| value.as_str()).map(normalize_loose_semver)
            };

            let Some(latest_version) = latest_version else {
                continue;
            };

            let Some(installed_semver) = parse_loose_semver(installed_version) else {
                continue;
            };
            let Some(latest_semver) = parse_loose_semver(&latest_version) else {
                continue;
            };

            if latest_semver > installed_semver {
                updates.push(json!({
                    "pluginId": plugin_id,
                    "installedVersion": installed_version,
                    "latestVersion": latest_version,
                    "hasUpdate": true,
                }));
            }
        }

        Ok(updates)
    }).await.unwrap_or_else(|e| Err(format!("Update check task failed: {}", e)))
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
pub async fn install_marketplace_plugin(app_handle: AppHandle, plugin_id: String, registry_url: String) -> Result<(), String> {
    let should_restart_after_install = is_plugin_enabled_in_store(&app_handle, &plugin_id);

    let _ = plugin_runtime::stop_plugin(plugin_id.clone()).await;

    let plugins_dir = ensure_plugins_dir(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("App data dir not available: {}", e))?;

    let _ = app_handle.emit("plugin-install-progress", json!({
          "pluginId": &plugin_id, "stage": "fetching_registry", "progress": 0u8,
    }));

    let install_app_handle = app_handle.clone();
    let install_plugin_id = plugin_id.clone();

    tokio::task::spawn_blocking(move || {
        let emit_progress = |stage: &str, progress: u8| {
            let _ = install_app_handle.emit("plugin-install-progress", json!({
                "pluginId": &install_plugin_id,
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
            .find(|p| p.get("id").and_then(|id| id.as_str()) == Some(install_plugin_id.as_str()))
            .ok_or_else(|| format!("Plugin {} not found in registry", install_plugin_id))?;

        let package_format = plugin_entry
            .get("package_format")
            .and_then(|f| f.as_str())
            .unwrap_or(if plugin_entry.get("package_url").is_some() { "zip" } else { "manifest" });

        let temp_base = app_data_dir.join("plugins").join(".tmp");
        fs::create_dir_all(&temp_base)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;

        let temp_dir = temp_base.join(format!(
            "{}-{}",
            install_plugin_id,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        ));
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp plugin directory: {}", e))?;
        let extracted_dir = temp_dir.join("plugin");

        let result: Result<(), String> = (|| {
            match package_format {
                "zip" => install_marketplace_zip_plugin(
                    &client,
                    plugin_entry,
                    &install_plugin_id,
                    &plugins_dir,
                    &extracted_dir,
                    &emit_progress,
                ),
                "manifest" => install_marketplace_manifest_plugin(
                    &client,
                    plugin_entry,
                    &install_plugin_id,
                    &plugins_dir,
                    &extracted_dir,
                    &emit_progress,
                ),
                other => Err(format!("Unsupported package_format '{}'", other)),
            }
        })();

        let _ = fs::remove_dir_all(&temp_dir);
        result
    }).await.unwrap_or_else(|e| Err(format!("Install task failed: {}", e)))?;

    if should_restart_after_install {
        plugin_runtime::start_plugin(app_handle.clone(), plugin_id.clone())
            .await
            .map_err(|e| format!("Plugin installed but failed to restart: {}", e))?;
    }

    Ok(())
}

/// Read the manifest.json out of a .dotx file (a zip) without extracting anything else.
fn read_manifest_from_dotx(file_path: &str) -> Result<serde_json::Value, String> {
    let bytes = fs::read(file_path)
        .map_err(|e| format!("Failed to read plugin file: {}", e))?;
    let reader = std::io::Cursor::new(&bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| format!("Not a valid .dotx file: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("Zip entry error: {}", e))?;
        let is_manifest = entry.enclosed_name()
            .map(|p| p == std::path::Path::new("manifest.json"))
            .unwrap_or(false);
        if !is_manifest { continue; }

        let mut contents = String::new();
        entry.read_to_string(&mut contents)
            .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
        return serde_json::from_str(&contents)
            .map_err(|e| format!("Invalid manifest.json: {}", e));
    }

    Err("Plugin file is missing manifest.json".to_string())
}

/// Return the manifest of a .dotx file so the frontend can show the install confirmation dialog.
#[tauri::command]
pub fn get_dotx_manifest(file_path: String) -> Result<serde_json::Value, String> {
    read_manifest_from_dotx(&file_path)
}

/// Install a .dotx file from a local path. Validates, extracts, and replaces any existing version.
/// Returns the manifest JSON so the frontend knows which plugin was installed.
#[tauri::command]
pub async fn install_local_plugin(app_handle: AppHandle, file_path: String) -> Result<serde_json::Value, String> {
    let bytes = tokio::task::spawn_blocking({
        let path = file_path.clone();
        move || fs::read(&path).map_err(|e| format!("Failed to read plugin file: {}", e))
    }).await.unwrap_or_else(|e| Err(format!("Read task failed: {}", e)))?;

    // Validate the zip structure and manifest before touching anything on disk.
    inspect_plugin_zip(&bytes)?;

    let manifest: serde_json::Value = {
        let reader = std::io::Cursor::new(&bytes);
        let mut archive = zip::ZipArchive::new(reader)
            .map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut manifest_json = serde_json::Value::Null;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| format!("Zip entry error: {}", e))?;
            let is_manifest = entry.enclosed_name()
                .map(|p| p == std::path::Path::new("manifest.json"))
                .unwrap_or(false);
            if !is_manifest { continue; }
            let mut contents = String::new();
            entry.read_to_string(&mut contents)
                .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
            manifest_json = serde_json::from_str(&contents)
                .map_err(|e| format!("Invalid manifest.json: {}", e))?;
            break;
        }
        if manifest_json.is_null() {
            return Err("Plugin file is missing manifest.json".to_string());
        }
        manifest_json
    };

    let plugin_id = manifest
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "manifest.json is missing an \"id\" field".to_string())?
        .to_string();

    let should_restart = is_plugin_enabled_in_store(&app_handle, &plugin_id);
    let _ = plugin_runtime::stop_plugin(plugin_id.clone()).await;

    let plugins_dir = ensure_plugins_dir(&app_handle)?;
    let app_data_dir = app_handle.path().app_data_dir()
        .map_err(|e| format!("App data dir not available: {}", e))?;

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
    let extracted_dir = temp_dir.join("plugin");

    let result: Result<(), String> = (|| {
        extract_plugin_zip(&bytes, &extracted_dir)?;
        validate_extracted_plugin_dir(&extracted_dir, &plugin_id)?;
        replace_installed_plugin_dir(&plugins_dir, &plugin_id, &extracted_dir)
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    result?;

    if should_restart {
        let _ = plugin_runtime::start_plugin(app_handle, plugin_id.clone()).await;
    }

    info!("Installed local plugin: {}", plugin_id);
    Ok(manifest)
}

#[tauri::command]
pub async fn uninstall_marketplace_plugin(app_handle: AppHandle, plugin_id: String) -> Result<(), String> {
    let _ = plugin_runtime::stop_plugin(plugin_id.clone()).await;

    let plugin_dir = find_plugin_dir_by_id(&app_handle, &plugin_id)
        .ok_or_else(|| format!("Plugin {} not found", plugin_id))?;

    fs::remove_dir_all(&plugin_dir)
        .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;

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

                if let Some(updates) = config.get_mut("updates").and_then(|value| value.as_object_mut()) {
                    changed |= updates.remove(&plugin_id).is_some();
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
