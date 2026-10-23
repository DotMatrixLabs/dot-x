// Dot X starts hidden on autostart and closes to its tray icon. On Linux that icon
// is a StatusNotifierItem (libayatana-appindicator), which is only shown when a
// StatusNotifierWatcher with a registered host is on the session bus. Stock GNOME
// has none unless an AppIndicator extension is enabled; hiding the window there
// leaves the app running with no way to reach it.
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use zbus::blocking::Connection;
use zbus::proxy;

#[proxy(
    default_service = "org.kde.StatusNotifierWatcher",
    default_path = "/StatusNotifierWatcher",
    interface = "org.kde.StatusNotifierWatcher"
)]
trait StatusNotifierWatcher {
    #[zbus(property)]
    fn is_status_notifier_host_registered(&self) -> zbus::Result<bool>;
}

// Called from window-event handlers and setup, which must not stall on a hung bus.
const CALL_TIMEOUT: Duration = Duration::from_secs(2);

fn query_host_registered() -> Option<bool> {
    // No session bus means we can't tell; keep the tray-first behavior.
    let connection = Connection::session().ok()?;
    let host_registered = StatusNotifierWatcherProxyBlocking::new(&connection)
        .and_then(|proxy| proxy.is_status_notifier_host_registered())
        .unwrap_or(false);
    Some(host_registered)
}

/// Whether a tray host will display Dot X's tray icon. Defaults to `true` when the
/// session bus can't be reached or doesn't answer in time.
pub fn tray_available() -> bool {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(query_host_registered());
    });
    rx.recv_timeout(CALL_TIMEOUT).ok().flatten().unwrap_or(true)
}
