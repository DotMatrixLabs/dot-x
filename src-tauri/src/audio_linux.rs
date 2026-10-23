// Linux counterpart of audio.rs, backed by volume-control-rs (PulseAudio). Exposes the
// same commands so the frontend can invoke them on both platforms.

use tauri::AppHandle;
use volume_control_rs::{AudioController, CoinitMode};

use crate::Error;

fn get_initialized_audio_controller() -> AudioController {
    let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
    controller.get_sessions();
    controller.get_default_audio_endpoint_volume_control();
    controller.get_all_process_sessions();
    controller.get_all_audio_devices();
    controller
}

#[tauri::command]
pub(crate) fn get_all_session_names() -> Result<Vec<String>, Error> {
    Ok(get_initialized_audio_controller().get_all_session_names())
}

#[tauri::command]
pub(crate) fn set_application_volume(name: &str, volume: f32) -> Result<(), Error> {
    let controller = get_initialized_audio_controller();
    let sessions = controller.get_sessions_by_name(name.to_string());
    if sessions.is_empty() {
        return Err(Error::SessionNotFound);
    }

    for session in sessions {
        if volume < 0.01 {
            session.set_mute(true);
            session.set_volume(0.0);
        } else {
            session.set_mute(false);
            session.set_volume(volume);
        }
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn get_all_audio_devices() -> Result<Vec<String>, Error> {
    Ok(get_initialized_audio_controller().get_all_device_names())
}

#[tauri::command]
pub(crate) fn get_output_devices() -> Result<Vec<String>, Error> {
    Ok(get_initialized_audio_controller().get_output_device_names())
}

#[tauri::command]
pub(crate) fn get_input_devices() -> Result<Vec<String>, Error> {
    Ok(get_initialized_audio_controller().get_input_device_names())
}

// Force volume sync is Windows-only for now.

#[tauri::command]
pub(crate) fn enable_volume_sync(_app: AppHandle) -> Result<(), Error> {
    Err(Error::Unsupported("Force volume sync is not supported on Linux yet"))
}

#[tauri::command]
pub(crate) fn disable_volume_sync() -> Result<(), Error> {
    Ok(())
}

#[tauri::command]
pub(crate) fn update_volume_sync_mappings(_session_names: Vec<String>) -> Result<(), Error> {
    Ok(())
}

pub(crate) fn restore_volume_sync(_app: &AppHandle) {}

pub(crate) fn stop_volume_sync() {}
