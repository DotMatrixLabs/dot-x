# dotx-active-window

A minimal GNOME Shell extension that exposes the focused window's `WM_CLASS`, title, and PID over D-Bus, read-only.

## Why this exists

On GNOME Wayland, `org.gnome.Shell.Eval` (what `active-win-pos-rs` and most other tools use to read the focused window) has been disabled since GNOME 42 for security. GNOME Shell's own built-in `org.gnome.Shell.Introspect` interface (`GetWindows`/`GetRunningApplications`) would be the obvious alternative, but it's gated behind an `xdg-desktop-portal` permission grant that only Flatpak-sandboxed apps can obtain — a plain desktop app calling it directly gets `AccessDenied`. A Shell extension runs with the Shell's own privileges and isn't subject to either restriction, so it's the only practical way to read window focus on GNOME Wayland from a non-sandboxed app.

## What it does

`extension.js` exports a single D-Bus method:

- Service: `org.gnome.Shell` (extensions run inside the Shell process and export new objects on its existing bus name)
- Object path: `/org/dotx/ActiveWindow`
- Interface: `org.dotx.ActiveWindow`
- Method: `GetFocusedWindow() -> (s wm_class, s title, i pid)`

It only ever reads `global.display.focus_window` — it never modifies window or Shell state.

Dot X's Rust backend (`src-tauri/src/gnome_active_window.rs`) calls this via `zbus` as a fallback in `get_active_app_name()`, only when `active-win-pos-rs` fails and the session looks like GNOME Wayland. If the extension isn't installed or enabled, the call fails and the existing "Unknown" fallback behavior is unchanged. The call runs on a spawned thread with a 2s timeout, since `get_active_app_name` is a synchronous IPC command polled every ~500ms and must not stall on a hung Shell/extension.

**Privacy note:** this D-Bus method has no caller restriction — any local process on the session bus can call it and read the focused window's title/PID. It's read-only, but it does reopen some of the surface `Shell.Eval`'s removal and `Introspect`'s portal-gating were meant to close. That's an intentional, narrow tradeoff for a trusted extension the user explicitly installs, not an oversight — but worth knowing before installing it.

GNOME also disables **all** user extensions while the screen is locked (a Shell security measure, not specific to this one) — expect `GetFocusedWindow` calls to fail with `UnknownMethod`/`Object does not exist` during that window; Dot X's fallback handles this the same as "extension not installed".

## Installing (development / testing)

```sh
cd gnome-extension/dotx-active-window@dot-x.dev
zip -q -r /tmp/dotx-active-window.zip metadata.json extension.js
gnome-extensions install --force /tmp/dotx-active-window.zip
gnome-extensions enable dotx-active-window@dot-x.dev
```

**GNOME will not discover a brand-new extension until the Shell restarts.** On X11 that's `Alt+F2`, `r`, `Enter`; on Wayland (the case this extension exists for) there is no in-session restart — log out and back in, or reboot. This is normal GNOME behavior for any manually-installed extension, not specific to this one. After that first relogin, `gnome-extensions enable dotx-active-window@dot-x.dev` picks it up immediately; the D-Bus interface is live as soon as it's enabled, no further restart needed.

Verify directly without the app:
```sh
gdbus call --session --dest org.gnome.Shell --object-path /org/dotx/ActiveWindow --method org.dotx.ActiveWindow.GetFocusedWindow
```

## Compatibility

`metadata.json` declares `shell-version: ["45", "46", "47", "48"]` (the ESM-based extension API introduced in GNOME 45). Verified 2026-07-03 on GNOME Shell 46.0 (Ubuntu 24.04.4, `ananords-dev`) — confirmed correct output changing live as focus moved between windows (e.g. GNOME Calculator: `('org.gnome.Calculator', 'Calculator', <pid>)`), and confirmed against the real `zbus`-based Rust client in `src-tauri/src/gnome_active_window.rs` (a standalone build of that exact source, run against the live session bus), not just raw `gdbus call`. Not tested on GNOME 47/48 or on a distro other than Ubuntu.

## Packaging for real users

This extension is not currently packaged into the Dot X installer/bundle or published to extensions.gnome.org — it must be installed manually as above. Automating that (bundling it with the app, prompting the user to install it, or publishing it so `gnome-extensions install <uuid>` / the Extensions app can find it) is a follow-up, not yet done.
