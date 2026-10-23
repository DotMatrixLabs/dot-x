use psp::monitor::PowerMonitor;
use std::sync::atomic::{AtomicU64, Ordering};

pub static COMPUTER_SLEEPING_GEN: AtomicU64 = AtomicU64::new(0);

pub fn schedule_sleep_flag_auto_reset(timeout_ms: u64) {
    let generation = COMPUTER_SLEEPING_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(timeout_ms));
        if COMPUTER_SLEEPING_GEN.load(Ordering::SeqCst) == generation {
            unsafe {
                if crate::decker::COMPUTER_SLEEPING {
                    crate::decker::COMPUTER_SLEEPING = false;
                    log::info!("psp: Auto-reset COMPUTER_SLEEPING after {} ms", timeout_ms);
                }
            }
        }
    });
}

pub fn setup_power_monitoring() {
    let pm = Box::new(PowerMonitor::new());
    let rx = pm.event_receiver();
    // psp's Linux backend can panic (e.g. unwrapping the logind
    // `/org/freedesktop/login1/session/auto` object) when there is no graphical
    // logind session — over SSH, in containers, or some headless setups. Power
    // monitoring is non-essential, so isolate any panic and keep the app running.
    let listen_result =
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| pm.start_listening()));

    match listen_result {
        Err(_) => {
            log::error!(
                "psp: power monitor initialization panicked; continuing without power monitoring"
            );
        }
        Ok(Err(e)) => {
            log::error!("psp: failed to start listener: {e}");
        }
        Ok(Ok(())) => {
        // Keep monitor alive for the lifetime of the app
        let _leak = Box::leak(pm);
        std::thread::spawn(move || {
            loop {
                match rx.recv() {
                    Ok(event) => {
                        let ev = format!("{:?}", event);
                        if ev.contains("Suspend") {
                            log::info!("psp: Suspend detected");
                            unsafe {
                                crate::decker::COMPUTER_SLEEPING = true;
                            }
                            schedule_sleep_flag_auto_reset(5000);

                            // Check if suspend dimming is enabled
                            let suspend_dim_enabled = crate::get_suspend_dim_enabled();

                            if suspend_dim_enabled {
                                log::info!("psp: Dimming LEDs on suspend");
                                crate::decker::set_device_brightness(0);
                            } else {
                                log::info!("psp: LED dimming disabled, skipping dim on suspend");
                            }
                            crate::decker::disconnect_decker();
                        } else if ev.contains("Resume") {
                            log::info!("psp: Resume detected");
                            unsafe {
                                crate::decker::COMPUTER_SLEEPING = false;
                            }
                        } else if ev.contains("ScreenLocked") {
                            log::info!("psp: Screen locked");
                        } else if ev.contains("ScreenUnlocked") {
                            unsafe {
                                crate::decker::COMPUTER_SLEEPING = false;
                            }
                            log::info!("psp: Screen unlocked");
                        } else {
                            log::info!("psp: event: {}", ev);
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        }
    }
}
