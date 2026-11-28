# Decker firmware updates from Dot X

Issue: #130

**Scope update (2026-11-25):** this branch ships firmware updates for Decker only. Decker Lite support, including Lite firmware updates, moves to its own thread and issue #166, because no Lite units exist yet. The Lite notes below stay as input for that work. Lite enumerates as `04D8:E4B5` (issue #166), not `04D8:E626`, so Lite flashing must also search for that ID.

## Intent

When we fix or improve Decker firmware, users should get it without installing PlatformIO, Arduino IDE, or drivers. Dot X already holds the device's serial port all day, so it is the natural place to deliver firmware. A user who sees "update available" clicks one button, waits about 10 seconds, and the sliders come back on the new firmware.

## Goals

- Dot X ships a firmware file per device model (Decker and Decker Lite) and offers it when the connected device runs older firmware.
- A flash only runs after the user said yes: either by installing the Dot X update that carried the firmware, or by clicking Update. Dot X never flashes a device out of the blue.
- A flash that fails, or is interrupted by unplugging, leaves a device that Dot X can still recover with one click.
- Works on Windows and Linux.

## Non-goals

- Downloading firmware separately from Dot X. Firmware ships inside the Dot X installer and reaches users through normal Dot X updates.
- Downgrading or picking a firmware version. Dot X offers only the version it bundles, and only when it is newer.
- Flashing devices other than the models we bundle firmware for (DIY Arduino devices, unknown models).
- Exposing firmware updates to plugins. Not supported in plugins; the plugin SDK does not change.
- Flashing the bootloader, EEPROM, or fuses. Only the application flash area is written.

## Anti-goals

- Anything that adds polling, latency, or wakeups to the slider path when no flash is running.
- A flash that "succeeds" without verification, or a failure that only shows up in the log.
- Dot X's normal connect logic grabbing the device while it is in the bootloader.

## How users see it

Mockups (HTML, Dot X dark theme, 800×600) were reviewed with the maintainers. They picked a red dot plus an Update button, plus a prompt on connect, and then added automatic flashing right after a Dot X update:

0. **Right after a Dot X update.** On the first launch of a new Dot X version (the launch where What's New shows), if a device is connected and its firmware is older than the newly bundled firmware, Dot X flashes it automatically. The user consented by installing the Dot X update, and Dot X updates only install when the user clicks Update, so the user is at the PC. The What's New modal shows a status line: "Updating Decker firmware… NN%. Don't unplug Decker." which becomes "Decker updated to X.Y.Z" when done. On failure, a toast says so, and the red dot and **Retry** (below) stay until the device is up to date. The prompt (3) is not shown in this case.

1. **Red dot.** While the connected device's firmware is older than the bundled firmware, a small red dot shows on the settings gear in the top bar, and on the Device tab in Settings. The dot clears only when the device reports the new version, not when settings is opened (same as the plugin "Update available" badge).
2. **Update button.** In Settings → Device → Device Info, the Firmware row shows the current version and a primary button "Update to X.Y.Z".
3. **Prompt on connect.** When an outdated device connects and the automatic update (0) did not apply (the device was unplugged during the Dot X update, it is a new device, Dot X is a fresh install, or the platform is Linux, where Dot X is updated by hand), Dot X shows a modal once: title "Decker firmware update", a line saying which version is ready and which the user has, a line that sliders pause for about 10 seconds, and buttons **Later** / **Update now**. **Later** suppresses the prompt for that bundled firmware version only, across restarts. When a newer Dot X bundles newer firmware, the prompt shows once again. The red dot and button are unaffected by Later. If What's New is open, the prompt waits until it closes.
4. **While flashing.** The button becomes "Updating… NN%" with a progress bar and the warning "Don't unplug Decker. Sliders resume when the update finishes." The prompt's **Update now** leads to the same state in Settings → Device (the prompt closes, settings opens on Device).
5. **After.** The row shows the new version with "Up to date" and the dots disappear. On failure, the row shows a short error and a **Retry** button; the error is also logged at `error` level.

The prompt is shown in the main window. Dot X often runs with the window hidden in the tray; the prompt and dot simply wait until the window is opened. No OS notification and no tray icon badge.

## Approaches considered

1. **Flasher written in Rust (chosen).** The Decker bootloader (`decker-bootloader`, Caterina-based) speaks AVR109. Dot X implements the reboot, bootloader discovery, write and verify itself over the existing `serialport` crate. Exact progress, no extra binaries in the installer, same code on Linux. Cost: we own ~200–300 lines of protocol code.
2. **Ship avrdude as a sidecar.** Proven flasher, but a third-party binary to sign and ship per platform, GPL obligations, progress parsed from text output, and we would still write the reboot-and-find-port step. Rejected.
3. **Frontend flashing.** Tauri's webview has no Web Serial, so it would go through Rust anyway. Rejected.

Firmware source, also decided: **bundle the `.hex` in the Dot X installer** (rather than a separate download feed). New firmware needs a Dot X release; in exchange there is no new hosting, no separate signing, it works offline, and the private firmware repo is not a problem for users. The compiled `.hex` files are committed to the dot-x repo (public); the firmware source stays private. Maintainers confirmed this is fine.

Consequence of bundling plus automatic flashing: a bad firmware reaches every user who updates Dot X. New firmware therefore ships in a beta Dot X build first and goes to stable only after beta users have run it. This is a release habit, documented in `.github/RELEASING.md`, not code.

## Hardware facts this relies on

- Decker and Decker Lite both: ATmega32U4, 16 MHz, 32 KB flash, 4 KB bootloader at the top, so the application area is 28 672 bytes (`0x0000–0x6FFF`), 128-byte pages.
- Every shipped Decker and Decker Lite has `decker-bootloader` (confirmed by maintainers). No stock Leonardo bootloaders in the field.
- Decker firmware is `decker-firmware` (current version 0.0.3), Decker Lite firmware is `decker-lite-firmware`: separate codebases, separate `.hex` files. Both are Arduino-framework PlatformIO projects. `decker-firmware` builds against a hand-patched Arduino core (see its README); whoever builds the committed `.hex` must use it.
- Model strings (in EEPROM, set at manufacturing): Decker reports `VM-5SW` (confirmed from a connected unit, firmware 0.0.3). Decker Lite: `VML-5SW` (confirmed by maintainers); the Lite manufacturing step must write this string. `VM-5SW-L` is avoided for Lite because the `decker.rs` test fixture says a real Decker reported it.
- Decker Lite's `get-device-info` reply sends `batchNumber` instead of `serialNumber`. Dot X's `DeviceData` in `decker.rs` requires `serialNumber`, so today it fails to parse Lite device info. This must be fixed (accept `batchNumber` as the serial number when `serialNumber` is absent), or Lite never reaches the firmware check.
- The Arduino core reboots into the bootloader when the host opens the CDC port at 1200 baud and drops DTR (it sets boot key `0x7777` at `0x0800` and triggers the watchdog; `bootloader.c` checks it).
- Bootloader and firmware both enumerate as VID/PID `04D8:E626` (1240/58918). They cannot be told apart by ID. The port name may or may not change across the reboot (Windows usually keeps the COM number; Linux may move `ttyACM0` → `ttyACM1`).
- The bootloader answers `S` with `CATERIN`. Its 8 s timeout only runs while flash word 0 is not `0xFFFF`. With an erased application it stays in the bootloader indefinitely, and a power-on reset with word 0 erased also stays in the bootloader.
- The device's model and serial number live in EEPROM, which a flash does not touch. `get-device-info` returns `{serialNumber, deviceModel, firmwareVersion}`.
- Normal firmware sends slider values at least every second, even when nothing moves. The bootloader never sends anything unsolicited.

## Design

### Bundled firmware

- `src-tauri/firmware/` holds one `.hex` per model plus `firmware.json`:
  ```json
  [
    { "models": ["VM-5SW", "VM-5SW-L"], "version": "0.0.4", "file": "decker-0.0.4.hex" },
    { "models": ["VML-5SW"], "version": "0.0.1", "file": "decker-lite-0.0.1.hex" }
  ]
  ```
  Added to `bundle.resources` in `tauri.conf.json`. The hex is built from `decker-firmware` and committed here; Dot X does not build firmware.
- Rust loads `firmware.json` on demand (resource path via Tauri's path resolver). Versions compare with the `semver` crate already in `Cargo.toml`. A device version that does not parse as semver (e.g. `0.0.0-emulator`, or empty) counts as "unknown": no dot, no prompt, no button.

### Rust: `src-tauri/src/firmware.rs` (new)

Three Tauri commands, registered in `main.rs`, with stubs or real implementations on both platforms:

- `firmware_check(model, version) -> Option<{ version }>`: returns the bundled version if one exists for `model` and is newer than `version`.
- `firmware_flash(port_name, model)`: runs the flash, emitting `firmware-progress` events `{ stage, percent }` (`stage`: `rebooting`, `writing`, `verifying`, `done`). Returns `Ok` only after verification passes and the device is running again. Errors are returned as user-readable strings and logged at `error`.
- `firmware_bootloader_present(port_name) -> bool`: probes a silent Decker port (see Recovery).

Flash sequence:

1. Set a global `FLASHING` flag. While it is set, `connect_decker` (in `decker.rs`) refuses to connect and returns an error, so neither the frontend's 1 s reconnect loop (`decker.ts detectDeviceChanges`) nor anything else can grab the port.
2. Stop the existing connection (`kill_decker_thread` / disconnect) and wait for the port to be released.
3. Reboot to bootloader: open `port_name` at 1200 baud, set DTR false, close. Skip this step if the port already answers as the bootloader (recovery case).
4. Find the bootloader: poll `available_ports()` every ~100 ms for up to ~5 s for ports with VID/PID `04D8:E626` (or the same `port_name`, for virtual ports). Open each candidate and send `S`; the one answering `CATERIN` is the bootloader. Must finish well inside the bootloader's 8 s window.
5. Parse the Intel HEX file. Reject it if it is not valid, has data outside `0x0000–0x6FFF`, or is empty. Pad to whole 128-byte pages with `0xFF`.
6. `e` (erase application area).
7. Write every page **except page 0**, with `A` (set word address) and `B <size> F <data>` (block load), checking each `\r` acknowledgement. Then read everything back with `g` and compare.
8. Write page 0 last, and verify it. Because word 0 stays `0xFFFF` until this step, any interruption before it leaves the device sitting in the bootloader, where it can be flashed again.
9. `E` (exit bootloader, run the new firmware).
10. Clear `FLASHING`. The frontend reconnects through its normal path. Treat the flash as finished only when the device reconnects and `get-device-info` reports the bundled version; if it does not within ~10 s, report an error.

The AVR109 client and HEX parser are written against `Read + Write` (not a concrete port), so unit tests can drive them with an in-memory fake bootloader. Every serial read in the flasher has a timeout; no step can hang forever.

### Recovery from an interrupted flash

If a port with Decker's VID/PID connects but sends nothing for 3 s, the frontend calls `firmware_bootloader_present`. If it answers as the bootloader, Settings → Device shows the Firmware row as "Update didn't finish" with a **Retry** button, plus the red dots. Retry runs `firmware_flash` starting at step 4. A device in the bootloader cannot report its model, so `model` comes from the last device info Dot X saw on that port, remembered in config. If Dot X has never seen the model, Retry refuses with a clear error ("Dot X doesn't know which device this is. Connect it to the PC where it was last updated.") rather than guessing: the wrong file would put the other model's firmware on the device.

This check only runs for a silent Decker port, so it adds no wakeups to a working connection.

The bootloader often enumerates under a different port name than the firmware (COM17 instead of COM16 on Windows, ttyACM1 instead of ttyACM0 on Linux). So while the saved port is missing, Dot X also asks each port with Decker's USB ID whether it is the bootloader (`firmware_find_bootloader`). It asks at most twice per change in the set of Decker ports, so a working Decker on another port isn't opened over and over. The model lookup falls back to the only model Dot X has seen on any port, because the bootloader's port was never the one the model was recorded on. That guess is only safe while Decker is the only model: drop the fallback, or record the model by USB serial, when Decker Lite ships.

### Frontend

- `deckerStore` gains firmware state: `firmwareUpdate` (bundled version or null), `flashing`, `progress`, `error`, `inBootloader`.
- On `device-info`, call `firmware_check(deviceModel, firmwareVersion)` and store the result. This drives the gear dot (`TopBar.vue`), the Device tab dot (`SettingsModal.vue`), and the Firmware row (`Device.vue`).
- Prompt: a new small modal component next to `UpdatePrompt` in `App.vue`. It shows when `firmwareUpdate` is set and `ConfigStore` `firmwareUpdatePromptDismissed` is not equal to that version. **Later** writes the version to that key.
- Automatic flash after a Dot X update: on the launch where `updateStore.shouldShowWhatsNewOnLaunch()` fires, wait for the first `device-info` (up to a few seconds after connect); if `firmware_check` returns an update, start `firmware_flash` and feed progress into the What's New modal. If no device connects during that launch, nothing happens automatically; the prompt path covers it later.
- `DeviceData` parsing in `decker.rs` accepts Lite's `batchNumber` (see hardware facts).
- While `flashing`, `detectDeviceChanges` skips reconnect attempts (the Rust flag is the real guard; this just avoids error noise in the log).

## Testing

- Rust unit tests (`cargo test --locked`): HEX parsing (valid, bad checksum, out of range), page splitting with page 0 last, the full write/verify sequence against an in-memory fake Caterina, and a verify mismatch failing loudly.
- `yarn build` for the frontend.
- On a real Decker and a real Decker Lite: update, automatic update after a Dot X update, interrupted update (unplug mid-write, then replug and Retry), Later persistence across restart, a newer bundled version re-prompting. Close the installed Dot X first (it holds the port) and restore it after.
- Linux: the same real-device run on the Linux test device (`/dev/ttyACM0`), since the port name can change across the reboot.
- The decker emulator stays as it is. Virtual ports cannot re-enumerate, so it cannot stand in for the reboot step.

## Left to the builder

- Exact HEX parser: hand-written (~40 lines) or a small crate.
- Exact timeouts and retry counts within the limits above.
- Component and event names.
- Copy wording beyond what the mockups show.
