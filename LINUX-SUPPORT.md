# Linux Support Goals - Dot X

## How to Start Any Session

> I'm adding Linux support to Dot X, a Tauri 2 desktop app. The goal list is at `d:\dot-x\LINUX-SUPPORT.md`. The repo is at `d:\dot-x`. Read the goal list and the relevant source files before making changes.

---

## What Needs Porting

| What | Current | Needs | Status |
|---|---|---|---|
| Per-app audio control | `volume-control-rs` (custom crate) | Linux backend (PulseAudio/PipeWire) | ✅ Done — Linux backend rewritten to compile against `libpulse-binding` 2.30 (`Arc<Mutex<Mainloop>>`, `VolumeLinear` conversion, guard-scoped `result` borrows). Builds clean |
| Active window detection | `active-win-pos-rs` `0.11.0` | X11/XCB, KDE Wayland, Hyprland Wayland | ✅ Code in place + failure-context diagnostics. ⚠️ GNOME Wayland still needs validation |
| Installed apps list | `installed` crate (`linux-support` branch) | Parse `.desktop` files | ✅ Branch has a cfg-gated `platform/linux.rs`; struct fields match. Runtime test pending |
| Registry access | `winreg` | Remove — not needed on Linux | ✅ Removed (was unused) |
| Window blur/Mica effect | `window-vibrancy` / `window-shadows` | Skip on Linux (or KDE blur later) | ✅ Both crates excluded from Linux via `cfg(not(target_os = "linux"))`; usage already `cfg(windows)`-gated. ⚠️ No Linux blur yet |
| Deno runtime binary | `resources/deno/deno-x86_64-pc-windows-msvc.zip` | Add Linux archive | ✅ Added `deno-x86_64-unknown-linux-gnu.zip` (v2.4.3); extraction + `chmod +x` implemented |
| Hide console on spawn | `CREATE_NO_WINDOW` Win32 flag | Gate out on Linux | ✅ Already `cfg(windows)`-gated |
| Screen brightness | `brightness` crate | sysfs / DDC-CI | ⚠️ Cross-platform crate; runtime test pending (DDC/CI may need `libddcutil-dev` + `i2c-dev`) |
| MIDI devices | `midir` | ALSA backend | ⚠️ Cross-platform; runtime test pending |
| Serial port (Decker) | `serialport` | Linux backend | ⚠️ Cross-platform; runtime test pending |
| Power suspend/resume | `psp` crate (Frogbyte) | logind / D-Bus | ⚠️ `psp` ships a Linux (`zbus`/logind) backend **but it `unwrap()`s a logind call for `/org/freedesktop/login1/session/auto`**, which panics when that object isn't resolvable (SSH, containers, some headless sessions) — and the D-Bus call blocks ~25s until timeout first. Worked around app-side: power-monitor init now runs on a background thread wrapped in `catch_unwind`, so it can neither block startup nor crash the app. **Upstream fix needed in `psp`** (handle the error instead of `unwrap`; don't block) |

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
- `libpulse-dev` — links `libpulse-binding` for the `volume-control-rs` Linux audio backend. Runtime needs `libpulse0` (declared as a `.deb` dependency).
- `libudev-dev` — required by `libudev-sys` (pulled in by `serialport`/`brightness`).
- `libasound2-dev` — required by `alsa-sys` (the `midir` ALSA backend).
- `libayatana-appindicator3-dev` — system tray icon. Runtime needs `libayatana-appindicator3-1`.

`active-win-pos-rs` should be tested on X11, KDE Wayland, Hyprland Wayland, and GNOME Wayland. GNOME Wayland may require a follow-up fork or upstream contribution if the compositor does not expose active-window information through the currently supported backends.

`brightness` (screen brightness) uses sysfs for internal panels and DDC/CI for external monitors. If DDC/CI control is required, install `libddcutil-dev` at build time and ensure the `i2c-dev` kernel module is loaded at runtime — validate on the VM.

---

## Building on Linux

```sh
# from repo root
yarn install
yarn tauri build            # produces .deb and .AppImage (see bundle targets below)
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

- [x] App compiles and runs on Linux — **verified on Ubuntu 26.04**: builds (debug + release), installs from `.deb`, launches and stays running, extracts & runs the bundled Deno runtime, initializes the tray and store
- [x] App packages as `.deb` and `.AppImage` — **verified**: both bundles produced by `yarn tauri build` (`.deb` installs cleanly; only the Linux Deno archive is shipped). *Updater-artifact signing needs `TAURI_SIGNING_PRIVATE_KEY` (a release secret) — unrelated to packaging.*
- [~] Audio session control works - list, mute, and set volume per application — *backend compiles & is wired; functional test needs an audio sink on the VM*
- [~] Audio output devices are listed and selectable — *backend ready; functional test pending*
- [~] Audio input (mic) devices are listed and selectable — *backend ready; functional test pending*
- [~] Plugin system works - plugins install, load, and run via the Deno runtime — *Deno runtime extracts & runs (`deno 2.4.3`) verified; full plugin round-trip test pending*
- [~] Active window detection works (reports which app is in focus) — *`active-win-pos-rs` 0.11 compiled in; runtime test pending (needs a windowed session)*
- [~] Installed applications are listed — *`installed` Linux backend compiled in; runtime test pending*
- [~] Screen brightness control works — *`brightness` compiled in; runtime test pending (VM has no backlight)*
- [x] System tray icon appears and functions — *tray (libayatana-appindicator) initializes at startup; needs a panel/SNI host for full interaction*
- [ ] Auto-start on login works
- [ ] App auto-updates work on Linux — *bundles build with `createUpdaterArtifacts`; needs signing key + endpoint validation*
- [ ] CI builds and tests on Linux automatically
- [x] `volume-control-rs` - cross-platform audio crate replacing `windows-volume-control`, with Windows and Linux backends — Linux backend now compiles and is wired up

### Build/runtime fixes made on this branch
- **`volume-control-rs` Linux backend**: rewrote against `libpulse-binding` 2.30 — `Arc<Mutex<Mainloop>>` (all `Mainloop` methods need `&mut`), `Volume::from(VolumeLinear(..))` for linear conversion, ready-state polling instead of `mainloop.wait()`, and guard-scoped `result` borrows. (Previously 29 compile errors; never built on Linux before.)
- **Deno on Linux**: bundled `deno-x86_64-unknown-linux-gnu.zip` (v2.4.3) and implemented zip extraction + `chmod 0o755` for Unix in `ensure_deno_extracted`.
- **`psp` panic**: power-monitor init moved to a background thread + `catch_unwind` so its logind `unwrap`/timeout can't crash or stall the app. See the power row above — upstream `psp` fix still recommended.
- **Removed/gated Windows-only crates**: dropped unused `winreg`; gated `window-vibrancy`/`window-shadows` to non-Linux.
- **Per-platform bundling**: `tauri.linux.conf.json` sets `deb`+`appimage` targets, ships only the Linux Deno archive, and declares `libpulse0`.

### Build deps discovered on the VM (now in the prerequisites above)
`libpulse-dev` (audio), `libudev-dev` (`serialport`/`brightness`), `libasound2-dev` (`midir` ALSA). Most Tauri libs (webkit2gtk-4.1, gtk3, xcb, appindicator, dbus) were already present on Ubuntu 26.04.
