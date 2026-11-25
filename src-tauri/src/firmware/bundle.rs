//! Firmware images shipped inside the installer, listed in `firmware/firmware.json`.

use semver::Version;
use serde::Deserialize;
use tauri::{path::BaseDirectory, AppHandle, Manager};

use super::hex;

#[derive(Deserialize, Clone)]
pub struct BundledFirmware {
    pub models: Vec<String>,
    pub version: String,
    pub file: String,
}

/// Plain `x.y.z` only. A pre-release tag (the emulator reports `0.0.0-emulator`)
/// counts as unparseable so it is never offered a flash.
fn parse_version(v: &str) -> Option<Version> {
    Version::parse(v).ok().filter(|v| v.pre.is_empty())
}

pub fn for_model(manifest: &[BundledFirmware], model: &str) -> Option<BundledFirmware> {
    manifest
        .iter()
        .find(|fw| fw.models.iter().any(|m| m == model))
        .cloned()
}

/// The bundled firmware for `model`, if it is strictly newer than `device_version`.
pub fn find_update(
    manifest: &[BundledFirmware],
    model: &str,
    device_version: &str,
) -> Option<BundledFirmware> {
    let device = parse_version(device_version)?;
    let fw = for_model(manifest, model)?;
    (parse_version(&fw.version)? > device).then_some(fw)
}

fn resource_path(app: &AppHandle, name: &str) -> Result<std::path::PathBuf, String> {
    app.path()
        .resolve(format!("firmware/{name}"), BaseDirectory::Resource)
        .map_err(|e| format!("Bundled firmware file {name} not found: {e}"))
}

pub fn load_manifest(app: &AppHandle) -> Result<Vec<BundledFirmware>, String> {
    let text = std::fs::read_to_string(resource_path(app, "firmware.json")?)
        .map_err(|e| format!("Failed to read firmware manifest: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("Invalid firmware manifest: {e}"))
}

pub fn load_image(app: &AppHandle, fw: &BundledFirmware) -> Result<Vec<u8>, String> {
    let text = std::fs::read_to_string(resource_path(app, &fw.file)?)
        .map_err(|e| format!("Failed to read firmware image {}: {e}", fw.file))?;
    hex::parse_ihex(&text)
}

/// Returns the bundled version when it is newer than what the device reports.
#[tauri::command]
pub fn firmware_check(
    app: AppHandle,
    model: String,
    version: String,
) -> Result<Option<String>, String> {
    let manifest = load_manifest(&app)?;
    Ok(find_update(&manifest, &model, &version).map(|fw| fw.version))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest() -> Vec<BundledFirmware> {
        vec![
            BundledFirmware {
                models: vec!["VM-5SW".into(), "VM-5SW-L".into()],
                version: "0.0.4".into(),
                file: "decker-0.0.4.hex".into(),
            },
            BundledFirmware {
                models: vec!["VML-5SW".into()],
                version: "0.0.4".into(),
                file: "decker-lite-0.0.4.hex".into(),
            },
        ]
    }

    #[test]
    fn offers_newer_firmware_for_matching_model() {
        assert_eq!(
            find_update(&manifest(), "VM-5SW", "0.0.3").unwrap().file,
            "decker-0.0.4.hex"
        );
    }

    #[test]
    fn other_model_gets_its_own_firmware() {
        assert_eq!(
            find_update(&manifest(), "VML-5SW", "0.0.3").unwrap().file,
            "decker-lite-0.0.4.hex"
        );
    }

    #[test]
    fn same_or_newer_device_version_offers_nothing() {
        assert!(find_update(&manifest(), "VM-5SW", "0.0.4").is_none());
        assert!(find_update(&manifest(), "VM-5SW", "0.1.0").is_none());
    }

    #[test]
    fn unknown_model_offers_nothing() {
        assert!(find_update(&manifest(), "ARDUINO", "0.0.1").is_none());
    }

    #[test]
    fn unparseable_device_version_offers_nothing() {
        for v in ["", "1.0", "0.0.0-emulator", "garbage"] {
            assert!(find_update(&manifest(), "VM-5SW", v).is_none(), "{v}");
        }
    }

    #[test]
    fn shipped_manifest_parses_and_files_exist() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("firmware");
        let m: Vec<BundledFirmware> =
            serde_json::from_str(&std::fs::read_to_string(dir.join("firmware.json")).unwrap())
                .unwrap();
        for fw in &m {
            hex::parse_ihex(&std::fs::read_to_string(dir.join(&fw.file)).unwrap()).unwrap();
        }
        assert!(for_model(&m, "VM-5SW").is_some());
    }
}
