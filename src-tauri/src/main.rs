// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


use tauri::{ Manager, Window };
use windows_volume_control::AudioController;
use windows_volume_control::CoinitMode;
use tauri_plugin_autostart::MacosLauncher;
use std::fmt;
mod decker;
use tauri::{CustomMenuItem, SystemTrayMenu, SystemTrayMenuItem, SystemTray, SystemTrayEvent};

// create the error type that represents all errors possible in our program
#[derive(Debug, thiserror::Error)]
enum Error {
  #[error(transparent)]
  Io(#[from] std::io::Error),
  SessionNotFound,
  Connection,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Error::Io(inner) => write!(f, "IO Error: {}", inner),
            Error::SessionNotFound => write!(f, "Session not found"),
            Error::Connection => write!(f, "Decker error"),
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
fn set_application_volume(name: &str, volume: f32) -> Result<(), Error> {
    unsafe {
        let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
        controller.GetSessions();
        controller.GetDefaultAudioEnpointVolumeControl();
        controller.GetAllProcessSessions();

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

#[derive(Clone, serde::Serialize)]
struct InstancePayload {
  args: Vec<String>,
  cwd: String,
}


fn main() {
    let tray_menu = build_menu();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_installed_apps, get_all_session_names, set_application_volume, connect_decker, decker::get_devices])
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
          MacosLauncher::LaunchAgent,
          None,
        ))
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
          println!("{}, {argv:?}, {cwd}", app.package_info().name);

          app.emit_all("single-instance", InstancePayload { args: argv, cwd }).unwrap();
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
