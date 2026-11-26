//! Puts a Decker into its bootloader and writes the bundled firmware.
//!
//! All validation (manifest, model, image) happens before the device is touched.

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use log::{error, info};
use serialport::{available_ports, ClearBuffer, SerialPort, SerialPortType};
use tauri::{AppHandle, Emitter};

use super::avr109::{self, Stage};
use super::bundle;

static FLASHING: AtomicBool = AtomicBool::new(false);

/// Serializes tests that touch the global `FLASHING` flag.
#[cfg(test)]
pub static TEST_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

const DECKER_VID: u16 = 1240;
const DECKER_PID: u16 = 58918;
const BAUD: u32 = 115_200;
/// Waits for the previous connection thread to let go of the port.
const OPEN_RETRY_FOR: Duration = Duration::from_secs(1);
const IDENTIFY_TIMEOUT: Duration = Duration::from_millis(500);
const BOOTLOADER_SEARCH_FOR: Duration = Duration::from_secs(5);
const BOOTLOADER_SEARCH_EVERY: Duration = Duration::from_millis(100);
/// The bootloader erases every application page before acking `e` (about 2 s).
const PROGRAM_TIMEOUT: Duration = Duration::from_secs(5);

/// True while a firmware update owns the serial port. The decker connection loop
/// refuses to open the port during this time.
pub fn is_flashing() -> bool {
    FLASHING.load(Ordering::SeqCst)
}

#[cfg(test)]
pub fn test_set_flashing(v: bool) {
    FLASHING.store(v, Ordering::SeqCst);
}

/// Holds `FLASHING` for the duration of one update; dropping it clears the flag.
struct FlashGuard;

impl FlashGuard {
    fn begin() -> Result<FlashGuard, String> {
        FLASHING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| FlashGuard)
            .map_err(|_| "A firmware update is already running".to_string())
    }
}

impl Drop for FlashGuard {
    fn drop(&mut self) {
        FLASHING.store(false, Ordering::SeqCst);
    }
}

#[derive(Clone, serde::Serialize)]
struct Progress {
    stage: Stage,
    percent: u8,
}

/// Flashes the bundled firmware for `model` onto the Decker at `port_name`.
/// Emits `firmware-progress` with `{ stage, percent }` as it goes.
#[tauri::command(async)]
pub fn firmware_flash(app: AppHandle, port_name: String, model: String) -> Result<(), String> {
    let result = flash(&app, &port_name, &model);
    if let Err(e) = &result {
        error!("Firmware update of {model} on {port_name} failed: {e}");
    }
    result
}

fn flash(app: &AppHandle, port_name: &str, model: &str) -> Result<(), String> {
    let _guard = FlashGuard::begin()?;

    let manifest = bundle::load_manifest(app)?;
    let fw = bundle::for_model(&manifest, model)
        .ok_or_else(|| format!("No firmware bundled for {model}"))?;
    let image = bundle::load_image(app, &fw)?;
    info!(
        "Updating {model} on {port_name} to firmware {} ({} bytes)",
        fw.version,
        image.len()
    );

    crate::decker::kill_decker_thread();
    // The killed connection thread does not announce itself. Without this the frontend
    // still thinks it is connected and never runs its reconnect loop after the flash.
    if let Err(e) = app.emit(
        "connection-change",
        serde_json::json!({ "message": "disconnected" }),
    ) {
        error!("Failed to emit connection-change event: {e}");
    }
    let mut last_stage = None;
    let mut port = match open_with_retry(port_name) {
        Ok(mut port) => {
            if matches!(identify(&mut port), Ok(true)) {
                info!("{port_name} is already in the bootloader");
                port
            } else {
                report(app, &mut last_stage, Stage::Rebooting, 0);
                drop(port);
                reboot_to_bootloader(port_name)?;
                find_bootloader(port_name)?
            }
        }
        // A retry from recovery: the bootloader may have enumerated under another name.
        Err(e) => {
            info!("{e}; looking for the bootloader on other ports");
            find_bootloader(port_name)?
        }
    };

    port.set_timeout(PROGRAM_TIMEOUT)
        .map_err(|e| format!("Could not configure {port_name}: {e}"))?;
    avr109::program(&mut port, &image, &mut |stage, percent| {
        report(app, &mut last_stage, stage, percent)
    })
    .map_err(|e| {
        format!("Firmware update failed ({e}). Keep the device plugged in and try again.")
    })?;
    info!("Firmware {} written to {model} on {port_name}", fw.version);
    Ok(())
}

/// Returns the first Decker port that answers as the bootloader, e.g. one left there by an
/// interrupted update under a different name than the app port. Opens every Decker port, so
/// call it only while the connection thread holds none of them.
#[tauri::command(async)]
pub fn firmware_find_bootloader() -> Option<String> {
    if is_flashing() {
        return None;
    }
    decker_ports().into_iter().find(|name| {
        serialport::new(name, BAUD)
            .timeout(IDENTIFY_TIMEOUT)
            .open()
            .is_ok_and(|mut port| matches!(identify(&mut port), Ok(true)))
    })
}

/// Emits progress to the frontend; logs only when the stage changes.
fn report(app: &AppHandle, last_stage: &mut Option<Stage>, stage: Stage, percent: u8) {
    if *last_stage != Some(stage) {
        info!("Firmware update stage: {stage:?}");
        *last_stage = Some(stage);
    }
    if let Err(e) = app.emit("firmware-progress", Progress { stage, percent }) {
        error!("Failed to emit firmware-progress event: {e}");
    }
}

/// Clears stale input, then asks whether the port is the Caterina bootloader.
fn identify(port: &mut Box<dyn SerialPort>) -> std::io::Result<bool> {
    let _ = port.clear(ClearBuffer::Input);
    avr109::identify(port)
}

/// The connection thread may hold the port for a moment after it was told to stop.
fn open_with_retry(port_name: &str) -> Result<Box<dyn SerialPort>, String> {
    let deadline = Instant::now() + OPEN_RETRY_FOR;
    loop {
        match serialport::new(port_name, BAUD)
            .timeout(IDENTIFY_TIMEOUT)
            .open()
        {
            Ok(port) => return Ok(port),
            Err(e) if Instant::now() >= deadline => {
                return Err(format!("Could not open {port_name}: {e}"))
            }
            Err(_) => thread::sleep(Duration::from_millis(50)),
        }
    }
}

/// Opening at 1200 baud and dropping DTR asks the firmware to reset into the bootloader.
fn reboot_to_bootloader(port_name: &str) -> Result<(), String> {
    let open = || serialport::new(port_name, 1200).open();
    // Windows can refuse the reopen right after the previous handle closed.
    let mut port = open()
        .or_else(|_| {
            thread::sleep(Duration::from_millis(100));
            open()
        })
        .map_err(|e| format!("Could not reset {port_name} into update mode: {e}"))?;
    port.write_data_terminal_ready(false)
        .map_err(|e| format!("Could not reset {port_name} into update mode: {e}"))?;
    Ok(())
}

/// The bootloader may enumerate under a different port name (ttyACM0 -> ttyACM1 on Linux).
fn find_bootloader(port_name: &str) -> Result<Box<dyn SerialPort>, String> {
    let deadline = Instant::now() + BOOTLOADER_SEARCH_FOR;
    while Instant::now() < deadline {
        thread::sleep(BOOTLOADER_SEARCH_EVERY);
        for candidate in candidate_ports(port_name) {
            let Ok(mut port) = serialport::new(&candidate, BAUD)
                .timeout(IDENTIFY_TIMEOUT)
                .open()
            else {
                continue;
            };
            if matches!(identify(&mut port), Ok(true)) {
                info!("Found bootloader on {candidate}");
                return Ok(port);
            }
        }
    }
    Err("Decker did not enter update mode. Unplug it, plug it back in, and try again.".into())
}

/// `port_name` plus every port with the Decker's USB ID.
fn candidate_ports(port_name: &str) -> Vec<String> {
    let mut names = vec![port_name.to_string()];
    for name in decker_ports() {
        if !names.contains(&name) {
            names.push(name);
        }
    }
    names
}

/// Every port with the Decker's USB ID.
fn decker_ports() -> Vec<String> {
    available_ports()
        .unwrap_or_default()
        .into_iter()
        .filter(|p| {
            matches!(
                p.port_type,
                SerialPortType::UsbPort(ref info) if info.vid == DECKER_VID && info.pid == DECKER_PID
            )
        })
        .map(|p| p.port_name)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn second_begin_is_refused() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let g = FlashGuard::begin().unwrap();
        assert!(FlashGuard::begin().is_err());
        drop(g);
        assert!(FlashGuard::begin().is_ok());
    }
}
