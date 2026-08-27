use std::cell::{Cell, RefCell};
use std::thread_local;
use std::time::{Duration, Instant};

use windows_sys::Win32::System::Com::CoUninitialize;
use windows_volume_control::{AudioController, CoinitMode};

use crate::Error;

const SESSION_REFRESH_IDLE: Duration = Duration::from_millis(500);

struct ComAudioController {
    inner: Option<AudioController>,
}

impl ComAudioController {
    unsafe fn new() -> Self {
        unsafe {
            let mut controller = AudioController::init(Some(CoinitMode::ApartmentThreaded));
            controller.GetSessions();
            controller.GetDefaultAudioEnpointVolumeControl();
            controller.GetAllProcessSessions();
            controller.GetAllAudioDevices();
            Self {
                inner: Some(controller),
            }
        }
    }

    fn controller(&self) -> &AudioController {
        self.inner
            .as_ref()
            .expect("audio controller is initialized")
    }

    fn controller_mut(&mut self) -> &mut AudioController {
        self.inner
            .as_mut()
            .expect("audio controller is initialized")
    }
}

impl Drop for ComAudioController {
    fn drop(&mut self) {
        // Release every COM interface before balancing AudioController::init's
        // successful CoInitializeEx call on this thread.
        drop(self.inner.take());
        unsafe { CoUninitialize() };
    }
}

#[tauri::command]
pub(crate) fn get_all_session_names() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = ComAudioController::new();
        let all_session_names = controller.controller().get_all_session_names();
        Ok(all_session_names)
    }
}

fn refresh_due(last_call: Option<Instant>, now: Instant, threshold: Duration) -> bool {
    last_call.is_none_or(|last| now.saturating_duration_since(last) >= threshold)
}

fn replace_controller<T>(slot: &mut Option<T>, create: impl FnOnce() -> T) {
    // Drop the previous controller and its COM interfaces before initializing
    // the replacement on the same thread.
    *slot = None;
    *slot = Some(create());
}

thread_local! {
    static AUDIO_CONTROLLER: RefCell<Option<ComAudioController>> = const { RefCell::new(None) };
    static LAST_VOLUME_CALL: Cell<Option<Instant>> = const { Cell::new(None) };
}

unsafe fn reset_audio_controller() {
    AUDIO_CONTROLLER.with(|cell| {
        replace_controller(&mut cell.borrow_mut(), || unsafe {
            ComAudioController::new()
        });
    });
}

unsafe fn maybe_refresh_after_idle() {
    let now = Instant::now();
    let should_refresh = LAST_VOLUME_CALL.with(|last_call| {
        let previous = last_call.replace(Some(now));
        refresh_due(previous, now, SESSION_REFRESH_IDLE)
    });

    if should_refresh {
        unsafe { reset_audio_controller() };
    }
}

unsafe fn with_audio_controller<R>(f: impl FnOnce(&mut AudioController) -> R) -> R {
    AUDIO_CONTROLLER.with(|cell| {
        if cell.borrow().is_none() {
            replace_controller(&mut cell.borrow_mut(), || unsafe {
                ComAudioController::new()
            });
        }
        let mut borrow = cell.borrow_mut();
        let controller = borrow
            .as_mut()
            .expect("audio controller cache is initialized")
            .controller_mut();
        f(controller)
    })
}

unsafe fn try_apply_volume(name: &str, volume: f32) -> bool {
    unsafe {
        with_audio_controller(|controller| {
            let sessions = controller.get_sessions_by_name(name.to_string());
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
}

#[tauri::command]
pub(crate) fn set_application_volume(name: &str, volume: f32) -> Result<(), Error> {
    unsafe {
        maybe_refresh_after_idle();
        if try_apply_volume(name, volume) {
            return Ok(());
        }

        reset_audio_controller();
        if try_apply_volume(name, volume) {
            return Ok(());
        }

        Err(Error::SessionNotFound)
    }
}

#[tauri::command]
pub(crate) fn get_all_audio_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = ComAudioController::new();
        let all_device_names = controller.controller().get_all_device_names();
        Ok(all_device_names)
    }
}

#[tauri::command]
pub(crate) fn get_output_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = ComAudioController::new();
        let output_device_names = controller.controller().get_output_device_names();
        Ok(output_device_names)
    }
}

#[tauri::command]
pub(crate) fn get_input_devices() -> Result<Vec<String>, Error> {
    unsafe {
        let controller = ComAudioController::new();
        let input_device_names = controller.controller().get_input_device_names();
        Ok(input_device_names)
    }
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::rc::Rc;
    use std::time::{Duration, Instant};

    use super::{refresh_due, replace_controller};

    #[test]
    fn refreshes_on_first_call_and_after_idle_threshold() {
        let now = Instant::now();
        let threshold = Duration::from_millis(500);

        assert!(refresh_due(None, now, threshold));
        assert!(!refresh_due(
            Some(now - Duration::from_millis(499)),
            now,
            threshold
        ));
        assert!(refresh_due(Some(now - threshold), now, threshold));
    }

    #[test]
    fn drops_previous_controller_before_creating_replacement() {
        struct DropTracker(Rc<Cell<usize>>);

        impl Drop for DropTracker {
            fn drop(&mut self) {
                self.0.set(self.0.get() + 1);
            }
        }

        let drops = Rc::new(Cell::new(0));
        let mut controller = Some(DropTracker(Rc::clone(&drops)));

        replace_controller(&mut controller, || {
            assert_eq!(drops.get(), 1);
            DropTracker(Rc::clone(&drops))
        });

        assert!(controller.is_some());
        assert_eq!(drops.get(), 1);
    }
}
