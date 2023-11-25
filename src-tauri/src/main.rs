// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


use tauri::AppHandle;
use tauri::{ Manager, Window };
use windows_volume_control::AudioController;
use windows_volume_control::CoinitMode;
use tauri_plugin_autostart::MacosLauncher;
use midir::{MidiOutput};
use std::fmt;
mod decker;
mod midi;
use tauri::{CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem, SystemTray, SystemTrayEvent};
use tauri::api::notification::Notification;
use window_vibrancy::{apply_vibrancy, apply_blur, apply_mica, NSVisualEffectMaterial};
use window_shadows::set_shadow;
use once_cell::sync::OnceCell;
use sentry_tauri::sentry;


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
      Err(error) => {
          // Handle the error here, or return it if you prefer.
          return Err(Error::InitError);
      }  };

  let output_ports_result = midi::midi::get_available_output_ports();
  let output_ports = match output_ports_result {
      Ok(output_ports) => output_ports,
      Err(error) => {
          // Handle the error here, or return it if you prefer.
          return Err(Error::InitError);
      }  
    };
  
  for (i, p) in output_ports.iter().enumerate() {
      let port_name_result = midi_out.port_name(p);
      let port_name = match port_name_result {
          Ok(port_name) => available_ports.push(port_name),
          Err(error) => {
              // Handle the error here, or return it if you prefer.
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

        // Collect all session names
        let all_session_names = controller.get_all_session_names();

        Ok(all_session_names)
    }
}

#[tauri::command]
fn attach_midi_device(output_name: &str, output_port: u32) -> Result<(), Error> {
    let midi_controller = midi::midi::new("Decker", output_port);
    match midi_controller {
      Ok(midi_controller) => {
        println!("Midi port {}: Port name: {}", output_port, output_name);
        unsafe { midi::midi::ENABLED = true; }
      }
      Err(error) => {
        // Handle the error here, or return it if you prefer.
        println!("Error{:?} ", error);
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
fn set_application_volume(name: &str, volume: f32) -> Result<(), Error> {
    unsafe {
        let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
        controller.GetSessions();
        controller.GetDefaultAudioEnpointVolumeControl();
        controller.GetAllProcessSessions();

        println!("All session names: {:?}", controller.get_all_session_names());

        // Get the current session by name
        let current_session = controller.get_session_by_name(name.to_string());

        // Check if the session was found
        if let Some(session) = current_session {
            // Set the volume for the current session
            println!("Setting volume for session: {}", name);
            println!("{}", session.getVolume().to_string());
            if volume < 0.01 {
              session.setMute(true);
            } else {
              session.setMute(false);
              session.setVolume(volume);
            }
        } else {
            // Handle the case where the session was not found (e.g., return an error)
            return Err(Error::SessionNotFound);
        }
    }

    Ok(())
}




#[tauri::command]
fn connect_decker(window: Window, port_name: &str) -> Result<(), Error> {
  decker::initialize_decker(window, port_name)?;
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


fn main() {
    let tray_menu = build_menu();


    let client = sentry_tauri::sentry::init((
      "https://d85ea8b9310b2fa28a036ce4cf5dd449@o4506258387959808.ingest.sentry.io/4506258413387776",
      sentry_tauri::sentry::ClientOptions {
          release: sentry_tauri::sentry::release_name!(),
          ..Default::default()
      },
    ));

    let _guard = sentry_tauri::minidump::init(&client);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_installed_apps, get_all_session_names, set_application_volume, connect_decker, decker::get_devices, decker::send_decker_command, get_available_midi_output_port_names, attach_midi_device, detach_midi_device])
        .plugin(sentry_tauri::plugin())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
          MacosLauncher::LaunchAgent,
          None,
        ))
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
          show_notification("Dot X", "Dot X is already running");
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
        }
          SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
              "quit" => {
                std::process::exit(0);
              }
              "hide" => {
                let window = app.get_window("main").unwrap();
                window.hide().unwrap();
              }
              "show" => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
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
          let window = app.get_window("main").unwrap();
          #[cfg(any(windows, target_os = "macos"))]
          set_shadow(&window, true).unwrap();
          
          #[cfg(target_os = "macos")]
          apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
          .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
        
        #[cfg(target_os = "windows")]
        apply_mica(&window, None)
        .unwrap_or_else(|_| { let _ = apply_blur(&window, Some((25, 10, 30, 255))); });
      
        APP.set(app.handle()).expect("error setting up app");
          Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_app_handle() -> &'static AppHandle {
  APP.get().expect("AppHandle not initialized")
}