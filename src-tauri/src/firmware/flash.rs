use std::sync::atomic::{AtomicBool, Ordering};

static FLASHING: AtomicBool = AtomicBool::new(false);

/// True while a firmware update owns the serial port. The decker connection loop
/// refuses to open the port during this time.
pub fn is_flashing() -> bool {
    FLASHING.load(Ordering::SeqCst)
}

#[cfg(test)]
pub fn test_set_flashing(v: bool) {
    FLASHING.store(v, Ordering::SeqCst);
}
