// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]


// create the error type that represents all errors possible in our program
#[derive(Debug, thiserror::Error)]
enum Error {
  #[error(transparent)]
  Io(#[from] std::io::Error)
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
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Serialize)]
struct CustomResponse {
  app_list: Vec<String>,
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![get_installed_apps])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
