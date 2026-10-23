---
name: run-app
description: Launch and drive the Dot X app for development or verification. Use whenever you need to run, start, screenshot, or interact with the app, or confirm a change works in the running app — on Linux, Bazzite, or Windows.
---

# Running Dot X

## Launching

- **Linux (any distro, including Bazzite):** `yarn dev:linux`. It detects Bazzite and enters the Fedora Distrobox automatically, preflights build deps (`--check-only` to preflight only), and applies WebKit/NVIDIA workarounds. Run it in the background — the first Rust build takes several minutes.
- **Windows / known-good Linux env:** `yarn tauri dev`.
- **Already-built binary:** `src-tauri/target/debug/dot_x &> /tmp/dotx.log &`. When launching from a non-desktop shell (SSH, container), export the session env first — see `TEST-MACHINES.md` for the exact per-machine incantations. **Gotcha:** the debug binary's bundled `devUrl` is `http://localhost:1420` (Vite) — without a dev server running behind it, the webview loads nothing but still looks alive (correctly sized/titled/`IsViewable` window, no crash logged), and all MCP-bridge webview tools (`webview_execute_js`, `webview_screenshot`, etc.) time out. Use `yarn dev:linux`/`yarn tauri dev` (which run Vite themselves) instead of the raw binary whenever you need the webview to render or need webview automation.

Useful env vars:

- `DOTX_SKIP_DISTROBOX=1` — run on the Bazzite host anyway.
- `DOTX_SKIP_LINUX_PREFLIGHT=1` — bypass the dependency preflight.
- `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/N` — expose PTY endpoints as Decker candidates (see the `simulate-decker` skill).
- `DOTX_SHOW_ALL_SERIAL_PORTS=1` — list every serial port for debugging.

## Knowing it's alive

The app is tray-first and may start with no visible window — that is normal, not a crash. Confirm liveness via the process (`pgrep -f dot_x`), the log output, or the MCP bridge below. If the webview is black/unrendered on Linux, try `GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1` (`yarn dev:linux` sets these where needed).

## Driving the app

Debug builds embed `tauri-plugin-mcp-bridge`, and `.mcp.json` wires up the `tauri` MCP server. Prefer these tools over guessing from code:

- `mcp__tauri__ipc_execute_command` — confirmed 2026-07-03 that with the pinned `tauri-plugin-mcp-bridge = "0.11"` (0.11.2), this only dispatches the bridge's own `plugin:mcp-bridge|*` commands, not arbitrary app `#[tauri::command]`s — calling e.g. `get_devices` or `connect_decker` through it fails with `Unsupported Tauri command: <name>`. To exercise app commands, drive the real UI instead (`webview_interact`/`webview_find_element`/`webview_dom_snapshot`) or fall back to editing the app's persisted config/store files, as documented in `LINUX-SUPPORT.md`'s brightness and MIDI verification entries.
- `mcp__tauri__ipc_emit_event` / `ipc_monitor` / `ipc_get_captured` — emit and observe events like `slider-change`.
- `mcp__tauri__read_logs` — backend logs without hunting for files.
- `mcp__tauri__webview_screenshot` / `webview_dom_snapshot` / `webview_interact` — see and drive the UI (also works to surface the hidden main window via `manage_window`).

## Verifying a change

Drive the affected flow end-to-end, not just the compile: for device-path changes use a real or simulated Decker and watch `slider-change` reach the frontend; for UI changes screenshot before/after; for command changes invoke the command through the bridge and check the result plus logs. State plainly in your summary what you exercised and what you could not (e.g. Windows-only paths, real hardware).
