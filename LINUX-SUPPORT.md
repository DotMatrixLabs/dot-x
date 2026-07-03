# Linux Support Goals - Dot X

## How to Start Any Session

> I'm adding Linux support to Dot X, a Tauri 2 desktop app. The goal list is at `LINUX-SUPPORT.md` in the repo root. **First check which machine you're running on** — the test machine may be local (no SSH) or remote.

Testing is done on Ubuntu. Currently up for testing:

- **`ananords-dev` (local machine)** — Ubuntu 24.04.3 LTS (kernel 6.17.0-19-generic), real Decker (`VM-5SW`) on `/dev/ttyACM0`, GNOME Wayland session on tty2. No `/sys/class/backlight`; external HP 24uh monitor on HDMI-A-1 (`/dev/i2c-1`), DDC/CI working. Primary test machine — run commands directly, no SSH needed.
- **`bazzite`** — Also available for testing. NVIDIA GeForce GTX 1660 SUPER (driver 610.43), KDE Plasma/KWin Wayland. The app used to crash immediately on launch here; as of 2026-07-02 the app pulls in the `webkit2gtk-nvidia-quirk` crate, which detects NVIDIA + session type at startup and sets `__NV_DISABLE_EXPLICIT_SYNC=1` (Wayland) or `WEBKIT_DISABLE_DMABUF_RENDERER=1` (X11) itself, so no manual workaround is needed (see "Verified working on Linux"). For development/builds, prefer Distrobox instead of the immutable host; native Bazzite has the runtime `.so` files but not the `-devel` pkg-config metadata or unversioned linker names needed by `yarn tauri dev`. Real Decker also present at `/dev/ttyACM0`, but the user account isn't in the `dialout` group and the `99-dot-x.rules` udev rule isn't installed on this machine, so serial access needs one of those fixed before Decker/MIDI-round-trip testing can happen here.
- `ssh ananords@192.168.68.149` — previously used remote Ubuntu 24.04.3 machine. SSH key may need re-installing if host key changed.

To launch the app on `ananords-dev` with the live Wayland display:
```sh
WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
  XDG_CURRENT_DESKTOP=ubuntu:GNOME \
  src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```

To launch the app on `bazzite` from an already-built binary (env vars are already set in a normal desktop login shell there):
```sh
src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```
As of 2026-07-02 the app auto-detects NVIDIA + session type (via `webkit2gtk-nvidia-quirk`) and sets `__NV_DISABLE_EXPLICIT_SYNC=1` on Wayland itself, so the crash workaround above is no longer needed manually — and unlike `WEBKIT_DISABLE_DMABUF_RENDERER=1`, it keeps WebKitGTK's fast DMA-BUF rendering path enabled. `GDK_BACKEND=x11` / `WEBKIT_DISABLE_COMPOSITING_MODE=1` are unrelated to the crash but can still be set if you hit a black/unrendered webview:
```sh
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```

For development on Bazzite, use `yarn dev:linux`. It enters the Fedora Distrobox automatically on the immutable host, checks for Linux build dependencies, and applies the WebKit/X11 launch flags. Plain `yarn tauri dev` is intentionally left as the raw Tauri command.

---

## TODO — Things that still need fixing

| Priority | What | Why it's broken | Fix |
|---|---|---|---|
| Medium | **Screen brightness (DDC/CI)** | Upstream `brightness` crate 0.8 is sysfs-only. `/sys/class/backlight/` is empty on external-monitor desktops. | Implementation started 2026-07-02 in `Frogbyte-io/brightness`: Dot X now points `brightness` at the Frogbyte fork, which keeps sysfs backlight support and adds Linux DDC/CI devices by parsing `ddcutil detect --terse` and using VCP code `10` for get/set. Verified the fork directly on `bazzite` with a Philips monitor at `/dev/i2c-2`: `cargo run --example list_displays_async` returned `ddcci-display-1`, friendly name `card1-HDMI-A-1`, brightness `83%`. **App/UI-driven verification completed 2026-07-02 on `bazzite`** (Philips 275E2F at `/dev/i2c-2`): built and ran the real app via `yarn dev:linux` in the `dotx-ubuntu-ci` Distrobox, simulated a Decker over a `socat` virtual serial port pair (msgpack-encoded `slider1..slider5` frames matching real firmware framing), set `comPort` to the virtual port and channel 0's mapped app to `"screen brightness"` via the app's own persisted config/store files (`config.json` / `selectedApps.json` — the same files the Settings UI writes), then fed slider values through the running app end-to-end: `slider-change` event → `SystemVolumeController` → `set_screen_brightness` Tauri command → Frogbyte `brightness` → `ddcutil`. Confirmed exact round-trip accuracy against `ddcutil getvcp 10` for two independent values (512/1023 → 50%, 921/1023 → 90%). Found and fixed a real bug in the process (see below): `write_data_terminal_ready` failed with ENOTTY on the PTY and aborted the connection before the reader thread even started, silently breaking the documented "virtual firmware testing" workflow (`DOTX_EXTRA_SERIAL_PORTS`) for any non-modem-control serial endpoint. Still needs a regression check on a real laptop with `/sys/class/backlight` to confirm the sysfs path is unaffected, and a real-hardware pass on `ananords-dev`'s HP 24uh. Runtime now requires `ddcutil` for external-monitor DDC/CI brightness. |
| High | **Active window — GNOME Wayland** | `active-win-pos-rs` 0.11 uses `org.gnome.Shell.Eval` which was disabled in GNOME 42 for security. `Shell.Eval` returns `(false, '')`. MIDI/Decker automation that depends on focus detection won't trigger on GNOME Wayland. | Need a GNOME Shell extension exposing active-window via a safe D-Bus interface, or upstream PR to `active-win-pos-rs` using an alternative Mutter API. |
| ~~High~~ Fixed | ~~App crashes on launch — NVIDIA + Wayland explicit sync~~ | On `bazzite` (NVIDIA GeForce GTX 1660 SUPER, driver 610.43, KWin/Plasma Wayland), the app crashed ~0.3s after launch: `Gdk-Message: Error 71 (Protocol error) dispatching to Wayland display`, with KWin logging `wl_display#1.error(wp_linux_drm_syncobj_surface_v1, 4, "explicit sync is used, but no acquire point is set")`. WebKitGTK commits a buffer via `wp_linux_drm_syncobj_manager_v1` without setting an acquire timeline point first — a protocol violation KWin now enforces strictly. (Electron/Chromium apps like the harness's own `t3-code` preview don't hit this: Chromium 134+/Electron 35+ landed a correct `linux-drm-syncobj-v1` implementation upstream, so no workaround is needed there — WebKitGTK never got the equivalent fix, see [WebKit bug 280210](https://bugs.webkit.org/show_bug.cgi?id=280210).) | Fixed 2026-07-02: added the [`webkit2gtk-nvidia-quirk`](https://crates.io/crates/webkit2gtk-nvidia-quirk) crate (Linux-only target dependency in `src-tauri/Cargo.toml`) and call `apply_workaround_with_options()` from `apply_nvidia_wayland_webkit_workaround()` at the top of `main()` in `src-tauri/src/main.rs`, unless the user already set `WEBKIT_DISABLE_DMABUF_RENDERER` or `__NV_DISABLE_EXPLICIT_SYNC` themselves. The crate detects the proprietary NVIDIA driver via sysfs and picks `__NV_DISABLE_EXPLICIT_SYNC=1` on Wayland (this crash) or `WEBKIT_DISABLE_DMABUF_RENDERER=1` on X11 (a separate blank-window bug) — the Wayland fix keeps WebKitGTK's fast DMA-BUF rendering path enabled, unlike disabling DMABUF outright. Verified on `bazzite`: rebuilt the pre-fix binary and confirmed `__NV_DISABLE_EXPLICIT_SYNC=1` alone (no other env vars) also prevents the crash; then verified the crate-integrated binary applies it automatically with zero env vars set — process stays alive past the ~0.3s crash window, no protocol errors, tray icon registers with `org.kde.StatusNotifierWatcher` normally. Distrobox does **not** sidestep this crash on its own: the container shares the host's GPU driver, kernel module, and Wayland socket, so WebKitGTK inside the container still talks to the same host KWin compositor through the same NVIDIA driver. `GDK_BACKEND=x11` / `WEBKIT_DISABLE_COMPOSITING_MODE=1` are unrelated to this crash (still may help with a separate black-webview rendering issue — untouched by this fix). |
| High | **Reliable Linux dev launch on Bazzite** | Verified 2026-07-02 on native Bazzite 44: plain `yarn tauri dev` failed at link time because the host has runtime libraries under `/lib64` but lacks development packages/pkg-config metadata/unversioned linker names for `dbus-1`, `xcb`, `udev`, ALSA, GTK/WebKit, `libsoup-3.0`, etc. Temporary `/tmp` symlinks made the linker pass, but that is not a real fix. Wayland launch then crashed unless forced away from WebKitGTK's DMA-BUF path; `GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1` produced a real rendered 800x600 window. | Use `yarn dev:linux`. It auto-enters `DOTX_DISTROBOX_NAME` (default `fedora-dev`) on native Bazzite, runs a dependency preflight, and applies the WebKit/X11 flags. It does not auto-install packages because that may require sudo and should be explicit. For native host testing, use already-built binaries/packages and the launch flags above. Do not rely on temporary linker symlinks; either layer the proper `-devel` packages with `rpm-ostree` if native builds are required, or keep native host testing runtime-only. **Debug-binary gotcha (found 2026-07-03):** `target/debug/dot_x`'s bundled config points `devUrl` at `http://localhost:1420` (`beforeDevCommand: yarn dev`, i.e. Vite). Launching the raw binary directly (as the "Already-built binary" launch path above suggests) without a Vite dev server running behind it produces a fully black, correctly-sized, correctly-titled, `IsViewable` window — everything *looks* alive (process up, window mapped, no crash/error logged) except the webview never loads any content, and the MCP bridge's `webview_execute_js`/`webview_screenshot` calls all time out because the in-page bridge script never runs. `GDK_BACKEND=x11`/`WEBKIT_DISABLE_DMABUF_RENDERER=1`/`WEBKIT_DISABLE_COMPOSITING_MODE=1` do not fix this — it's unrelated to the NVIDIA/black-webview rendering bug above. Use `yarn dev:linux` (which runs Vite itself) rather than the raw binary when you need the webview to actually render or need MCP-bridge webview automation. |
| Medium | **Full plugin round-trip** | SDK build, `.dotxplugin` packaging/install, and Deno process spawn+execute are now verified (see below). Found a real bug: `auto_start_enabled_plugins` ran at backend init and started enabled plugins immediately, but the plugin Socket.IO server only started when the frontend called `start_plugin_server` — which apparently never happened (or happened too late) when the app launched tray-first/hidden. The plugin's own 5-attempt/2s retry loop exhausted (`ECONNREFUSED 127.0.0.1:3001`) before the server ever bound, so auto-started plugins never connected. Backend fix implemented 2026-07-02: plugin start now ensures the Socket.IO server is bound first and passes the active port through `DOTX_PLUGIN_PORT`. | Re-verify the UI-driven install flow (`install_local_plugin` / `DotxInstallModal.vue`), auto-started Socket.IO registration, API calls, and settings-page rendering. |
| Low | **App auto-updates on Linux** | Bundles build with `createUpdaterArtifacts` but update flow has not been validated. | Needs `TAURI_SIGNING_PRIVATE_KEY` (release secret) + an update endpoint, then trigger and validate the update flow. |
| Low | **CI on Linux** | Linux CI has been added but still needs validation in GitHub Actions, especially while `volume-control-rs` is checked out as a sibling path dependency (its Linux fixes are pushed to `Frogbyte-io/volume-control-rs` main, so CI clones work; `psp` is a git dep as of 2026-07-03) and updater signing secrets may be required for bundle artifacts. | Validate `.github/workflows/linux-ci.yml` in GitHub Actions and switch `volume-control-rs` back to a git/crates dependency when appropriate. |

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
- **MIDI device enumeration** — `midir` (ALSA backend) lists input and output ports. Requires user to be in the `audio` group for `/dev/snd/seq` access (a real desktop login grants this; SSH sessions may not).
- **MIDI CC message construction + backend send/receive** — verified 2026-07-02 in `dotx-ubuntu-ci` distrobox: backend unit tests cover Decker slider value mapping (`0..1023` → `0..127`), default channel/CC behavior, configured channel/CC behavior, invalid channel rejection, virtual output creation, and sending a configured CC message through `Dot X Virtual MIDI` into a real `MidiInput` receiver with `DOTX_TEST_ALSA_MIDI=1`.
- **MIDI virtual output port** — verified 2026-07-01 in `dotx-ubuntu-ci` distrobox with `DOTX_TEST_ALSA_MIDI=1`: `midir::os::unix::VirtualOutput` creates `Dot X Virtual MIDI`, and the port is visible to receiving MIDI clients while the connection is alive.
- **MIDI CC round-trip, app/UI-driven** — verified 2026-07-03 on `bazzite`: ran the real app via `yarn dev:linux` in the `dotx-ubuntu-ci` Distrobox, simulated a Decker over a `socat` PTY pair *created inside the Distrobox itself* (the container has its own `devpts` instance — a host-side PTY pair, as used for the brightness verification, is not visible inside; `DOTX_EXTRA_SERIAL_PORTS` and `comPort` must point at a PTY created inside whichever mount namespace the app process actually runs in), mapped channel 1 to MIDI with a custom `midiConfiguration` (channel 1, CC 20) via the app's persisted `config.json`/`selectedApps.json`, then toggled "Enable MIDI Output" on in the real Settings UI (via the `tauri-plugin-mcp-bridge` webview automation tools — `webview_screenshot`/`webview_dom_snapshot`/`webview_interact`, which only work once `beforeDevCommand`'s Vite dev server is actually running behind the debug binary; a `target/debug/dot_x` launched standalone shows a black window because its bundled `devUrl` is `http://localhost:1420` with nothing serving it). Confirmed via `aseqdump -p <client>:0` (a real external ALSA MIDI client, resolved by numeric address — resolving by the port's display name failed with "No such file or directory") receiving control-change messages for 5 slider positions with exact expected channel/CC/value: `0→0`, `256→32`, `512→64`, `768→95`, `1023→127`, all on channel 1 (`Ch 0` in 0-indexed `aseqdump` output) controller 20, matching `map_to_range` exactly. The UI screenshots also confirmed slider positions update live and the channel-1 button is correctly labeled "MIDI". Found a minor latent bug (not fixed): `attachMidiDevice()` in `src/ts/decker.ts` waits for `deckerStore.getSliders` to be non-empty with only 5 retries at 1s each, then gives up permanently if no slider frame arrives within ~5s of `connect_decker` succeeding — auto-attaching MIDI on app startup silently failed against the simulated Decker (which only sends frames when explicitly driven) until MIDI was toggled off/on via the Settings UI, which calls `attachMidiDevice` fresh once sliders are already populated. Unlikely to bite real hardware, which streams continuously from connect, but a slow/laggy real Decker could hit the same silent failure with no automatic recovery short of the user re-toggling the Settings switch.
- **Deno runtime** — bundled `deno-x86_64-unknown-linux-gnu.zip` extracts, `chmod +x`, and runs.
- **Power monitor (`psp`)** — no longer panics headless; logind session resolution degrades gracefully over SSH; suspend/resume events are now actually emitted. Published 2026-07-03 to `github.com/Frogbyte-io/psp` (`f44a180`) and `src-tauri/Cargo.toml` switched back to the git dep. Note: the original fixed working tree lived only on `ananords-dev` (unreachable that day), so the fixes were re-implemented on `bazzite` from the spec below and smoke-tested there (desktop session → `start_listening` returns `Ok`, dead system bus → clean `Err("D-Bus not available")`, no panics); the SSH-degradation path is covered by code review, not re-tested.
- **Serial port / Decker** — fully verified end-to-end on `ananords-dev` (Ubuntu 24.04, `VM-5SW` Decker fw `0.0.3` at `/dev/ttyACM0`, VID `04d8`/1240, PID `e626`/58918): `get_devices()` enumerates with correct VID/PID, `connect_decker` opens port + sets DTR, 75+ live `slider-change` events decoded by `rmp_serde`, `get-device-info` round-trip returns firmware/model/serial.
- **Auto-start on login** — `tauri_plugin_autostart` writes/removes `~/.config/autostart/Dot X.desktop` (XDG autostart spec). Enable/disable/is_enabled round-trip verified on Ubuntu 24.04.
- **Windows-only crates removed/gated** — `winreg` dropped; `window-vibrancy` / `window-shadows` gated to non-Linux.
- **NVIDIA + Wayland launch crash auto-mitigated** — verified 2026-07-02 on `bazzite` (NVIDIA GeForce GTX 1660 SUPER, KWin/Plasma Wayland): built the app in the `dotx-ubuntu-ci` Distrobox, then launched the binary directly on the host with no env vars set. `apply_nvidia_wayland_webkit_workaround()` (`src-tauri/src/main.rs`) delegates to the `webkit2gtk-nvidia-quirk` crate, which detected the NVIDIA driver + Wayland session and set `__NV_DISABLE_EXPLICIT_SYNC=1` before WebKit initialized; process stayed alive past the ~0.3s crash window with no protocol errors, and the tray icon registered with `org.kde.StatusNotifierWatcher` normally. See former TODO entry (now fixed) for details.
- **Plugin SDK build + packaging + install (backend)** — verified 2026-07-02 on `bazzite` (with `WEBKIT_DISABLE_DMABUF_RENDERER=1`, see TODO): `@dotmatrixlabs/dotx-plugin-sdk` builds, the `component-showcase` example packages into a real `.dotxplugin` via `dotx-plugin package`, `install_local_plugin`-style extraction into `app_data_dir/plugins/<id>` passes `validate_manifest` (dotxVersion `>=1.1.4` against app `1.2.3`), and `auto_start_enabled_plugins` spawns the Deno process correctly (`deno run --unstable-detect-cjs --allow-read=... --allow-net=127.0.0.1:3001,localhost:3001 dist/main.js`), which executes real plugin code (`onLoad` logs "Starting Component Showcase v1.0.0..."). Socket.IO registration currently fails — see TODO (plugin server start race).
- **Screen brightness (DDC/CI), app/UI-driven** — verified 2026-07-02 on `bazzite` against a real Philips 275E2F monitor (`/dev/i2c-2`): ran the actual built app (not a standalone example) with a simulated Decker attached over a `socat` PTY pair feeding real msgpack `slider-change` firmware frames, mapped a channel to `"screen brightness"`, and confirmed `ddcutil getvcp 10` matched the commanded value exactly for multiple test points (e.g. slider `512/1023` → `50%`, `921/1023` → `90%`) after passing through the full `slider-change` → `SystemVolumeController` → `set_screen_brightness` → `brightness` (Frogbyte fork) → `ddcutil` pipeline. See TODO entry for the DTR bug found and fixed along the way, and for what's still open (laptop sysfs regression check, real hardware on `ananords-dev`).

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
- [~] Plugin system works — SDK build/packaging/install/spawn verified; blocked on a real plugin-server-startup race (see TODO) before Socket.IO round-trip and settings UI can be tested
- [~] Screen brightness control works — DDC/CI support wired in the Frogbyte `brightness` fork via `ddcutil`; app/UI-driven DDC/CI round-trip verified 2026-07-02 on `bazzite`; laptop sysfs regression test and real-hardware pass on `ananords-dev` still needed
- [x] MIDI CC send/receive round-trip — full app/UI-driven round-trip verified 2026-07-03 on `bazzite` (see "Verified working on Linux")
- [ ] Active window on GNOME Wayland — **broken by design (Shell.Eval disabled)**
- [ ] App auto-updates on Linux
- [~] CI builds and tests on Linux automatically — workflow added; GitHub Actions run not yet validated

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
- **Dependency note:** published to `github.com/Frogbyte-io/psp` main (`f44a180`, 2026-07-03); `src-tauri/Cargo.toml` now uses `psp = { git = "https://github.com/Frogbyte-io/psp" }`.

### Linux Decker serial device listing
- Default listing filters out noisy legacy `/dev/ttyS*` (type `Unknown`) while listing USB devices normally.
- `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N` — append PTY endpoints for virtual firmware testing.
- `DOTX_SHOW_ALL_SERIAL_PORTS=1` — expose all `serialport::available_ports()` entries for debugging.
- Serial thread read-error handling exits cleanly instead of panicking.
- **DTR-on-connect aborted virtual/PTY connections** — `initialize_decker` (`src-tauri/src/decker.rs`) called `port.write_data_terminal_ready(true)` right after opening the port and returned early (before spawning the reader thread) if it failed. PTYs don't support modem-control lines, so this failed with `ENOTTY` ("Not a typewriter") on every PTY-based connection, silently killing the connection before any data was ever read — found while doing a real virtual-firmware round-trip test for DDC/CI brightness via `DOTX_EXTRA_SERIAL_PORTS`. Fixed 2026-07-02: DTR failure is now a `warn!` instead of an aborting `error!`/`return Err`, so connections proceed on serial endpoints that don't support DTR.

---

## Linux Build Prerequisites

### Ubuntu / Debian

```sh
sudo apt-get update
sudo apt-get install -y \
  build-essential pkg-config curl wget file \
  libssl-dev \
  libwebkit2gtk-4.1-dev librsvg2-dev libgtk-3-dev \
  libxcb-ewmh-dev libxcb-randr0-dev libdbus-1-dev \
  libpulse-dev libudev-dev libasound2-dev \
  libayatana-appindicator3-dev ddcutil
```

Package notes:
- `libwebkit2gtk-4.1-dev` / `librsvg2-dev` / `libgtk-3-dev` — Tauri 2 webview. `libgtk-3-dev` must be listed explicitly even though `libwebkit2gtk-4.1-dev` pulls in the runtime.
- `libssl-dev` — OpenSSL link libraries used by Rust dependencies such as `reqwest` / updater support.
- **Ubuntu 24.04 quirk:** `libsoup-3.0.pc` is installed as `libsoup-3.0` but `soup3-sys` looks for `soup-3.0`. Fix: `sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/libsoup-3.0.pc /usr/lib/x86_64-linux-gnu/pkgconfig/soup-3.0.pc`
- **Ubuntu 24.04 quirk:** if `libpsl-dev` / `libsysprof-capture-4-dev` show "no installation candidate", a foreign dpkg arch (e.g. arm64) is configured without a matching repo. Fix: `sudo dpkg --remove-architecture arm64 && sudo apt-get update`.
- `libxcb-ewmh-dev` / `libxcb-randr0-dev` — `active-win-pos-rs` X11/XCB backend.
- `libdbus-1-dev` — D-Bus for `psp` (logind power events).
- `libpulse-dev` — `volume-control-rs` Linux audio backend. Runtime needs `libpulse0`; on PipeWire systems, `pipewire-pulse` provides the server.
- `libudev-dev` — `libudev-sys` (used by `serialport` and `brightness`).
- `libasound2-dev` — `alsa-sys` for `midir` ALSA backend.
- `libayatana-appindicator3-dev` — system tray. Runtime needs `libayatana-appindicator3-1`.
- `ddcutil` — external-monitor DDC/CI brightness backend used by the Frogbyte `brightness` fork.

For DDC/CI brightness: `ddcutil` at runtime, `i2c-dev` kernel module loaded, and permission to access the relevant `/dev/i2c-*` device.

### Fedora / RHEL

```sh
sudo dnf install \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libxcb-devel alsa-lib-devel pulseaudio-libs-devel \
  systemd-devel dbus-devel ddcutil
sudo dnf groupinstall "Development Tools"
```

### Bazzite / Fedora Atomic (immutable OS)

Bazzite cannot install `-devel` packages natively with normal `dnf`. For development, run `yarn tauri dev` inside [Distrobox](https://distrobox.it/) (pre-installed on Bazzite) or layer the build dependencies with `rpm-ostree` and reboot. Distrobox is the preferred path because it keeps the immutable host clean while still sharing your home directory and desktop session.

Do not use temporary linker symlinks as a development setup. A 2026-07-02 native-host test showed that `/lib64` has runtime libraries such as `libgtk-3.so.0`, `libwebkit2gtk-4.1.so.0`, `libdbus-1.so.3`, and `libudev.so.1`, but Rust/Tauri links against unversioned names such as `-lgtk-3`, `-lwebkit2gtk-4.1`, `-ldbus-1`, and `-ludev`. Symlinking those names in `/tmp` can make one build pass, but it bypasses pkg-config, misses headers/metadata, and will fail unpredictably as dependencies change.

Create a mutable Fedora container:

```sh
# One-time setup: create a Fedora development container
distrobox create --name fedora-dev --image fedora:41
distrobox enter fedora-dev

# Inside the container, install build dependencies
sudo dnf install \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libxcb-devel alsa-lib-devel pulseaudio-libs-devel \
  systemd-devel dbus-devel ddcutil nodejs npm
sudo dnf groupinstall "Development Tools"

# Install Rust (inside the container)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install yarn
npm install -g yarn
```

After the one-time setup, use the Linux dev wrapper:

```sh
cd ~/Code/dot-x
yarn dev:linux
```

On native Bazzite, `yarn dev:linux` runs `distrobox enter <container> -- ...` automatically. It prefers `DOTX_DISTROBOX_NAME`, then `fedora-dev`, then `dotx-ubuntu-ci`, then the first available Distrobox. Inside Distrobox, or on normal mutable Linux distros, it runs `yarn tauri dev` directly. Set `DOTX_SKIP_DISTROBOX=1` only when intentionally testing a layered native host.

The container shares your home directory, so your code edits are immediately visible inside it.

The `GDK_BACKEND=x11` and WebKit flags are currently recommended on Bazzite/NVIDIA even from Distrobox because the GUI still renders through the host Wayland/XWayland session. Without them, WebKitGTK may crash on KWin Wayland explicit sync or produce a mapped but black webview.

**Serial port access (Decker):** Distrobox shares `/dev/` from the host, but group memberships may not transfer into a fresh container. If you get "permission denied" on `/dev/ttyACM0`, add yourself to `dialout` inside the container:

```sh
distrobox enter fedora-dev
sudo usermod -a -G dialout $USER
exit
distrobox enter fedora-dev  # re-enter so the group takes effect
```

**Simulated Decker over a PTY (`DOTX_EXTRA_SERIAL_PORTS`) inside Distrobox:** unlike `/dev/ttyACM0`, PTYs are *not* shared — `/dev/pts` is backed by the `devpts` filesystem, and Distrobox's containers get their own fresh `devpts` instance rather than the host's. A `socat` PTY pair created on the Bazzite host (e.g. `/dev/pts/3`) will not exist inside the container, and `dot_x` running inside it will fail to open that path (`No such file or directory`) even though the number looks valid. Run `socat` *inside* the same `distrobox enter` session the app runs in so both share one `devpts` instance.

---

## Building on Linux

```sh
# from repo root
yarn setup:linux              # Ubuntu/Debian only; installs build prerequisites
yarn install
yarn tauri build            # produces .deb and .AppImage
```

`yarn setup:linux` runs `scripts/install-linux-deps.sh`. `yarn dev:linux` does not run it automatically; it only reports missing commands/pkg-config packages and tells you which setup command to run. This keeps dev launch from unexpectedly invoking `sudo` or mutating the host/container. Use `yarn dev:linux --check-only` to run the dependency preflight without starting the app.

Bundle targets are `["deb", "appimage"]` via `src-tauri/tauri.linux.conf.json` (Tauri auto-merges this on top of `tauri.conf.json`). That file also scopes Linux resource bundling to the Linux Deno archive and declares `libpulse0` as a `.deb` runtime dependency.

> **AppImage note:** AppImage bundling downloads `linuxdeploy` tooling on first run and needs FUSE. On headless/CI use `appimagetool --appimage-extract-and-run` or run under `xvfb`.
