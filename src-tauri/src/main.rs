// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


use log::{info, trace, error};
use serde_json::{json, Value};
use tauri::AppHandle;
use tauri::{ Manager, Window };
use tauri_plugin_store::StoreBuilder;
use windows_volume_control::AudioController;
use windows_volume_control::CoinitMode;
use tauri_plugin_autostart::MacosLauncher;
use midir::{MidiOutput};
use std::collections::HashMap;
use std::fmt;
mod decker;
mod midi;
mod power_monitor;
use tauri::{CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem, SystemTray, SystemTrayEvent};
use tauri::api::notification::Notification;
use window_vibrancy::{apply_blur, apply_mica};
use window_shadows::set_shadow;
use once_cell::sync::OnceCell;

use active_win_pos_rs::get_active_window;
use tauri_plugin_aptabase::EventTracker;
use std::thread;
use std::time::Duration;
use sentry_tauri::sentry::{self, ClientInitGuard};
use chrono::Local;
use brightness::{Brightness, BrightnessDevice};
use futures::{TryStreamExt};


static APP: OnceCell<tauri::AppHandle> = OnceCell::new();

// create the error type that represents all errors possible in our program
#[derive(Debug, thiserror::Error)]
enum Error {
  #[error(transparent)]
  Io(#[from] std::io::Error),
  SessionNotFound,
  Connection,
  InitError
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
fn get_available_midi_output_port_names() -> Result<MidiPortNames, Error> {
  let mut available_ports: Vec<String> = Vec::new();
    
  // Explicitly handle the error and convert it to Box<dyn Error>
  let midi_out_result = MidiOutput::new("Decker Output");
  
  let midi_out = match midi_out_result {
      Ok(midi_out) => midi_out,
      Err(_error) => {
          // Handle the error here, or return it if you prefer.
          return Err(Error::InitError);
      }  };

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

  let available_ports_response = MidiPortNames { names: available_ports };
  Ok(available_ports_response)
}

#[tauri::command]
fn get_installed_apps() -> Result<CustomResponse, Error>{
    let apps = installed::list().expect("list apps");
    let mut app_list  = Vec::new();
    for app in apps {
        // metadata accessor fns, these are only evaluated when used
        let name = app.name().to_string();
        app_list.push(name);
    }
    // Create the Response struct
    let app_list_response = CustomResponse {
        app_list: app_list,
    };
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
                let cc_value = obj.get("CCValue").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(String::new); // If the value is null, return an empty string
                let channel = obj.get("channel").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_else(String::new); // If the value is null, return an empty string
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
fn attach_midi_device(output_name: &str, output_port: u32, midi_sliders: Value, midi_configuration: Value) -> Result<(), Error> {
    let midi_sliders_vec = value_to_i32_vec(&midi_sliders).unwrap_or_default();
    let midi_configuration_vec = value_to_object_vec(&midi_configuration).unwrap_or_default();
    let midi_controller = midi::midi::new("Decker", output_port, midi_sliders_vec, midi_configuration_vec); 
    match midi_controller {
      Ok(_midi_controller) => {
        info!("Midi port {}: Port name: {}", output_port, output_name);
        unsafe { midi::midi::ENABLED = true; }
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
  unsafe { midi::midi::ENABLED = false; }
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
    let _screen_names: Vec<String> = screens.as_array()
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
                  dev.device_name().await.unwrap_or_else(|_| "Unknown".to_string()),
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
fn connect_decker(window: Window, port_name: &str, inverted: bool) -> Result<(), Error> {
  println!("Connecting Decker at port: {}, inverted: {}", port_name, inverted);
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




fn build_menu() -> SystemTrayMenu {
  let menuitem_quit = CustomMenuItem::new("quit".to_string(), "Quit");
  let menuitem_show = CustomMenuItem::new("show".to_string(), "Show");
  let menuitem_hide = CustomMenuItem::new("hide".to_string(), "Hide");
  SystemTrayMenu::new()
      .add_item(menuitem_show) 
      .add_item(menuitem_hide)  
      .add_native_item(SystemTrayMenuItem::Separator)
      .add_item(menuitem_quit)
}

fn show_notification(title: &str, body : &str) {
  info!("Showing notification || Title: {} | Message: {}", title, body);
  let context = tauri::generate_context!("tauri.conf.json");
  Notification::new(&context.config().tauri.bundle.identifier)
    .title(title)
    .body(body)
    .show()
    .unwrap();
}

#[derive(Clone, serde::Serialize)]
struct InstancePayload {
  args: Vec<String>,
  cwd: String,
}


fn start_aptabase_heartbeat(app: tauri::AppHandle) {
  thread::spawn(move || {
    loop {
      app.track_event("app_heartbeat💓", None);
      thread::sleep(Duration::from_secs(1 * 60 * 59));//heartbeat every hour (I'm concerned exactly 1 hour will make a new session, so I'm doing 59 minutes - you got a problem with that? That's what I thought.)
    }
  });
}

fn setup_panic_handler(client: ClientInitGuard) {
    std::panic::set_hook(Box::new(move |panic_info| {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let panic_message = format!("[{}] Panic occurred: {}", timestamp, panic_info);
        
        // Log using the log crate
        error!("{}", panic_message);

        // Also send to Sentry
        sentry::capture_message(
            &panic_message,
            sentry::Level::Fatal,
        );
        
        client.flush(Some(std::time::Duration::from_secs(2)));
    }));
}



fn main() {
    let tray_menu = build_menu();

    let client = sentry_tauri::sentry::init((
        "https://473d7b762855b5baa461a7921a5f95cc@sentry-ingest.frogbyte.io/4",
        sentry_tauri::sentry::ClientOptions {
            release: sentry_tauri::sentry::release_name!(),
            attach_stacktrace: true,
            ..Default::default()
        },
    ));

    // Initialize minidump first
    let _guard = sentry_tauri::minidump::init(&client);
    
    // Then set up panic handler
    setup_panic_handler(client);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_installed_apps, get_all_session_names, set_application_volume, connect_decker, decker::get_devices, decker::send_decker_command, get_available_midi_output_port_names, attach_midi_device, detach_midi_device, get_active_app_name, disconnect_decker, set_screen_brightness, get_all_audio_devices, get_output_devices, get_input_devices ])
        .plugin(tauri_plugin_aptabase::Builder::new("A-EU-7429874879").build()) // 👈 this is where you enter your App Key
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(sentry_tauri::plugin())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
          MacosLauncher::LaunchAgent,
          Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
          let window = app.get_window("main").unwrap();
          if window.is_visible().unwrap() == false {
            window.show().unwrap();
            show_notification("Dot X", "Dot X is already running");
          }
          if window.is_minimized().unwrap() {
            window.unminimize().unwrap();
          }
          window.set_focus().unwrap();
        }))
        .system_tray(SystemTray::new().with_menu(tray_menu))
        .on_system_tray_event(|app, event| match event {
          SystemTrayEvent::LeftClick {
            position: _,
            size: _,
            ..
        } => {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
            if window.is_minimized().unwrap() {
              window.unminimize().unwrap();
            }
            window.set_focus().unwrap();
        }
          SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
              "quit" => {
                info!("Quitting Dot X");
                app.track_event("app_exited", None);
                app.flush_events_blocking();
                std::process::exit(0);
              }
              "hide" => {
                info!("Hiding Dot X");
                trace!("HIDING!");
                let window = app.get_window("main").unwrap();
                window.hide().unwrap();
              }
              "show" => {
                info!("Showing Dot X");
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                if window.is_minimized().unwrap() {
                  window.unminimize().unwrap();
                }
                window.set_focus().unwrap();
              }
              _ => {}
            }
          }
          _ => {}
        })
        .on_window_event(|event| match event.event() {
          tauri::WindowEvent::CloseRequested { api, .. } => {
              event.window().hide().unwrap();
              api.prevent_close();
          }
          _ => {}
        })
        .setup(|app| {
          {
            power_monitor::setup_power_monitoring();
          }
          start_aptabase_heartbeat(app.handle().clone());
          let mut props_map = HashMap::new();
          props_map.insert("slider_amount".to_string(), Value::String("5".to_string()));
      
          // Convert the HashMap to a serde_json::Value
          let props_value = json!(props_map);
          app.track_event("app_started", Some(props_value));
          app.flush_events_blocking();
          let window = app.get_window("main").unwrap();
          #[cfg(any(windows, target_os = "macos"))]
          set_shadow(&window, true).unwrap();
          
          #[cfg(target_os = "macos")]
          apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
          .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
        
        #[cfg(target_os = "windows")]
        apply_mica(&window, None)
        .unwrap_or_else(|_| { let _ = apply_blur(&window, Some((25, 10, 30, 255))); });

        // This gets any command line arguments passed to the app
        match app.get_cli_matches() {
          // `matches` here is a Struct with { args, subcommand }.
          // `args` is `HashMap<String, ArgData>` where `ArgData` is a struct with { value, occurrences }.
          // `subcommand` is `Option<Box<SubcommandMatches>>` where `SubcommandMatches` is a struct with { name, matches }.
          Ok(matches) => {
            //if hidden is true, hide the window, else show it
            if let Some(arg_data) = matches.args.get("hidden") {
              if arg_data.value == Value::Bool(true) {
                  window.hide().unwrap();
              } else {
                window.show().unwrap();
              }
            }
          }
          Err(_) => {}
        }

        info!("Starting Dot X with version {:?}", sentry_tauri::sentry::release_name!());

      
        APP.set(app.handle()).expect("error setting up app");
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
  let store = StoreBuilder::new(app_handle.clone(), "config.json".parse().unwrap()).build();

  match store.get("suspendDimEnabled") {
    Some(value) => {
      // The value from the store is a serde_json::Value
      // We need to convert it to a boolean
      value.as_bool().unwrap_or(false) // Default to false if not a boolean
    },
    None => false, // Default to false if not found
  }
}

