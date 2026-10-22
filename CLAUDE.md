# Dot X — Claude Instructions

Desktop companion app for the DotMatrixLabs Decker physical volume mixer. Tauri 2 (Rust backend) + Vue 3 / TypeScript / Pinia frontend, Tailwind + DaisyUI, with a Deno-based plugin system. Primary target is Windows; Linux support is being added (see `LINUX-SUPPORT.md` for current state and verified features, and `TEST-MACHINES.md` for the test-machine inventory and per-machine launch instructions).

## Commands

- `yarn dev:linux` — run the app on Linux. Always prefer this over `yarn tauri dev` on Linux: it auto-enters the Fedora Distrobox on Bazzite, preflights build deps, and applies WebKit/NVIDIA workarounds. `--check-only` runs just the dependency preflight.
- `yarn tauri dev` — run the app (Windows, or Linux when you know the environment is already set up).
- `npx vue-tsc --noEmit` — typecheck the frontend.
- `cd src-tauri && cargo check` — check the backend.
- `yarn tauri build` — production build (slow; don't run it just to verify a change). On Linux use `yarn build:linux`, which handles Distrobox, the linuxdeploy strip failure on Fedora, and builds without the updater signing key.
- `yarn generate-types` — regenerate plugin API types after touching `src/plugin-api/`.

## Architecture

- `src/` — Vue 3 frontend. `src/ts/` holds hardware/system logic (`decker.ts` device comms, `volumeControl.ts`, `config.ts`, `plugins.ts`). `src/store/` = Pinia stores. `src/plugin-api/` = API surface exposed to plugins.
- `src-tauri/src/` — Rust backend: `main.rs` (all command registration + app setup), `decker.rs` (serial protocol; sliders arrive as msgpack maps `slider1..slider5`, emitted to the frontend as `slider-change` events), `midi.rs`, `plugin_runtime.rs` / `plugin_server.rs` / `plugin_marketplace.rs` (Deno plugin processes + Socket.IO bridge), `power_monitor.rs`.
- `plugin-sdk/` — standalone SDK package for plugin authors, with its own package.json.
- IPC boundary: frontend calls `invoke('command_name', { camelCaseArgs })`; Tauri maps camelCase args to snake_case Rust parameters. Every new `#[tauri::command]` must be registered in the `invoke_handler` list in `main.rs` or it fails only at runtime.

## Build constraints

- Sibling path dependency: `volume-control-rs` must be checked out at `../../` relative to `src-tauri/`. Builds fail without it. Don't "fix" the path to a git dep unless asked — it carries unpublished Linux fixes. (`psp` was switched back to a git dep 2026-07-03 after its Linux fixes were published.)
- `serialport` is pinned to `=4.3.0` (newer versions read slowly). Don't bump it.
- Platform-specific code must be `#[cfg(target_os = ...)]`-gated. When fixing Linux, don't break the Windows build (and vice versa); say so explicitly if you could only verify one platform.
- On Bazzite the host is immutable: builds work via committed `src-tauri/pkgconfig/` + `src-tauri/lib/` symlinks + `.cargo/config.toml`, but prefer Distrobox (`yarn dev:linux` handles it).

## Verification

There is no automated test suite. Compiling is not verification — exercise the running app:

- Debug builds embed a Tauri MCP bridge (`tauri-plugin-mcp-bridge`); the `tauri` MCP server in `.mcp.json` exposes tools to invoke IPC commands, read logs, snapshot/screenshot the webview, and interact with it. Use these to drive and observe the app instead of guessing from code.
- No Decker attached? Simulate one over a PTY pair — see the `simulate-decker` skill.
- Minimum bar before claiming done: `npx vue-tsc --noEmit` for TS changes, `cargo check` for Rust changes, and drive the affected flow in the running app when feasible. If you couldn't verify something (missing hardware, wrong platform), state that explicitly rather than implying it works.
- The app is tray-first and may start hidden; a running process with no window is normal. Check logs before assuming a crash.

## Working style

- Lead with the outcome. The first sentence of a summary answers "what happened / what did you find"; detail comes after. Write complete sentences, not fragments or arrow chains.
- Act, don't ask. For reversible actions that follow from the request, proceed. Ask only before destructive actions or genuine scope changes.
- When the user describes a problem or asks a question, the deliverable is your assessment — investigate, report findings with file:line references, and stop. Fix only when asked.
- Report honestly. If a check fails, show the failure; if a step was skipped, say so. Never claim verification you didn't perform.
- Match the surrounding code's idiom, naming, and comment density. No comments that narrate what the next line does or justify the change — a comment must state a constraint the code can't show (like the existing `serialport` pin comment).
- Prefer editing existing files over creating new ones. Don't create documentation files unless asked.
- Keep long tool output out of the main thread: use the `build-checker` agent to digest cargo/vue-tsc output, the `Explore` agent for broad code searches, and the `ipc-reviewer` agent after changes that cross the Rust↔TS boundary.
- Significant changes get tested against real hardware before merge; flag anything you could only test simulated.

## Git Commits

- Use conventional commit format.
- Do not use a scope.
- Use a one-line commit message.
- Never add `Co-authored-by`.
