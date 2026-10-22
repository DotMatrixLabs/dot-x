use std::cell::{Cell, RefCell};
use std::collections::HashSet;
use std::sync::Mutex;
use std::thread;
use std::thread_local;
use std::time::{Duration, Instant};

use log::{error, info};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use windows_sys::Win32::System::Com::CoUninitialize;
use windows_volume_control::{AudioController, CoinitMode, VolumeMonitor};

use crate::Error;

const SESSION_REFRESH_IDLE: Duration = Duration::from_millis(500);
const VOLUME_SYNC_POLL_INTERVAL: Duration = Duration::from_millis(250);
const VOLUME_SYNC_CONTROLLER_REFRESH: Duration = Duration::from_secs(2);

/// Force volume sync: while enabled, a polling thread puts every mapped session back to
/// the volume Dot X last set, so changes made in the Windows volume mixer don't stick.
struct VolumeSyncState {
    monitor: Option<VolumeMonitor>,
    generation: u64,
    /// Session names the UI has mapped to a slider, kept here so the polling thread can
    /// seed a target for sessions the user hasn't moved a slider for yet.
    mapped_sessions: Vec<String>,
}

impl VolumeSyncState {
    const fn new() -> Self {
        Self {
            monitor: None,
            generation: 0,
            mapped_sessions: Vec::new(),
        }
    }

    fn enable(&mut self, monitor: VolumeMonitor) -> Option<u64> {
        if self.monitor.is_some() {
            return None;
        }

        self.generation = self.generation.wrapping_add(1);
        self.monitor = Some(monitor);
        Some(self.generation)
    }

    fn disable(&mut self) {
        if let Some(monitor) = self.monitor.as_ref() {
            monitor.stop_polling();
        }
        self.monitor = None;
        self.mapped_sessions.clear();
    }

    fn is_current_generation(&self, generation: u64) -> bool {
        self.monitor.is_some() && self.generation == generation
    }
}

static VOLUME_SYNC_STATE: Mutex<VolumeSyncState> = Mutex::new(VolumeSyncState::new());

fn run_for_current_volume_sync_generation<F>(
    state: &Mutex<VolumeSyncState>,
    generation: u64,
    action: F,
) -> bool
where
    F: FnOnce(&VolumeMonitor),
{
    let state = state.lock().unwrap();
    if !state.is_current_generation(generation) {
        return false;
    }

    action(state.monitor.as_ref().unwrap());
    true
}

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
    // Record the sync target before applying the volume, so the polling thread doesn't
    // restore the previous target over this change.
    {
        let state = VOLUME_SYNC_STATE.lock().unwrap();
        if let Some(monitor) = state.monitor.as_ref() {
            monitor.mark_setting(name);
            let _ = monitor.update_expected_volume(name, volume);
        }
    }

    let result = unsafe { apply_application_volume(name, volume) };

    {
        let state = VOLUME_SYNC_STATE.lock().unwrap();
        if let Some(monitor) = state.monitor.as_ref() {
            monitor.unmark_setting(name);
        }
    }

    result
}

unsafe fn apply_application_volume(name: &str, volume: f32) -> Result<(), Error> {
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

/// Starts force volume sync. Calling it while sync is already running does nothing.
#[tauri::command]
pub(crate) fn enable_volume_sync(app: AppHandle) -> Result<(), Error> {
    let generation = {
        let mut state = VOLUME_SYNC_STATE.lock().unwrap();
        match state.enable(VolumeMonitor::new()) {
            Some(generation) => generation,
            None => {
                info!("Volume sync already enabled");
                return Ok(());
            }
        }
    };

    start_volume_sync_polling(generation);

    info!("Volume sync enabled");
    crate::track_analytics_event(&app, "volume_sync_enabled", None);

    Ok(())
}

#[tauri::command]
pub(crate) fn disable_volume_sync() -> Result<(), Error> {
    VOLUME_SYNC_STATE.lock().unwrap().disable();
    info!("Volume sync disabled");
    Ok(())
}

#[tauri::command]
pub(crate) fn update_volume_sync_mappings(session_names: Vec<String>) -> Result<(), Error> {
    let mut state = VOLUME_SYNC_STATE.lock().unwrap();
    if let Some(monitor) = state.monitor.as_ref() {
        monitor.set_mapped_sessions(session_names.clone());
    }
    // Remembered so the polling thread can seed targets for these sessions, both for the
    // ones running right now and for the ones started later.
    state.mapped_sessions = session_names;

    Ok(())
}

/// Turns force volume sync back on at startup if the user left it enabled.
pub(crate) fn restore_volume_sync(app: &AppHandle) {
    let enabled = match app.store("config.json") {
        Ok(store) => store
            .get("volumeSyncEnabled")
            .and_then(|value| value.as_bool())
            .unwrap_or(false),
        Err(err) => {
            error!("Failed to open config store: {err}");
            false
        }
    };

    if enabled {
        if let Err(err) = enable_volume_sync(app.clone()) {
            error!("Failed to enable volume sync on startup: {err:?}");
        }
    }
}

/// Stops the polling thread. Called before the app exits.
pub(crate) fn stop_volume_sync() {
    VOLUME_SYNC_STATE.lock().unwrap().disable();
}

fn start_volume_sync_polling(generation: u64) {
    thread::spawn(move || {
        // The controller is rebuilt on this thread every couple of seconds to pick up new
        // and ended sessions. Dropping it balances its COM initialization.
        let mut controller = Some(unsafe { ComAudioController::new() });
        let mut last_controller_refresh = Instant::now();
        unsafe { seed_expected_volumes(controller.as_ref().unwrap().controller(), generation) };

        loop {
            thread::sleep(VOLUME_SYNC_POLL_INTERVAL);

            let session_names = {
                let state = VOLUME_SYNC_STATE.lock().unwrap();
                if !state.is_current_generation(generation) {
                    break;
                }
                let monitor = state.monitor.as_ref().unwrap();
                if !monitor.is_polling_active() {
                    break;
                }
                // Only sessions that have a target need polling.
                monitor.get_polling_session_names()
            };

            if last_controller_refresh.elapsed() > VOLUME_SYNC_CONTROLLER_REFRESH {
                replace_controller(&mut controller, || unsafe { ComAudioController::new() });
                last_controller_refresh = Instant::now();
                // Newly visible sessions may be mapped without ever having been set.
                unsafe { seed_expected_volumes(controller.as_ref().unwrap().controller(), generation) };
            }

            let controller = controller.as_ref().unwrap().controller();
            for session_name in session_names {
                let expected_volume = {
                    let state = VOLUME_SYNC_STATE.lock().unwrap();
                    if !state.is_current_generation(generation) {
                        return;
                    }
                    state.monitor.as_ref().and_then(|monitor| {
                        if monitor.should_ignore_restore(&session_name) {
                            None
                        } else {
                            monitor.get_expected_volume(&session_name)
                        }
                    })
                };

                let Some(expected_volume) = expected_volume else {
                    continue;
                };

                unsafe {
                    let sessions = controller.get_sessions_by_name(session_name.clone());
                    let needs_restore = sessions
                        .iter()
                        .any(|session| (session.getVolume() - expected_volume).abs() > 0.001);
                    if needs_restore {
                        run_for_current_volume_sync_generation(
                            &VOLUME_SYNC_STATE,
                            generation,
                            |monitor| {
                                monitor.mark_setting(&session_name);
                                for session in sessions {
                                    session.setVolume(expected_volume);
                                }
                                monitor.unmark_setting(&session_name);
                            },
                        );
                    }
                }
            }
        }
    });
}

/// Matches the names the UI mapped against the names the audio sessions actually report.
/// The UI stores installed-app names, which differ in casing from the session names that
/// the monitor keys its targets by.
fn resolve_mapped_session_names(mapped: &[String], session_names: &[String]) -> Vec<String> {
    let mapped_lowercase: HashSet<String> = mapped.iter().map(|name| name.to_lowercase()).collect();

    session_names
        .iter()
        .filter(|name| mapped_lowercase.contains(&name.to_lowercase()))
        .cloned()
        .collect()
}

/// Gives the polling loop a target for every mapped session that doesn't have one yet, by
/// taking the session's current volume as the target. Without this the target map only
/// fills up when a slider moves, so sync enabled on startup - or an app mapped or launched
/// while sync is running - restores nothing until the user touches the slider.
unsafe fn seed_expected_volumes(controller: &AudioController, generation: u64) {
    let mapped = {
        let state = VOLUME_SYNC_STATE.lock().unwrap();
        if !state.is_current_generation(generation) {
            return;
        }
        state.mapped_sessions.clone()
    };

    if mapped.is_empty() {
        return;
    }

    let resolved =
        resolve_mapped_session_names(&mapped, &unsafe { controller.get_all_session_names() });
    if resolved.is_empty() {
        return;
    }

    let current_volumes: Vec<(String, f32)> = resolved
        .iter()
        .filter_map(|name| unsafe {
            controller
                .get_session_by_name(name.clone())
                .map(|session| (name.clone(), session.getVolume()))
        })
        .collect();

    apply_seeded_expected_volumes(
        &VOLUME_SYNC_STATE,
        generation,
        &mapped,
        resolved,
        current_volumes,
    );
}

/// Applies one seed pass, but only if the mappings it was built from are still the current
/// ones. Querying the controller happens without the lock, so a mapping change in that
/// window would otherwise be overwritten by this stale snapshot - and a change that cleared
/// the mappings would never be corrected, because later passes return early on the now
/// empty list and leave the removed sessions being polled and restored.
/// Skipping is safe: the pass that runs on the next controller refresh sees the new mappings.
fn apply_seeded_expected_volumes(
    state: &Mutex<VolumeSyncState>,
    generation: u64,
    mapped: &[String],
    resolved: Vec<String>,
    current_volumes: Vec<(String, f32)>,
) -> bool {
    let state = state.lock().unwrap();
    if !state.is_current_generation(generation) {
        return false;
    }

    if state.mapped_sessions.as_slice() != mapped {
        return false;
    }

    let monitor = state.monitor.as_ref().unwrap();
    // The resolved names are what the monitor keys targets by, so they have to count as
    // mapped too, otherwise the targets seeded below are filtered out again.
    let mut allowed = mapped.to_vec();
    allowed.extend(resolved);
    monitor.set_mapped_sessions(allowed);

    for (session_name, volume) in current_volumes {
        if monitor.get_expected_volume(&session_name).is_none() {
            let _ = monitor.update_expected_volume(&session_name, volume);
        }
    }

    true
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
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Barrier, Mutex};
    use std::thread;
    use std::time::{Duration, Instant};

    use windows_volume_control::VolumeMonitor;

    use super::{
        VolumeSyncState, apply_seeded_expected_volumes, refresh_due, replace_controller,
        resolve_mapped_session_names, run_for_current_volume_sync_generation,
    };

    #[test]
    fn disabling_volume_sync_invalidates_the_previous_polling_generation() {
        let mut state = VolumeSyncState::new();
        let first_generation = state
            .enable(VolumeMonitor::new())
            .expect("first enable should start a polling generation");

        state.disable();

        let second_generation = state
            .enable(VolumeMonitor::new())
            .expect("re-enable should start a new polling generation");
        assert!(!state.is_current_generation(first_generation));
        assert!(state.is_current_generation(second_generation));
    }

    #[test]
    fn mapped_names_resolve_to_the_session_names_targets_are_keyed_by() {
        let mapped = vec![
            "Spotify".to_string(),
            "chrome(2)".to_string(),
            "unmapped".to_string(),
        ];
        let sessions = vec![
            "spotify".to_string(),
            "chrome(2)".to_string(),
            "Discord".to_string(),
        ];

        let resolved = resolve_mapped_session_names(&mapped, &sessions);

        assert_eq!(resolved, vec!["spotify".to_string(), "chrome(2)".to_string()]);
    }

    #[test]
    fn seeding_applies_when_the_mappings_it_was_built_from_are_unchanged() {
        let state = Mutex::new(VolumeSyncState::new());
        let generation = state
            .lock()
            .unwrap()
            .enable(VolumeMonitor::new())
            .expect("enable should start a polling generation");
        state.lock().unwrap().mapped_sessions = vec!["Spotify".to_string()];

        let applied = apply_seeded_expected_volumes(
            &state,
            generation,
            &["Spotify".to_string()],
            vec!["spotify".to_string()],
            vec![("spotify".to_string(), 0.4)],
        );

        assert!(applied);
        let state = state.lock().unwrap();
        let monitor = state.monitor.as_ref().unwrap();
        assert_eq!(monitor.get_expected_volume("spotify"), Some(0.4));
    }

    #[test]
    fn seeding_is_skipped_when_the_mappings_changed_while_the_controller_was_queried() {
        let state = Mutex::new(VolumeSyncState::new());
        let generation = state
            .lock()
            .unwrap()
            .enable(VolumeMonitor::new())
            .expect("enable should start a polling generation");
        // The user unmapped everything while this pass was reading the controller.
        state.lock().unwrap().mapped_sessions = Vec::new();

        let applied = apply_seeded_expected_volumes(
            &state,
            generation,
            &["Spotify".to_string()],
            vec!["spotify".to_string()],
            vec![("spotify".to_string(), 0.4)],
        );

        assert!(!applied);
        let state = state.lock().unwrap();
        let monitor = state.monitor.as_ref().unwrap();
        assert_eq!(monitor.get_expected_volume("spotify"), None);
    }

    #[test]
    fn disabling_volume_sync_forgets_the_mapped_sessions() {
        let mut state = VolumeSyncState::new();
        state
            .enable(VolumeMonitor::new())
            .expect("enable should start a polling generation");
        state.mapped_sessions = vec!["Spotify".to_string()];

        state.disable();

        assert!(state.mapped_sessions.is_empty());
    }

    #[test]
    fn stale_polling_generation_cannot_restore_after_reenable() {
        let state = Arc::new(Mutex::new(VolumeSyncState::new()));
        let first_generation = state
            .lock()
            .unwrap()
            .enable(VolumeMonitor::new())
            .expect("first enable should start a polling generation");
        let restore_ready = Arc::new(Barrier::new(2));
        let continue_restore = Arc::new(Barrier::new(2));
        let restored = Arc::new(AtomicBool::new(false));

        let worker_state = Arc::clone(&state);
        let worker_ready = Arc::clone(&restore_ready);
        let worker_continue = Arc::clone(&continue_restore);
        let worker_restored = Arc::clone(&restored);
        let worker = thread::spawn(move || {
            worker_ready.wait();
            worker_continue.wait();
            run_for_current_volume_sync_generation(&worker_state, first_generation, |_| {
                worker_restored.store(true, Ordering::SeqCst)
            })
        });

        restore_ready.wait();
        {
            let mut state = state.lock().unwrap();
            state.disable();
            state
                .enable(VolumeMonitor::new())
                .expect("re-enable should start a new polling generation");
        }
        continue_restore.wait();

        assert!(!worker.join().unwrap());
        assert!(!restored.load(Ordering::SeqCst));
    }

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
