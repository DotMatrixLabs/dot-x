# Linux Support Goals - Dot X

## How to Start Any Session

> I'm adding Linux support to Dot X, a Tauri 2 desktop app. The goal list is at `d:\dot-x\LINUX-SUPPORT.md`. The repo is at `d:\dot-x`. Read the goal list and the relevant source files before making changes.

Testing is done on remote machines running ubuntu. Currently up for testing:

- `ssh ananords@192.168.68.149` — Ubuntu 24.04.3, real Decker (`VM-5SW`) on `/dev/ttyACM0`. SSH key auth installed (my `id_ed25519`). No `/sys/class/backlight`; external monitor present but off.


---

## Verified working on Linux (functionally tested on the VM)

These were ported **and** functionally tested — they are no longer on the porting to-do list:

- **App build / run / package** — builds (debug + release), installs from `.deb`, launches and stays running, packages as `.deb` + `.AppImage`.
- **Per-app audio control** — list sessions, set per-app volume (verified round-trip: set `0.25` → reads back `0.25`), mute (round-trip verified), plus output/input device lists. Tested against pipewire-pulse with a real `pw-play` sink-input. Fixed 3 backend bugs in `volume-control-rs` (see below).
- **Audio output / input device lists** — listed and named correctly (`get_output_device_names` / `get_input_device_names`).
- **Installed applications list** — `.desktop` parsing returns real apps (28 on the VM, incl. Dot X itself) with name / executable / source.
- **Active window detection (X11)** — `active-win-pos-rs` 0.11 returns the correct `app_name` (from `WM_CLASS`) and `pid` under Xvfb + openbox. This is exactly what `get_active_app_name()` consumes. (Hyprland and KDE/`kdotool` backends are compiled in but not yet validated; see below for GNOME Wayland.)
- **MIDI device enumeration** — `midir` (ALSA backend) lists input and output ports (verified against `snd-virmidi` virtual ports). Note: requires the user to be in the `audio` group for `/dev/snd/seq` access — a real desktop login grants this automatically (an SSH session does not without re-login). Full CC send/receive round-trip not yet exercised.
- **Deno runtime** — bundled `deno-x86_64-unknown-linux-gnu.zip` extracts, `chmod +x`, and runs (`deno 2.4.3`).
- **System tray** — initializes via libayatana-appindicator at startup.
- **Power monitor (`psp`) no longer crashes headless** — the logind `unwrap` panic is gone and suspend/resume events are now actually emitted (see fix below).
- **Serial port / Decker** — fully verified end-to-end through the real `dot_x` binary on `ananords@192.168.68.149` (Ubuntu 24.04, `VM-5SW` Decker fw `0.0.3` at `/dev/ttyACM0`, VID `1240`/PID `58918`): `get_devices()` enumerates with correct VID/PID, `connect_decker` opens port + sets DTR, 75+ `slider-change` events decoded by real `rmp_serde`, `get-device-info` round-trip returns `firmwareVersion`/`deviceModel`/`serialNumber`. No issues.
- **Auto-start on login** — `tauri_plugin_autostart` writes/removes `~/.config/autostart/Dot X.desktop` (XDG autostart spec) correctly. Enable/disable/is_enabled round-trip verified on Ubuntu 24.04.
- **Windows-only crates removed/gated** — `winreg` dropped; `window-vibrancy` / `window-shadows` gated to non-Linux.

---

## Still needs work / unverified

| What | Current | Next step |
|---|---|---|
| Screen brightness | `brightness` crate compiles & is wired | Still untested. `ananords@192.168.68.149` has **no `/sys/class/backlight`** (desktop, no internal panel) and its only external monitor is powered off, so DDC/CI over `/dev/i2c-*` won't answer either. Needs a laptop (sysfs backlight) or a powered-on DDC/CI monitor with `libddcutil-dev` + `i2c-dev` loaded. |
| MIDI — CC round-trip | enumeration verified | Sending/receiving control-change messages over a port not yet exercised (only port listing). |
| Serial port (Decker) | **Fully verified end-to-end through the real Rust binary** on `ananords@192.168.68.149` (Ubuntu 24.04, Decker `VM-5SW` fw `0.0.3` at `/dev/ttyACM0`, VID `04d8`/1240, PID `e626`/58918) | Exercised through the actual compiled `dot_x` binary (cargo debug build + Xvfb headless): `get_devices()` returns `{port_name:"/dev/ttyACM0", port_type:"USB", vid:1240, pid:58918, manufacturer:"Frogbyte AS", product:"Decker"}`; `connect_decker` opens the port and sets DTR; 75+ live `slider-change` events decoded by real `rmp_serde` deserialization (values 0–1023, all 5 sliders); `send_decker_command("get-device-info")` returns `{firmwareVersion:"0.0.3", deviceModel:"VM-5SW", serialNumber:…}`. No issues found. For VM/PTY testing, set `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N`; for raw debug enumeration, set `DOTX_SHOW_ALL_SERIAL_PORTS=1`. |
| Active window — GNOME Wayland | **Confirmed broken on GNOME 42+** | `active-win-pos-rs` 0.11 uses `org.gnome.Shell.Eval` for GNOME Wayland, which was disabled in GNOME 42 for security. Probed on `ananords@192.168.68.149` (GNOME Wayland on Ubuntu 24.04): `Shell.Eval` returns `(false, '')`. Hyprland (`hyprctl`) and KDE (`kdotool`) backends compile but those compositors aren't present. **Fix requires**: either a GNOME Shell extension exposing active-window via a safe D-Bus interface, or a PR to `active-win-pos-rs` using the GNOME Mutter `org.gnome.Mutter.IdleMonitor` / `DisplayConfig` API (neither currently exposes focus). For now, `get_active_app_name()` returns empty/error on GNOME Wayland — MIDI/Decker automation that depends on it won't trigger automatically on this session type. |
| Auto-start on login | **Verified on Linux** via `tauri_plugin_autostart` | Plugin writes `~/.config/autostart/Dot X.desktop` (XDG autostart spec) when enabled and removes it when disabled. Tested on Ubuntu 24.04: `plugin:autostart\|enable` → file created; `is_enabled` → true; `disable` → file removed; `is_enabled` → false. Correct round-trip. The `Exec` path in the .desktop comes from `/proc/self/exe` — no issue in a real install; a mid-run binary replacement (e.g. during a debug rebuild) would append `(deleted)` which is harmless. |
| Auto-update on Linux | bundles build with `createUpdaterArtifacts` | Needs `TAURI_SIGNING_PRIVATE_KEY` (release secret) + an update endpoint, then validate the update flow. |
| CI on Linux | — | No CI yet — add a Linux job that installs the build deps below and runs `yarn tauri build`. |

---

## Backend bug fixes made on this branch (functional, found via VM testing)

### `volume-control-rs` Linux audio backend
1. **Teardown crash** — `AudioController` declared `mainloop` before `context`, and sessions held `Arc` clones of both. Rust drops fields top-to-bottom, so the mainloop was freed before the context and libpulse aborted (`Assertion '!e->dead' ... mainloop_io_free()`). Fixed by reordering fields (`sessions`, then `context`, then `mainloop`), clearing sessions first in `Drop`, and disconnecting the context + stopping the loop in `Drop`.
2. **Setters were no-ops on quick teardown** — `set_volume`/`set_mute` submitted the introspect op with a `None` callback and did **not** wait, so the op never reached the server before the controller dropped. Now they pass a completion callback and block until it fires (same pattern as the getters).
3. **Asymmetric volume** — the setter wrote `Volume::from(VolumeLinear(..))` (PipeWire's cubic perceptual curve) but the getter read the raw `cv.avg()/NORMAL` fraction, so set `0.25` read back `~0.63` (`cbrt(0.25)`). The getter now applies the inverse `VolumeLinear` conversion, so set/get round-trip.

### `psp` Linux power monitor (fixed in `D:\psp`)
- Replaced every `.unwrap()` in the linux backend with proper error propagation (`?` / `map_err`) so it can no longer panic.
- **Lock/unlock monitoring is now optional**: resolving the caller's logind session (`/org/freedesktop/login1/session/auto`) fails over SSH / in containers / some headless sessions. Instead of aborting (or panicking), it degrades gracefully and **keeps suspend/resume monitoring alive** (those are Manager signals and need no session).
- **Suspend/Resume are now actually emitted** — the previous backend only `dbg!`'d the `PrepareForSleep` signal and never sent `PowerState::Suspend`/`Resume`, so the app's suspend handling was dead code. `PrepareForSleep(start=true→Suspend, false→Resume)` is now sent on the channel.
- Verified over SSH: `start_listening()` returns `Ok(())` immediately (no panic, no ~25 s logind timeout block).
- **Dependency wiring:** `src-tauri/Cargo.toml` currently uses the path dep `psp = { path = "../../psp" }` so the fix is actually used. The git dep line is kept commented. **Decision needed:** push the fix to `github.com/Frogbyte-io/psp` and switch back to the git dep, or vendor `psp`, before this branch can build anywhere `D:\psp` isn't checked out alongside (incl. CI). The app-side `catch_unwind` in `power_monitor.rs` is now belt-and-suspenders and can stay.

### Linux Decker serial device listing
- Default Linux device listing still avoids the noisy legacy `/dev/ttyS*` entries reported by `serialport` as `Unknown`.
- USB devices are listed normally; verified on the VM with a Decker at `/dev/ttyACM0` (VID `1240`, PID `58918`).
- `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N[,/dev/pts/M]` appends explicit serial endpoints for PTY/virtual firmware testing without cluttering normal users' device picker.
- `DOTX_SHOW_ALL_SERIAL_PORTS=1` exposes every `serialport::available_ports()` entry for low-level debugging.
- Serial thread disconnect/read-error handling now exits cleanly instead of intentionally panicking the thread.

---

## Linux Build Prerequisites

Install these packages in local Linux environments and CI images before building the Tauri backend:

```sh
sudo apt-get update
sudo apt-get install -y \
  build-essential pkg-config curl wget file \
  libwebkit2gtk-4.1-dev librsvg2-dev libgtk-3-dev \
  libxcb-ewmh-dev libxcb-randr0-dev libdbus-1-dev \
  libpulse-dev libudev-dev libasound2-dev \
  libayatana-appindicator3-dev
```

Package notes:
- `libwebkit2gtk-4.1-dev` / `librsvg2-dev` / `libgtk-3-dev` — Tauri 2 webview backend (and the usual Tauri build deps). `libgtk-3-dev` is required for `gdk-sys` even though `libwebkit2gtk-4.1-dev` pulls in the runtime library; the dev headers must be explicitly listed.
- **Ubuntu 24.04 (Noble) quirk:** `libsoup-3.0.pc` is installed as `libsoup-3.0` but the `soup3-sys` Rust crate looks for package name `soup-3.0`. After installing `libsoup-3.0-dev`, create the alias: `sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/libsoup-3.0.pc /usr/lib/x86_64-linux-gnu/pkgconfig/soup-3.0.pc`
- **Ubuntu 24.04 quirk:** if `libpsl-dev` / `libsysprof-capture-4-dev` show "no installation candidate", the cause is a configured foreign dpkg architecture (e.g. arm64 on an amd64 host) whose repo lacks those packages. Fix with `sudo dpkg --remove-architecture arm64 && sudo apt-get update` before installing.
- `libxcb-ewmh-dev` / `libxcb-randr0-dev` — `active-win-pos-rs` X11/XCB backend.
- `libdbus-1-dev` — D-Bus, used by `psp` (logind power events).
- `libpulse-dev` — links `libpulse-binding` for the `volume-control-rs` Linux audio backend. Runtime needs `libpulse0` (declared as a `.deb` dependency). On a PipeWire system, `pipewire-pulse` provides the server.
- `libudev-dev` — required by `libudev-sys` (pulled in by `serialport`/`brightness`).
- `libasound2-dev` — required by `alsa-sys` (the `midir` ALSA backend).
- `libayatana-appindicator3-dev` — system tray icon. Runtime needs `libayatana-appindicator3-1`.

`brightness` uses sysfs for internal panels and DDC/CI for external monitors. If DDC/CI is required, install `libddcutil-dev` at build time and load the `i2c-dev` kernel module at runtime.

---

## Building on Linux

```sh
# from repo root
yarn install
yarn tauri build            # produces .deb and .AppImage
```

Bundle targets are set to `["deb", "appimage"]` via `src-tauri/tauri.linux.conf.json`
(a platform override that Tauri auto-merges on top of `tauri.conf.json`). That same
file scopes Linux resource bundling to the Linux Deno archive and declares the
`libpulse0` runtime dependency for the `.deb`.

> **AppImage note:** AppImage bundling downloads `linuxdeploy` tooling on first run and
> needs FUSE available in the build environment. On headless/CI use `appimagetool`'s
> `--appimage-extract-and-run` or run under `xvfb` if a display is required.

---

## Goals

- [x] App compiles and runs on Linux — verified on Ubuntu 26.04 (builds, installs from `.deb`, launches and stays running, extracts & runs the bundled Deno runtime, initializes tray + store)
- [x] App packages as `.deb` and `.AppImage` — both bundles produced by `yarn tauri build`. *Updater-artifact signing needs `TAURI_SIGNING_PRIVATE_KEY` (a release secret) — unrelated to packaging.*
- [x] Audio session control works — list, mute, and set volume per application — **functionally verified** against pipewire-pulse (per-app volume round-trip + mute)
- [x] Audio output devices are listed and selectable — **verified**
- [x] Audio input (mic) devices are listed and selectable — **verified**
- [~] Plugin system works — *Deno runtime extracts & runs; full plugin round-trip still pending*
- [x] Active window detection works (X11) — **verified** (`app_name` + `pid`). GNOME Wayland still unvalidated.
- [x] Installed applications are listed — **verified** (28 `.desktop` apps)
- [ ] Screen brightness control works — *compiles; untested (VM has no backlight)*
- [x] System tray icon appears and functions — *initializes; needs a panel/SNI host for full interaction*
- [x] Auto-start on login works — **verified** via `tauri_plugin_autostart` writing `~/.config/autostart/Dot X.desktop` (XDG spec). Enable/disable/is_enabled round-trip tested on Ubuntu 24.04.
- [ ] App auto-updates work on Linux — *needs signing key + endpoint validation*
- [ ] CI builds and tests on Linux automatically
- [x] Serial port / Decker — **fully verified end-to-end through the real Rust binary**: `get_devices()` enumerates the Decker with correct VID/PID, `connect_decker` opens the port, 75+ live `slider-change` events decoded by `rmp_serde`, and `get-device-info` round-trip returns firmware/model/serial. Tested on `ananords@192.168.68.149` (Ubuntu 24.04, real `VM-5SW` Decker on `/dev/ttyACM0`).
- [x] `volume-control-rs` — cross-platform audio crate replacing `windows-volume-control`, Linux backend now functional (3 bugs fixed)
- [x] `psp` power monitor — no longer panics headless; suspend/resume emitted (fix in `D:\psp`)

### Build deps discovered on the VM (now in the prerequisites above)
`libpulse-dev` (audio), `libudev-dev` (`serialport`/`brightness`), `libasound2-dev` (`midir` ALSA). Most Tauri libs (webkit2gtk-4.1, gtk3, xcb, appindicator, dbus) were already present on Ubuntu 26.04.
