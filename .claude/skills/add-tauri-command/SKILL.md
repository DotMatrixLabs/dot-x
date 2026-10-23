---
name: add-tauri-command
description: Add or modify a Tauri IPC command end-to-end (Rust handler + registration + TypeScript caller). Use whenever creating a new #[tauri::command], changing a command's signature, or debugging "command not found" / argument-deserialization errors at the Rust↔TS boundary.
---

# Adding a Tauri command

Every command touches three places; missing any one fails only at runtime, not compile time.

## 1. Rust handler

Add the `#[tauri::command]` fn in the matching module (`decker.rs` for device, `midi.rs` for MIDI, `plugin_*.rs` for plugins, `main.rs` for system/audio). Follow the existing patterns:

- Return `Result<T, String>` (or a `thiserror` type that serializes) — never panic across the IPC boundary.
- Use `#[tauri::command(async)]` for anything that blocks (serial I/O, network, process spawn); a blocking sync command freezes the webview.
- Platform-specific bodies get `#[cfg(target_os = ...)]` with a stub or error for the other platforms, matching how existing commands do it.

## 2. Registration

Add it to the `tauri::generate_handler![...]` list in `src-tauri/src/main.rs` (module-qualified, e.g. `decker::get_devices`). Forgetting this is the #1 cause of "Command X not found" at runtime.

## 3. TypeScript caller

Call from the matching `src/ts/` module via `invoke('command_name', { ... })`.

- **Argument naming is the classic trap:** Rust parameter `port_name: String` is called as `{ portName: ... }` — Tauri converts camelCase JS keys to snake_case Rust params. Mismatches produce `invalid args` errors at runtime.
- Type the return: `await invoke<MyReturnType>('command_name', ...)` and keep the TS type in sync with the Rust serde output (check `#[serde(rename = "...")]` / `rename_all` attributes — device structs here rename to camelCase).
- Handle rejection: the `Err` string arrives as the rejected promise value.

## 4. Verify

`cargo check` in `src-tauri/`, `npx vue-tsc --noEmit`, then invoke the command in the running debug app via `mcp__tauri__ipc_execute_command` (see the `run-app` skill) and confirm both the success path and an error input. If the command is part of the plugin API surface (`src/plugin-api/`), also run `yarn generate-types`.
