// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::{error, info, trace};
use midir::MidiOutput;
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::api::shell;
use std::fs;
use std::fs::File;
use std::path::PathBuf;
use tauri::{ Manager, Window };
use windows_volume_control::AudioController;
use windows_volume_control::CoinitMode;
use tauri_plugin_autostart::MacosLauncher;
use midir::{MidiOutput};
use std::collections::HashMap;
use std::fmt;
use tauri::AppHandle;
use tauri::Manager;
use tauri::WebviewWindow;
use tauri::Wry;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use windows_volume_control::AudioController;
use windows_volume_control::CoinitMode;
mod decker;
mod midi;
mod power_monitor;
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
fn resolve_plugins_dir(app_handle: &AppHandle) -> Option<PathBuf> {
  // Try resources path (bundled)
  if let Some(p) = app_handle.path_resolver().resolve_resource("../plugins") {
    if p.exists() { return Some(p); }
  }
  if let Some(p) = app_handle.path_resolver().resolve_resource("plugins") {
    if p.exists() { return Some(p); }
  }
  // Try working dir variants (dev)
  if let Ok(cwd) = std::env::current_dir() {
    let candidate = cwd.join("plugins");
    if candidate.exists() { return Some(candidate); }
    let candidate = cwd.join("..\\plugins");
    if candidate.exists() { return Some(candidate); }
  }
  None
}

#[tauri::command]
fn list_installed_plugins(app_handle: AppHandle) -> Result<Vec<serde_json::Value>, String> {
  let plugins_dir = resolve_plugins_dir(&app_handle).ok_or_else(|| "Plugins directory not found".to_string())?;
  let mut results: Vec<serde_json::Value> = Vec::new();

  let read_dir = fs::read_dir(&plugins_dir).map_err(|e| format!("Failed to read plugins dir: {}", e))?;
  for entry_result in read_dir {
    let entry = match entry_result { Ok(e) => e, Err(_) => continue };
    let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };
    if !metadata.is_dir() { continue; }

    let folder_path = entry.path();
    let manifest_path = folder_path.join("manifest.json");
    let main_js_path = folder_path.join("main.js");
    if !manifest_path.exists() { continue; }
    if !main_js_path.exists() { continue; }

    // Read manifest.json
    let manifest_str = match fs::read_to_string(&manifest_path) {
      Ok(s) => s,
      Err(_) => continue,
    };
    let mut manifest_json: serde_json::Value = match serde_json::from_str(&manifest_str) {
      Ok(v) => v,
      Err(_) => continue,
    };

    // Ensure an id exists; fallback to folder name
    if manifest_json.get("id").and_then(|v| v.as_str()).is_none() {
      if let Some(obj) = manifest_json.as_object_mut() {
        obj.insert(
          "id".to_string(),
          serde_json::Value::String(entry.file_name().to_string_lossy().to_string()),
        );
      }
    }

    // Include a hint that main.js exists and folder path if needed later
    if let Some(obj) = manifest_json.as_object_mut() {
      obj.insert(
        "_hasMainJs".to_string(),
        serde_json::Value::Bool(main_js_path.exists()),
      );
    }

    results.push(manifest_json);
  }

  Ok(results)
}

#[tauri::command]
fn get_plugins_folder(app_handle: AppHandle) -> Result<String, String> {
  let plugins_dir = resolve_plugins_dir(&app_handle).ok_or_else(|| "Plugins directory not found".to_string())?;
  Ok(plugins_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_plugins_folder(app_handle: AppHandle) -> Result<(), String> {
  let plugins_dir = resolve_plugins_dir(&app_handle).ok_or_else(|| "Plugins directory not found".to_string())?;
  shell::open(&app_handle.shell_scope(), plugins_dir.to_string_lossy().to_string(), None)
    .map_err(|e| e.to_string())
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
    let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
    controller.GetSessions();
    controller.GetDefaultAudioEnpointVolumeControl();
    controller.GetAllProcessSessions();
    controller.GetAllAudioDevices();
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
  let data_dir = app.path_resolver().app_data_dir().ok_or_else(|| "App data dir not available".to_string())?;
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

  let archive_path = app
    .path_resolver()
    .resolve_resource(archive_rel)
    .ok_or_else(|| format!("Bundled Deno archive not found at {}", archive_rel))?;

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
            plugin_runtime::start_plugin,
            plugin_runtime::stop_plugin,
            plugin_runtime::restart_plugin,
            plugin_runtime::start_enabled_plugins,
            plugin_runtime::get_plugin_logs,
            plugin_runtime::clear_plugin_logs,
            list_installed_plugins,
            get_plugins_folder,
            open_plugins_folder
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
                    std::env::set_var("DOTX_DENO_PATH", p.to_string_lossy().to_string());
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
