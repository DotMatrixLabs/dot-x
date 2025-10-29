use std::cell::RefCell;
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread_local;
use std::time::{SystemTime, UNIX_EPOCH};

use windows_volume_control::{AudioController, CoinitMode};

use crate::Error;

static LAST_VOLUME_CALL_MS: AtomicU64 = AtomicU64::new(0);

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub(crate) fn get_all_session_names() -> Result<Vec<String>, Error> {
    unsafe {
        let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
        controller.GetSessions();
        controller.GetDefaultAudioEnpointVolumeControl();
        controller.GetAllProcessSessions();
        controller.GetAllAudioDevices();

        let all_session_names = controller.get_all_session_names();
        Ok(all_session_names)
    }
}

// Helper function to refresh the AudioController's sessions
unsafe fn refresh_audio_controller_sessions(controller: &mut AudioController) {
    controller.GetSessions();
    controller.GetAllProcessSessions();
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

thread_local! {
    static AUDIO_CONTROLLER: RefCell<Option<AudioController>> = RefCell::new(None);
}

unsafe fn maybe_throttled_session_refresh(threshold_ms: u64) {
    let now = now_millis();
    let last_call = LAST_VOLUME_CALL_MS.swap(now, Ordering::Relaxed);
    let delta = if last_call == 0 { u64::MAX } else { now.saturating_sub(last_call) };
    if delta >= threshold_ms {
        AUDIO_CONTROLLER.with(|cell| {
            let mut opt = cell.borrow_mut();
            *opt = Some(get_initialized_audio_controller());
        });
    }
}

unsafe fn with_audio_controller<R>(f: impl FnOnce(&mut AudioController) -> R) -> R {
    AUDIO_CONTROLLER.with(|cell| {
        if cell.borrow().is_none() {
            cell.replace(Some(get_initialized_audio_controller()));
        }
        let mut borrow = cell.borrow_mut();
        let controller = borrow.as_mut().unwrap();
        f(controller)
    })
}

unsafe fn try_apply_volume(name: &str, volume: f32) -> bool {
    with_audio_controller(|controller| {
        let mut sessions = controller.get_sessions_by_name(name.to_string());
        if sessions.is_empty() {
            refresh_audio_controller_sessions(controller);
            sessions = controller.get_sessions_by_name(name.to_string());
        }
        if sessions.is_empty() {
            return false;
        }
        for session in sessions {
            if volume < 0.01 {
                session.setMute(true);
                session.setVolume(0.0);
            } else {
                session.setMute(false);
                session.setVolume(volume);
            }
        }
        true
    })
}

#[tauri::command]
pub(crate) fn set_application_volume(name: &str, volume: f32) -> Result<(), Error> {
    unsafe {
        maybe_throttled_session_refresh(500);
        if try_apply_volume(name, volume) {
            return Ok(());
        }

        AUDIO_CONTROLLER.with(|cell| cell.replace(Some(get_initialized_audio_controller())));
        if try_apply_volume(name, volume) {
            return Ok(());
        }

        return Err(Error::SessionNotFound);
    }
}

#[tauri::command]
pub(crate) fn get_all_audio_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = get_initialized_audio_controller();
        let all_device_names = controller.get_all_device_names();
        Ok(all_device_names)
    }
}

#[tauri::command]
pub(crate) fn get_output_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = get_initialized_audio_controller();
        let output_device_names = controller.get_output_device_names();
        Ok(output_device_names)
    }
}

#[tauri::command]
pub(crate) fn get_input_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = get_initialized_audio_controller();
        let input_device_names = controller.get_input_device_names();
        Ok(input_device_names)
    }
}


