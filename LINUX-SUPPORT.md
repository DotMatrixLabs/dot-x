# Linux Support Goals - Dot X

## How to Start Any Session

> I'm adding Linux support to Dot X, a Tauri 2 desktop app. The goal list is at `d:\dot-x\LINUX-SUPPORT.md`. The repo is at `d:\dot-x`. Read the goal list and the relevant source files before making changes.

Testing is done on an Ubuntu 26.04 VirtualBox VM reached over SSH (`ssh dotx@127.0.0.1 -p 2222`). The VM now has a live PipeWire/pipewire-pulse audio server and `Xvfb` + `openbox` available, so the audio and X11 paths can be functionally exercised headless. Edit on Windows, `scp -P 2222` / `tar | ssh` the changed files to `~/dotx-build/{dot-x,volume-control-rs,psp}`, build on the VM.

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
- **Windows-only crates removed/gated** — `winreg` dropped; `window-vibrancy` / `window-shadows` gated to non-Linux.

---

## Still needs work / unverified

| What | Current | Next step |
|---|---|---|
| Screen brightness | `brightness` crate compiles & is wired | Untested — the VM has no backlight. Needs real hardware (sysfs) or external monitor DDC/CI (`libddcutil-dev` build dep + `i2c-dev` module). |
| MIDI — CC round-trip | enumeration verified | Sending/receiving control-change messages over a port not yet exercised (only port listing). |
| Serial port (Decker) | `serialport` compiles; Linux device enumeration verified on VM | Default picker lists the real USB Decker (`/dev/ttyACM0`, VID `1240`, PID `58918`). For VM/PTY testing, set `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N`; for raw debug enumeration, set `DOTX_SHOW_ALL_SERIAL_PORTS=1`. Full firmware protocol round-trip is still pending. |
| Active window — GNOME Wayland | X11 verified; Hyprland + KDE backends compiled | Validate on GNOME Wayland (the VM's real session). GNOME Wayland may not expose active-window info through the supported backends — may need a fork/upstream contribution. |
| Auto-start on login | — | Not implemented (e.g. write a `~/.config/autostart/*.desktop`). |
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
  libwebkit2gtk-4.1-dev librsvg2-dev \
  libxcb-ewmh-dev libxcb-randr0-dev libdbus-1-dev \
  libpulse-dev libudev-dev libasound2-dev \
  libayatana-appindicator3-dev
```

Package notes:
- `libwebkit2gtk-4.1-dev` / `librsvg2-dev` — Tauri 2 webview backend (and the usual Tauri build deps).
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
- [ ] Auto-start on login works
- [ ] App auto-updates work on Linux — *needs signing key + endpoint validation*
- [ ] CI builds and tests on Linux automatically
- [x] `volume-control-rs` — cross-platform audio crate replacing `windows-volume-control`, Linux backend now functional (3 bugs fixed)
- [x] `psp` power monitor — no longer panics headless; suspend/resume emitted (fix in `D:\psp`)

### Build deps discovered on the VM (now in the prerequisites above)
`libpulse-dev` (audio), `libudev-dev` (`serialport`/`brightness`), `libasound2-dev` (`midir` ALSA). Most Tauri libs (webkit2gtk-4.1, gtk3, xcb, appindicator, dbus) were already present on Ubuntu 26.04.
