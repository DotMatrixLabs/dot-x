// GNOME Wayland disabled `org.gnome.Shell.Eval` for security (GNOME 42+), and the
// built-in `org.gnome.Shell.Introspect` interface's `GetWindows`/`GetRunningApplications`
// are gated behind a portal permission grant that a non-Flatpak-sandboxed app like Dot X
// cannot obtain. The `dotx-active-window@dot-x.dev` GNOME Shell extension (see
// `gnome-extension/` in the repo root) runs with the Shell's own privileges and exports a
// small read-only D-Bus interface instead. If the extension isn't installed/enabled, every
// call here fails and the caller should fall back to its existing "Unknown" behavior.
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use zbus::blocking::Connection;
use zbus::proxy;

#[proxy(
    default_service = "org.gnome.Shell",
    default_path = "/org/dotx/ActiveWindow",
    interface = "org.dotx.ActiveWindow"
)]
trait ActiveWindow {
    fn get_focused_window(&self) -> zbus::Result<(String, String, i32)>;
}

// get_active_app_name is a synchronous #[tauri::command] polled every ~500ms
// (see src/ts/volumeControl.ts), so a hung Shell/extension must not be able to
// stall the webview's IPC thread up to zbus's own (much longer) call timeout.
const CALL_TIMEOUT: Duration = Duration::from_secs(2);

fn call_get_focused_window() -> Option<(String, String, i32)> {
    let connection = Connection::session().ok()?;
    let proxy = ActiveWindowProxyBlocking::new(&connection).ok()?;
    proxy.get_focused_window().ok()
}

/// Returns the focused window's WM_CLASS via the `dotx-active-window` GNOME Shell
/// extension. `None` if the extension isn't installed/enabled, D-Bus is unavailable,
/// there's no focused window, or the call doesn't complete within `CALL_TIMEOUT`.
pub fn get_gnome_active_window_class() -> Option<String> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(call_get_focused_window());
    });

    let (wm_class, _title, _pid) = rx.recv_timeout(CALL_TIMEOUT).ok()??;
    if wm_class.is_empty() {
        None
    } else {
        Some(wm_class)
    }
}
