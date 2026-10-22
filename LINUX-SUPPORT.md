# Linux Support — Dot X

Status and open work for Linux support. Machine inventory and per-machine launch commands are in `TEST-MACHINES.md`. **Check which machine you're on before running anything** (local vs. SSH, KDE vs. GNOME).

Primary dev/test happens on `bazzite` (KDE Wayland, NVIDIA) via Distrobox and `ananords-dev` (Ubuntu 24.04, GNOME Wayland, real Decker).

---

## Status

| Area | State |
|---|---|
| App build / run / package (`.deb`, `.AppImage`) | ✅ done |
| GUI window on GNOME Wayland (tray-first, starts hidden) | ✅ done |
| System tray (ayatana-appindicator) | ✅ done |
| Single-instance detection | ✅ done |
| Per-app audio: volume + mute | ✅ done |
| Audio output/input device lists | ✅ done |
| Installed applications list | ✅ done |
| Serial port / Decker end-to-end | ✅ done (real hardware) |
| Auto-start on login | ✅ done |
| Active window — X11 | ✅ done |
| Active window — GNOME Wayland | ✅ done (via `dotx-active-window` extension) |
| MIDI CC send/receive round-trip | ✅ done (app/UI-driven) |
| Screen brightness (DDC/CI) | ✅ confirmed on real hardware (`ananords-dev`'s HP 24uh via `ddcutil`); sysfs `/sys/class/backlight` regression check still needs a machine with an internal panel — `ananords-dev` is a laptop but exposes zero backlight devices for its external monitor |
| NVIDIA + Wayland launch crash | ✅ auto-mitigated |
| Deno runtime | ✅ done |
| Linux CI workflow | ✅ validated locally via `act`; real GitHub Actions run pending PR #187 merge |
| Plugin system | ✅ auto-start, Socket.IO, `onLoad` blocking-UI calls, settings pages, and fresh-`.dotxplugin` install flow all verified end-to-end on `bazzite` |
| App auto-updates | ❌ not validated |

---

## Open work

- **Screen brightness — sysfs regression check** — DDC/CI is confirmed on real hardware: `ddcutil setvcp 10 <n>` measurably changed `ananords-dev`'s HP 24uh brightness (49 → 75 → 49). Still need a `/sys/class/backlight` regression check on a machine with an actual internal laptop panel — `ananords-dev` has none (0 devices under `/sys/class/backlight/`), so this can't be checked there. The full slider → app → `set_screen_brightness` path is wired correctly in code (verified by reading `SliderOverview.vue`'s `sliders` watcher → `SystemVolumeController.setChannelVolume` → `set_screen_brightness`) but is still unconfirmed against a live app instance — a simulated-PTY test over SSH failed for harness reasons (see Gotchas), not because of a code defect.

- **App auto-updates** — bundles build with `createUpdaterArtifacts` but the update flow is unvalidated. Needs `TAURI_SIGNING_PRIVATE_KEY` (release secret) + an update endpoint, then a triggered update.

- **CI — real GitHub Actions run** — `linux-ci.yml` only exists on this branch; GitHub won't register a `pull_request`/`workflow_dispatch` workflow until it's on the default branch, so it can't run on PR #187 until merge. Validated locally instead with `act push -W .github/workflows/linux-ci.yml -P ubuntu-24.04=catthehacker/ubuntu:act-24.04` (Podman socket via `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`) — every step passed; the full-bundle step correctly skips without the signing secret. Re-check on GitHub Actions once merged.

---

## Gotchas (things that will waste your time)

- **Black webview from the raw debug binary** — `target/debug/dot_x`'s `devUrl` is `http://localhost:1420` (Vite). Launching the binary directly without a Vite dev server shows a black-but-otherwise-alive window (mapped, titled, no crash logged) and every MCP-bridge `webview_*` call times out. Use `yarn dev:linux` / `yarn tauri dev`, which run Vite. This is *not* the NVIDIA rendering bug and the WebKit env flags don't fix it.

- **Simulated Decker PTY inside Distrobox** — `/dev/pts` is a per-namespace `devpts`; a `socat` PTY pair made on the host isn't visible inside the container (opening it fails with `No such file or directory`). Create the `socat` pair *inside* the same `distrobox enter` session the app runs in. (Real `/dev/ttyACM0` is shared fine.)

- **MCP bridge `ipc_execute_command` is bridge-only** — with the pinned `tauri-plugin-mcp-bridge = "0.11"`, it only dispatches the bridge's own `plugin:mcp-bridge|*` commands, not app `#[tauri::command]`s (those return `Unsupported Tauri command`). Drive app behavior through the real UI (`webview_interact` etc.) or by editing the app's persisted config/store files.

- **GNOME extensions & lock screen** — a brand-new GNOME extension isn't discovered until a full logout/login (no in-session Shell restart on Wayland). GNOME also disables all user extensions while the screen is locked, so `dotx-active-window`'s D-Bus method vanishes then; the backend fallback handles this the same as "not installed".

- **NVIDIA + Wayland** — the app auto-sets `__NV_DISABLE_EXPLICIT_SYNC=1` on Wayland via the `webkit2gtk-nvidia-quirk` crate (`apply_nvidia_wayland_webkit_workaround()` in `main.rs`), so no manual env var is needed. Distrobox does *not* sidestep this (same host GPU/compositor).

- **Launching the app over plain SSH gives a dead webview** — without `WAYLAND_DISPLAY`/`DISPLAY`/`DBUS_SESSION_BUS_ADDRESS` exported, the process starts (`XDG_SESSION_TYPE=tty`), the Rust backend runs fine, but the webview never attaches to the compositor — no frontend JS executes, so anything downstream of a Tauri event (e.g. `slider-change` → brightness) silently never fires even though the backend logs look healthy. Export the graphical session's env vars before launching over SSH.

- **`socat` isn't installed on `ananords-dev`** — use a small Python `pty.openpty()` script instead to fake a Decker serial endpoint there.

- **Simulated-PTY Decker over SSH is unreliable** — in one session the app connected to a Python-backed PTY, then silently lost the fd (no disconnect/error/panic logged, fd just gone from `/proc/<pid>/fd`) before any slider frames arrived, with both one-shot and continuously-streaming senders. Root cause undetermined — suspect something in how a non-controlling-terminal PTY behaves under a detached SSH/`setsid` session. Prefer testing brightness with a real Decker's slider, or reproduce in a real logged-in session (not bare SSH) before trusting a PTY simulation result on this machine.

---

## Key implementation notes

- **Active window (GNOME Wayland)** — `active-win-pos-rs` uses `org.gnome.Shell.Eval` (disabled since GNOME 42); `org.gnome.Shell.Introspect` is portal-gated to Flatpak apps (`AccessDenied` otherwise). Fix: the `gnome-extension/dotx-active-window@dot-x.dev/` Shell extension exports read-only `org.dotx.ActiveWindow.GetFocusedWindow() -> (wm_class, title, pid)`. `src-tauri/src/gnome_active_window.rs` (Linux-only, `zbus`, 2s timeout on a spawned thread) calls it from `get_active_app_name()` only when `active-win-pos-rs` fails on a GNOME-Wayland session; otherwise falls back to "Unknown" unchanged. Not yet bundled into the installer — manual `gnome-extensions install` (see the extension's `README.md`). Privacy: the D-Bus method is unrestricted on the session bus (any local process can read the focused window title/PID) — read-only, but a conscious tradeoff.

- **NVIDIA + Wayland crash** — WebKitGTK commits buffers without an acquire timeline point, which KWin rejects (`explicit sync is used, but no acquire point is set`). The `webkit2gtk-nvidia-quirk` crate detects NVIDIA + session type and sets `__NV_DISABLE_EXPLICIT_SYNC=1` (Wayland) / `WEBKIT_DISABLE_DMABUF_RENDERER=1` (X11), keeping the fast DMA-BUF path on Wayland. Skipped if the user already set either env var.

- **Screen brightness** — Dot X points `brightness` at the Frogbyte fork, which keeps sysfs backlight support and adds DDC/CI via `ddcutil detect --terse` + VCP code `10`. Pipeline: `slider-change` → `SystemVolumeController` → `set_screen_brightness` → `brightness` → `ddcutil`. Runtime needs `ddcutil`, the `i2c-dev` module, and access to `/dev/i2c-*`.

---

## Backend bug fixes on this branch

**`volume-control-rs` (Linux audio):** (1) teardown crash — `AudioController` dropped mainloop before context; fixed field order + `Drop`. (2) setters were no-ops on quick teardown — now block on a completion callback. (3) asymmetric volume — getter now applies the inverse `VolumeLinear` conversion so set/read round-trips.

**`psp` (power monitor):** no more `.unwrap()` panics; logind session resolution degrades gracefully over SSH/containers; `PrepareForSleep` now emits `PowerState::Suspend`/`Resume`. Published to `github.com/Frogbyte-io/psp` (`f44a180`, 2026-07-03); `Cargo.toml` uses the git dep.

**Linux Decker serial listing (`decker.rs`):** default listing hides legacy `/dev/ttyS*`; `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N` appends PTYs for virtual testing; `DOTX_SHOW_ALL_SERIAL_PORTS=1` shows everything; read-error handling exits cleanly instead of panicking. **DTR-on-connect fix:** `write_data_terminal_ready(true)` fails with `ENOTTY` on PTYs and used to abort the connection before the reader thread started; now a `warn!` instead of an aborting error, so PTY/virtual endpoints work.

**Plugin `onLoad` UI-API race (`plugin_runtime.rs`, `pluginAPI.ts`):** auto-started plugins ran `onLoad` — including blocking UI API calls like `ui.showToast` / `settingsPage.addSettings`, which round-trip through the frontend via `plugin/api_request` — before the frontend registered its listeners in `PluginAPI.initialize()`, so the event was dropped and the plugin timed out after 30s (Tauri `emit` doesn't queue for late subscribers). Fix mirrors the existing "Socket.IO server ready before auto-start" gate on the frontend side: the frontend calls a new `notify_frontend_ready` command once its listeners are live (`setupTauriEventListeners()` now awaits `listen()` registration), and `auto_start_enabled_plugins` awaits `wait_for_frontend_ready()` (a `FRONTEND_READY` AtomicBool + tokio `Notify`, with a 10s fallback so headless/failed-frontend launches still start plugins) before spawning plugins. Verified on `bazzite`: pre-fix `onLoad` hung 30s on `ui.showToast`; post-fix it completes in ~30ms and the settings page renders.

**Minor latent bug (not fixed):** `attachMidiDevice()` in `src/ts/decker.ts` waits for sliders with only 5×1s retries, then gives up permanently — auto-attach silently fails if no slider frame arrives within ~5s of connect. Fine for real hardware (streams continuously); a slow Decker could hit it, recoverable only by re-toggling MIDI in Settings.

---

## Build prerequisites

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

Notable dependencies: `libgtk-3-dev` must be listed explicitly (webview); `libssl-dev` (reqwest/updater); `libxcb-ewmh-dev`/`libxcb-randr0-dev` (active-win X11); `libdbus-1-dev` (psp logind); `libpulse-dev` (audio; runtime needs `libpulse0`, PipeWire systems need `pipewire-pulse`); `libudev-dev` (serialport/brightness); `libasound2-dev` (midir ALSA); `libayatana-appindicator3-dev` (tray); `ddcutil` (DDC/CI brightness).

Ubuntu 24.04 quirks:
- `libsoup-3.0.pc` installed as `libsoup-3.0` but `soup3-sys` wants `soup-3.0`: `sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/libsoup-3.0.pc /usr/lib/x86_64-linux-gnu/pkgconfig/soup-3.0.pc`
- `libpsl-dev`/`libsysprof-capture-4-dev` "no installation candidate" → stray foreign dpkg arch: `sudo dpkg --remove-architecture arm64 && sudo apt-get update`

### Fedora / RHEL

```sh
sudo dnf install \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libxcb-devel alsa-lib-devel pulseaudio-libs-devel \
  systemd-devel dbus-devel ddcutil
sudo dnf groupinstall "Development Tools"
```

### Bazzite / Fedora Atomic (immutable)

Can't install `-devel` packages natively. Use Distrobox (preferred — keeps the host clean) or layer with `rpm-ostree`. **Do not use temporary linker symlinks** — `/lib64` has runtime `.so`s but not the unversioned linker names / pkg-config metadata; symlinking in `/tmp` bypasses pkg-config and fails unpredictably.

```sh
distrobox create --name fedora-dev --image fedora:41
distrobox enter fedora-dev
sudo dnf install \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libxcb-devel alsa-lib-devel pulseaudio-libs-devel \
  systemd-devel dbus-devel ddcutil nodejs npm
sudo dnf groupinstall "Development Tools"
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && source ~/.cargo/env
npm install -g yarn
```

Then use `yarn dev:linux` (see `TEST-MACHINES.md`). It auto-enters the Distrobox on native Bazzite (`DOTX_DISTROBOX_NAME`, then `fedora-dev`, then `dotx-ubuntu-ci`, then first available), runs a dependency preflight, and applies the WebKit/X11 flags. `DOTX_SKIP_DISTROBOX=1` to test a layered native host. The container shares your home dir, so edits are live.

Decker serial access in Distrobox: `/dev/` is shared but group membership may not transfer — if `/dev/ttyACM0` is permission-denied, `sudo usermod -a -G dialout $USER` inside the container, then re-enter.

---

## Building on Linux

```sh
yarn setup:linux    # Ubuntu/Debian only; installs the prerequisites above
yarn install
yarn build:linux    # produces .deb and .AppImage
```

`yarn build:linux` wraps `yarn tauri build` the way `yarn dev:linux` wraps `tauri dev`: it enters the Distrobox on Bazzite, runs the dependency preflight, sets `NO_STRIP=1` because `linuxdeploy`'s bundled `strip` can't parse the `.relr.dyn` sections in Fedora 41+ libraries (AppImage bundling fails in the Fedora Distrobox otherwise), and, when `TAURI_SIGNING_PRIVATE_KEY` is unset, turns off `createUpdaterArtifacts` so a local build doesn't fail on updater signing. Release builds with the key set are unchanged.

`yarn dev:linux` never runs `setup:linux` itself (avoids surprise `sudo`); it only reports missing deps. `yarn dev:linux --check-only` runs just the preflight. Bundle targets (`deb`, `appimage`) and the `libpulse0` runtime dep come from `src-tauri/tauri.linux.conf.json` (auto-merged onto `tauri.conf.json`).

> **AppImage:** bundling downloads `linuxdeploy` on first run and needs FUSE. Headless/CI: `appimagetool --appimage-extract-and-run` or run under `xvfb`.
