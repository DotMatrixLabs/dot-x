# Linux Support Goals - Dot X

## How to Start Any Session

> I'm adding Linux support to Dot X, a Tauri 2 desktop app. The goal list is at `LINUX-SUPPORT.md` in the repo root. **First check which machine you're running on** — the test machine may be local (no SSH) or remote.

Testing is done on Ubuntu. Currently up for testing:

- **`ananords-dev` (local machine)** — Ubuntu 24.04.3 LTS (kernel 6.17.0-19-generic), real Decker (`VM-5SW`) on `/dev/ttyACM0`, GNOME Wayland session on tty2. No `/sys/class/backlight`; external HP 24uh monitor on HDMI-A-1 (`/dev/i2c-1`), DDC/CI working. Primary test machine — run commands directly, no SSH needed.
- `ssh ananords@192.168.68.149` — previously used remote Ubuntu 24.04.3 machine. SSH key may need re-installing if host key changed.

To launch the app on `ananords-dev` with the live Wayland display:
```sh
WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
  XDG_CURRENT_DESKTOP=ubuntu:GNOME \
  src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```

---

## TODO — Things that still need fixing

| Priority | What | Why it's broken | Fix |
|---|---|---|---|
| High | **Screen brightness (DDC/CI)** | `brightness` crate 0.8 is sysfs-only. `/sys/class/backlight/` is empty on this desktop (external monitor only). Tauri `set_screen_brightness` silently no-ops — no error, no effect. | Switch to DDC/CI: use the `ddc-hi` crate, shell out to `ddcutil`, or bind `libddcutil`. The HP 24uh on `/dev/i2c-1` responds correctly to `ddcutil setvcp 10 <val>`. Also needs a laptop to test the sysfs path. |
| High | **Active window — GNOME Wayland** | `active-win-pos-rs` 0.11 uses `org.gnome.Shell.Eval` which was disabled in GNOME 42 for security. `Shell.Eval` returns `(false, '')`. MIDI/Decker automation that depends on focus detection won't trigger on GNOME Wayland. | Need a GNOME Shell extension exposing active-window via a safe D-Bus interface, or upstream PR to `active-win-pos-rs` using an alternative Mutter API. |
| Medium | **`psp` path dep must be resolved** | `src-tauri/Cargo.toml` uses `psp = { path = "../../psp" }` which only works when `psp` is checked out alongside. CI and any machine without that path will fail to build. | Push the `psp` fix to `github.com/Frogbyte-io/psp` and switch back to the git dep (already commented in Cargo.toml). |
| Medium | **MIDI CC send/receive round-trip** | Only port enumeration has been tested. Actually sending and receiving control-change messages has not been exercised. | Connect two virtual MIDI ports (`snd-virmidi`) and test the full CC round-trip from the app UI. |
| Medium | **Full plugin round-trip** | Deno runtime extracts and runs. The actual plugin load/execute/event flow has not been tested end-to-end from the UI. | Install a test `.dotxplugin`, verify it loads, executes, and emits events. |
| Low | **App auto-updates on Linux** | Bundles build with `createUpdaterArtifacts` but update flow has not been validated. | Needs `TAURI_SIGNING_PRIVATE_KEY` (release secret) + an update endpoint, then trigger and validate the update flow. |
| Low | **CI on Linux** | No CI job exists for Linux. The branch can only be built manually. | Add a Linux job to CI that installs the build deps and runs `yarn tauri build`. |

---

## Verified working on Linux

These have all been functionally tested on `ananords-dev` (Ubuntu 24.04.3, GNOME Wayland) or noted otherwise:

- **App build / run / package** — builds (debug + release), installs from `.deb`, launches and stays running, packages as `.deb` + `.AppImage`.
- **GUI window on GNOME Wayland** — verified 2026-06-29: app launches with `WAYLAND_DISPLAY=wayland-0`, WebKit2GTK starts `WebKitNetworkProcess` + `WebKitWebProcess`, Wayland surface is created, window renders. `window.show()` and `window.hide()` both work (logged). **Note:** window starts hidden (`visible: false` in config). The `--hidden` CLI arg check is a no-op when the flag is absent, so the app is tray-first — user sees nothing on launch until they click the tray icon (or a second instance is launched).
- **System tray** — fully verified 2026-06-29 on GNOME Wayland: ayatana-appindicator icon registers with `org.kde.StatusNotifierWatcher`, `IsStatusNotifierHostRegistered=true`, icon visible in GNOME panel. Show/hide via tray menu and tray-click both work.
- **Single-instance detection** — second launch sends `ExecuteCallback` to the first instance via D-Bus (`org.com_dot_x_dev.SingleInstance`); first instance shows its window and second instance exits without full initialization.
- **Per-app audio control** — list sessions, set per-app volume (round-trip: set `0.25` → reads back `0.25`), mute (round-trip verified). Tested against pipewire-pulse with a real `pw-play` sink-input. 3 backend bugs fixed in `volume-control-rs` (see below).
- **Audio output / input device lists** — listed and named correctly (`get_output_device_names` / `get_input_device_names`).
- **Installed applications list** — `.desktop` parsing returns real apps with name / executable / source.
- **Active window detection (X11)** — `active-win-pos-rs` 0.11 returns correct `app_name` (from `WM_CLASS`) and `pid` under Xvfb + openbox. *(GNOME Wayland is broken — see TODO above.)*
- **MIDI device enumeration** — `midir` (ALSA backend) lists input and output ports. Requires user to be in the `audio` group for `/dev/snd/seq` access (a real desktop login grants this; SSH sessions may not). CC send/receive not yet tested.
- **Deno runtime** — bundled `deno-x86_64-unknown-linux-gnu.zip` extracts, `chmod +x`, and runs.
- **Power monitor (`psp`)** — no longer panics headless; logind session resolution degrades gracefully over SSH; suspend/resume events are now actually emitted. Fix is in `../../psp` (path dep — see TODO to publish).
- **Serial port / Decker** — fully verified end-to-end on `ananords-dev` (Ubuntu 24.04, `VM-5SW` Decker fw `0.0.3` at `/dev/ttyACM0`, VID `04d8`/1240, PID `e626`/58918): `get_devices()` enumerates with correct VID/PID, `connect_decker` opens port + sets DTR, 75+ live `slider-change` events decoded by `rmp_serde`, `get-device-info` round-trip returns firmware/model/serial.
- **Auto-start on login** — `tauri_plugin_autostart` writes/removes `~/.config/autostart/Dot X.desktop` (XDG autostart spec). Enable/disable/is_enabled round-trip verified on Ubuntu 24.04.
- **Windows-only crates removed/gated** — `winreg` dropped; `window-vibrancy` / `window-shadows` gated to non-Linux.

---

## Goals checklist

- [x] App compiles and runs on Linux
- [x] App packages as `.deb` and `.AppImage`
- [x] GUI window renders on GNOME Wayland
- [x] System tray icon appears and functions (GNOME Wayland verified)
- [x] Single-instance detection works
- [x] Audio session control works (per-app volume + mute, round-trip verified)
- [x] Audio output devices listed and selectable
- [x] Audio input (mic) devices listed and selectable
- [x] Installed applications listed
- [x] Active window detection works (X11 verified; GNOME Wayland broken — see TODO)
- [x] Serial port / Decker works end-to-end
- [x] Auto-start on login works
- [x] Deno runtime runs (plugin system partially working)
- [~] Plugin system works — Deno runs; full round-trip not yet tested
- [ ] Screen brightness control works — **blocked: sysfs-only crate, DDC/CI not wired**
- [ ] MIDI CC send/receive round-trip
- [ ] Active window on GNOME Wayland — **broken by design (Shell.Eval disabled)**
- [ ] App auto-updates on Linux
- [ ] CI builds and tests on Linux automatically

---

## Backend bug fixes made on this branch

### `volume-control-rs` Linux audio backend
1. **Teardown crash** — `AudioController` declared `mainloop` before `context`, so Rust dropped the mainloop before the context and libpulse aborted (`Assertion '!e->dead'`). Fixed by reordering fields and cleaning up in `Drop`.
2. **Setters were no-ops on quick teardown** — `set_volume`/`set_mute` submitted ops with no callback and didn't wait, so ops never reached the server before drop. Now block until a completion callback fires.
3. **Asymmetric volume** — setter used `VolumeLinear` (cubic curve) but getter read raw `cv.avg()/NORMAL`, so set `0.25` read back `~0.63`. Getter now applies the inverse `VolumeLinear` conversion; round-trip correct.

### `psp` Linux power monitor
- Replaced all `.unwrap()` calls with proper error propagation so it cannot panic.
- Logind session resolution (`/org/freedesktop/login1/session/auto`) now fails gracefully over SSH/containers — suspend/resume monitoring stays alive.
- `PrepareForSleep` signal now emits `PowerState::Suspend` / `PowerState::Resume` (previously only `dbg!`'d).
- **Dependency note:** `src-tauri/Cargo.toml` uses `psp = { path = "../../psp" }`. Must publish fix and switch to git dep before CI or other machines can build (see TODO).

### Linux Decker serial device listing
- Default listing filters out noisy legacy `/dev/ttyS*` (type `Unknown`) while listing USB devices normally.
- `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N` — append PTY endpoints for virtual firmware testing.
- `DOTX_SHOW_ALL_SERIAL_PORTS=1` — expose all `serialport::available_ports()` entries for debugging.
- Serial thread read-error handling exits cleanly instead of panicking.

---

## Linux Build Prerequisites

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
- `libwebkit2gtk-4.1-dev` / `librsvg2-dev` / `libgtk-3-dev` — Tauri 2 webview. `libgtk-3-dev` must be listed explicitly even though `libwebkit2gtk-4.1-dev` pulls in the runtime.
- **Ubuntu 24.04 quirk:** `libsoup-3.0.pc` is installed as `libsoup-3.0` but `soup3-sys` looks for `soup-3.0`. Fix: `sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/libsoup-3.0.pc /usr/lib/x86_64-linux-gnu/pkgconfig/soup-3.0.pc`
- **Ubuntu 24.04 quirk:** if `libpsl-dev` / `libsysprof-capture-4-dev` show "no installation candidate", a foreign dpkg arch (e.g. arm64) is configured without a matching repo. Fix: `sudo dpkg --remove-architecture arm64 && sudo apt-get update`.
- `libxcb-ewmh-dev` / `libxcb-randr0-dev` — `active-win-pos-rs` X11/XCB backend.
- `libdbus-1-dev` — D-Bus for `psp` (logind power events).
- `libpulse-dev` — `volume-control-rs` Linux audio backend. Runtime needs `libpulse0`; on PipeWire systems, `pipewire-pulse` provides the server.
- `libudev-dev` — `libudev-sys` (used by `serialport` and `brightness`).
- `libasound2-dev` — `alsa-sys` for `midir` ALSA backend.
- `libayatana-appindicator3-dev` — system tray. Runtime needs `libayatana-appindicator3-1`.

For DDC/CI brightness (once implemented): `libddcutil-dev` at build time, `i2c-dev` kernel module at runtime.

---

## Building on Linux

```sh
# from repo root
yarn install
yarn tauri build            # produces .deb and .AppImage
```

Bundle targets are `["deb", "appimage"]` via `src-tauri/tauri.linux.conf.json` (Tauri auto-merges this on top of `tauri.conf.json`). That file also scopes Linux resource bundling to the Linux Deno archive and declares `libpulse0` as a `.deb` runtime dependency.

> **AppImage note:** AppImage bundling downloads `linuxdeploy` tooling on first run and needs FUSE. On headless/CI use `appimagetool --appimage-extract-and-run` or run under `xvfb`.
