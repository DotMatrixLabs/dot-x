# Decker Lite support

Issue: #166

## Intent

Decker Lite (USB `04D8:E4B5`, model `VML-5SW`) is Decker without LEDs. Dot X should recognize it as a supported device, show its batch number where Decker shows its serial number, and hide or refuse everything that drives LEDs. No Lite hardware exists yet, so this ships untested on hardware. The PR must say so.

## Goals

- Lite connects, its device info parses, and settings show "Decker Lite", model, firmware and batch number.
- No LED surface is shown for Lite: the RGB settings block (including "switch off LEDs on sleep") and the "device brightness" mapping target.
- Anything that tries to drive LEDs on a Lite fails with a clear error instead of sending bytes the firmware ignores.
- Plugins can tell a Lite apart from a Decker, and their `rgb.*` calls on a Lite return an error.
- Linux users can open a Lite without running as root.

## Non-goals

- Lite firmware updates (bundling a Lite `.hex`, looking for PID `E4B5` in bootloader search). These follow once `decker-firmware-updates` merges. The PR and #166 will say so.
- Telemetry changes. `decker_connected` stays Decker-only.
- Firmware changes to either device.

## Anti-goals

- Plugin RGB calls on a Lite that report success.
- A Lite briefly shown as "unknown" or with RGB controls before its handshake reply arrives.

## Approaches

- **A. Identify by USB VID/PID (chosen).** Known before the handshake, so every surface is right as soon as a port is picked. Replaces six copies of the `1240/58918` check.
- B. Identify by the model string from `get-device-info`. Unknown until the handshake, and depends on the EEPROM being written at manufacturing, which we can't check.
- C. Firmware reports its features. Needs firmware releases on both devices; out of scope.

Plugin contract: option 1 was chosen. The SDK learns the device, and `rgb.*` errors on a Lite.

## Design

**Device identity.** One helper per side maps VID/PID to `Decker` | `Decker Lite` | unknown, plus whether the device has LEDs:
- Rust, in `decker.rs`. It replaces the `is_decker` check at line 352.
- TS, a small module under `src/ts/`. Callers: `decker.ts` (telemetry check, unchanged behavior) and `Device.vue` (`deviceInfo`, `deviceName`, `deviceSelected`, `getConnectedDevice`).

`deckerStore.deviceType` holds `'Decker' | 'Decker Lite' | 'Unknown'`. The `'VM-5SW' → Decker` name table gains `'VML-5SW' → Decker Lite`.

**Device info parsing.** `DeviceData` takes `serialNumber` and `batchNumber` as optional fields, so both firmwares parse. Settings show "Batch Number" for Lite and "Serial Number" for Decker. The connect log line prints whichever is present. Add a unit test that parses a Lite frame, next to the existing `DEVICE_FRAME` test.

**LED guard.**
- TS: `RGBController.setEffect` refuses on a device without LEDs. It logs and throws/returns an error and does not touch the serial port. Settings, the "device brightness" mapping and plugin calls all go through it.
- `pluginAPI.ts` returns that error to the plugin.
- Rust: the suspend-dim in `power_monitor.rs` skips a connected Lite. The connection already knows the PID. (My call; harmless either way, but it keeps one rule on both sides.)

**UI.**
- `Device.vue`: the RGB block shows only for `Decker` (today it is `deviceType === 'Decker'`; keep it exact).
- `SystemUtilitiesSelector.vue`: "device brightness" is offered only for `Decker`. An existing mapping stays visible, as today, so it can be removed.
- `SliderOverview.vue:90` sends a raw `rgb-control`. Route it through the guard or skip it on a Lite.

**Plugins.**
- `DeviceInfo` (plugin SDK `device.ts`, `pluginAPI.ts getDeviceInfo`): `name` becomes `"Decker"` / `"Decker Lite"` from the identity helper, replacing the hard-coded `'Decker'`. A new optional `model` holds the reported model string.
- SDK `rgb.ts` docs say calls error on devices without LEDs.
- Regenerate types (`npm run generate-types`) and update the SDK READMEs where they describe RGB or `DeviceInfo`.

**Linux.** Add the `04d8:e4b5` udev rule to `src-tauri/extra/70-dot-x.rules` and `SerialAccessDialog.vue`.

## Left to the builder

- The exact error text for refused RGB calls.
- Whether the TS helper is a function or a small table.

## Verification

- `yarn build`, `cargo test --locked`, and the SDK build and type check.
- With the `simulate-decker` emulator, send a Lite-shaped `get-device-info` frame (with `batchNumber`, `VML-5SW`) and check that it parses. PID-based UI branches can't be simulated over a virtual port, so check those by reading the code and say so in the PR.
- No hardware test is possible. The PR states this.
