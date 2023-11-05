// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


use tauri::{ Manager, Window };
use windows_volume_control::AudioController;
use windows_volume_control::CoinitMode;
use tauri_plugin_autostart::MacosLauncher;
use std::fmt;
mod decker;

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
            session.setVolume(volume);
        } else {
            // Handle the case where the session was not found (e.g., return an error)
            return Err(Error::SessionNotFound);
        }
    }

    Ok(())
}


#[tauri::command]
fn connect_decker(window: Window) -> Result<(), Error> {
    decker::initialize_decker(window)?;
    Ok(())
}




fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_installed_apps, get_all_session_names, set_application_volume, connect_decker])
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
          MacosLauncher::LaunchAgent,
          None,
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
