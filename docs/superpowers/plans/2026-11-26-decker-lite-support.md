# Decker Lite Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dot X recognizes Decker Lite (`04D8:E4B5`), shows its batch number, and hides or refuses every LED path on it.

**Architecture:** The device type comes from USB VID/PID, with one helper in Rust and one in TS. `Decker.init` sets the store's `deviceType` on every connect path. LED commands are refused on a Lite at three points: `RGBController.setEffect`, the "device brightness" mapping in `volumeControl.ts`, and Rust `set_device_brightness`. The UI and the plugin API read the store.

**Tech Stack:** Rust (serde, serialport), Vue 3 + Pinia, vitest, plugin SDK (TypeScript, typedoc).

**Spec:** `docs/superpowers/specs/2026-11-26-decker-lite-support-design.md`

## Global Constraints

- Decker: VID `0x04D8` (1240), PID `0xE626` (58918), model `VM-5SW`. Decker Lite: VID `0x04D8` (1240), PID `0xE4B5` (58549), model `VML-5SW`.
- Display names are exactly `Decker` and `Decker Lite`. The store's unknown value stays `Unknown`.
- Only `Decker Lite` is treated as having no LEDs. `Unknown` serial devices keep today's behavior, because people run other devices with Dot X.
- No telemetry changes. `decker_connected` stays Decker-only.
- No Lite firmware-update work.
- No added latency or polling on the slider path.
- Commit titles: conventional prefix with a scope (`device`, `rgb`, `plugins`, `build`, `docs`), one lowercase imperative line, no body.

## Review Focus

1. **Lite connected but settings never opened.** Today `deviceType` is only set in `Device.vue`, so a tray-only session leaves it `Unknown`, and the guards would let LED commands through. Task 2 moves the assignment into `Decker.init` and tests it.
2. **Lite user with an existing "device brightness" mapping.** Moving that slider must not throw on every tick or spam warn-level logs; it logs at debug and sends nothing. Pinned in Task 3.
3. **Opening settings with a Lite connected.** `Device.vue` mounted calls `sendCurrentRGBEffect()`, which must not throw or send anything. Covered in Task 4 by gating the call.
4. **Old Decker firmware or a blank EEPROM** that sends neither `serialNumber` nor `batchNumber`. It must still parse. Pinned in Task 1.
5. **A plugin calling `rgb.setEffect` on a Lite.** It gets `success: false` with the no-LED message, not `success: true`. Pinned in Task 3 through the thrown error that `pluginAPI.ts` already turns into an error response.

---

### Task 1: Rust: device kind, Lite device info, suspend-dim guard

**Files:**
- Modify: `src-tauri/src/decker.rs` (`DeviceData` ~54, `initialize_decker` ~349-357 and the log at ~441, `set_device_brightness` ~507, tests ~566+)

**Interfaces:**
- Produces: `pub enum DeviceKind { Decker, DeckerLite }` with `fn from_usb(vid: u16, pid: u16) -> Option<DeviceKind>` and `fn has_leds(self) -> bool`. `DeviceData.serial_number: Option<String>` and `batch_number: Option<String>` (serde `serialNumber` / `batchNumber`, both `#[serde(default)]`).

- [ ] **Step 1: Write failing tests** in the existing `tests` module:
  - `const LITE_DEVICE_FRAME: &[u8] = b"\x83\xabbatchNumber\xa4B001\xabdeviceModel\xa7VML-5SW\xaffirmwareVersion\xa50.0.3\r\n";`
  - `decodes_a_lite_device_frame`: draining the frame yields one `DataType::Device` with `batch_number == Some("B001")`, `serial_number == None`, `device_model == "VML-5SW"`.
  - `decodes_device_frame_without_serial_or_batch`: a frame with only `deviceModel` + `firmwareVersion` (`\x82`…) yields `DataType::Device` with both `None`.
  - The existing `decodes_every_message_in_one_read` also asserts `serial_number == Some("test")`.
  - `device_kind_from_usb`: `(1240, 58918) → Some(Decker)`, `(1240, 58549) → Some(DeckerLite)`, `(1240, 1) → None`; `Decker.has_leds()`, `!DeckerLite.has_leds()`.
- [ ] **Step 2: Run them and see them fail.** Run `cargo test --locked` in `src-tauri/`. Expected: compile errors (`DeviceKind`, `batch_number` don't exist yet).
- [ ] **Step 3: Implement.**
  - Add `DeviceKind` and the optional fields.
  - In `initialize_decker`, replace `is_decker` with `let kind: Option<DeviceKind>` from the matching USB port. Log when `kind.is_some()`, printing `serial` or `batch`, whichever is present.
  - Add `static CONNECTED_HAS_LEDS: AtomicBool` (default `true`). Set it from the connected port's kind in `initialize_decker`: `false` only for `DeckerLite`.
  - `set_device_brightness` returns early with `info!("Skipping LED brightness: device has no LEDs")` when the flag is false. The suspend dim in `power_monitor.rs` goes through it, so no change there.
- [ ] **Step 4: Run** `cargo test --locked`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(device): recognize decker lite and parse its batch number`

### Task 2: TS: device type helper, set it on every connect

**Files:**
- Create: `src/ts/deviceModels.ts`, `src/ts/deviceModels.test.ts`
- Modify: `src/store/deckerStore.ts` (`deviceType` type, `setDeviceType`), `src/ts/decker.ts:115-117` (`init`)

**Interfaces:**
- Produces, in `deviceModels.ts`:
  - `export type DeviceType = 'Decker' | 'Decker Lite' | 'Unknown'`
  - `export function deviceTypeFor(device: { vid: number; pid: number } | null | undefined): DeviceType`
  - `export function hasLeds(type: DeviceType): boolean` (false only for `'Decker Lite'`)
  - `export const MODEL_BY_TYPE: Record<Exclude<DeviceType, 'Unknown'>, string> = { 'Decker': 'VM-5SW', 'Decker Lite': 'VML-5SW' }`
  - `export const NAME_BY_MODEL: Record<string, DeviceType> = { 'VM-5SW': 'Decker', 'VML-5SW': 'Decker Lite' }`
- `deckerStore.deviceType: DeviceType`. `setDeviceType(type: DeviceType)`.

- [ ] **Step 1: Write failing tests** in `deviceModels.test.ts`:
  - `deviceTypeFor({vid:1240,pid:58918})` is `'Decker'`, `{vid:1240,pid:58549}` is `'Decker Lite'`, `{vid:1240,pid:1}` and `undefined` are `'Unknown'`.
  - `hasLeds('Decker')` and `hasLeds('Unknown')` are true. `hasLeds('Decker Lite')` is false.
- [ ] **Step 2: Run** `yarn test`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `deviceModels.ts` and type the store. In `Decker.init`, after finding `device`, call `deckerStore.setDeviceType(deviceTypeFor(device))` before `connect_decker`. Change the telemetry check to `deviceTypeFor(device) === 'Decker'`, which keeps its behavior.
- [ ] **Step 4: Run** `yarn test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(device): set the device type on every connect`

### Task 3: TS: refuse LED commands on a Lite

**Files:**
- Modify: `src/ts/RGBController.ts` (`setEffect`), `src/ts/volumeControl.ts:181-215` ("device brightness" branch), `src/SliderOverview.vue:88-91` (delete the unused `clickTest`, which sends a raw `rgb-control`)
- Test: `src/ts/RGBController.test.ts` (create), `src/ts/volumeControl.test.ts`

**Interfaces:**
- Consumes: `hasLeds`, `useDeckerStore().deviceType` (Task 2).
- Produces: `export const NO_LEDS_ERROR = 'This device has no LEDs'` in `RGBController.ts`. `setEffect` throws `new Error(NO_LEDS_ERROR)` before storing values or sending.

- [ ] **Step 1: Write failing tests.**
  - `RGBController.test.ts`: mock `./decker` (`sendCommand: vi.fn()`) and `../store/deckerStore` with `deviceType: 'Decker Lite'`. `setEffect('static', 0, 255, '#ffffff')` throws `NO_LEDS_ERROR` and `sendCommand` is not called. With `'Decker'`, `sendCommand` is called once with `'rgb-control'`.
  - `volumeControl.test.ts`: a new case with the store mock returning `deviceType: 'Decker Lite'` and a channel mapped to `["device brightness"]`. `setChannelVolume(0, 0.5)` resolves and `invoke` is not called with `'send_decker_command'`.
- [ ] **Step 2: Run** `yarn test`. Expected: the new cases FAIL.
- [ ] **Step 3: Implement.**
  - Add the guard at the top of `setEffect`.
  - In `volumeControl.ts`, skip the whole "device brightness" branch when `!hasLeds(deckerStore.deviceType)`, with `log.debug`. Don't use warn here: this runs on every slider tick.
  - Delete `clickTest`.
  - `pluginAPI.ts` already wraps `setEffect` in try/catch and returns `RGB control error: <message>`, so it needs no change. Confirm that by reading it.
- [ ] **Step 4: Run** `yarn test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(rgb): refuse led commands on devices without leds`

### Task 4: Settings and mapping UI

**Files:**
- Modify: `src/SettingsModal/Device.vue`, `src/AppSelectModal/SystemUtilitiesSelector.vue:127`

**Interfaces:**
- Consumes: `deviceTypeFor`, `hasLeds`, `NAME_BY_MODEL`, store `deviceType` (Task 2).

- [ ] **Step 1: Implement `Device.vue`.**
  - Drop the local `deviceType` data and `deviceNames`. Read `deviceType` from the store (it's already mapped via `mapState`, ~142). Keep the RGB block's `v-if="deviceType === 'Decker'"`.
  - `deviceSelected` and `getConnectedDevice` call `deckerStore.setDeviceType(deviceTypeFor(device))`. Remove their `58918` branches.
  - `deviceName(device)`: `` `${type} (${port})` `` for a known type, otherwise the port.
  - `deviceInfo(device)`: for a known type, return `deviceName: NAME_BY_MODEL[model] ?? type`, `model`, `firmwareVersion`, `comPort`, and either `serialNumber` or `batchNumber`.
  - Add `batchNumber: { name: "Batch Number", … }` to `deviceInfoPoints`. Make sure the template renders only the points present in `deviceInfo()`; check how it iterates today.
  - `sendCurrentRGBEffect()` returns immediately unless `deviceType === 'Decker'`. This covers the mounted and reconnect calls at ~200/416/423.
- [ ] **Step 2: Implement `SystemUtilitiesSelector.vue`.** The condition stays `deviceType === 'Decker' || activeUtilities includes 'device brightness'`. Confirm it, and change only if typing requires it.
- [ ] **Step 3: Run** `yarn build`. Expected: vue-tsc passes and the build succeeds.
- [ ] **Step 4: Commit** `feat(device): show decker lite in settings without rgb controls`

### Task 5: Plugin contract

**Files:**
- Modify: `src/plugin-api/pluginAPI.ts:134-145` (`getDeviceInfo`), `plugin-sdk/src/device.ts:17-26` (`DeviceInfo`), `plugin-sdk/src/rgb.ts` (class doc), `plugin-sdk/README.md` (where it describes `DeviceInfo` or RGB), and the generated `plugin-sdk/src/generated/types.ts` and `src/plugin-api/schema.ts` if the generator touches them

**Interfaces:**
- Consumes: store `deviceType`, `MODEL_BY_TYPE` (Task 2).
- Produces: `DeviceInfo.name` is `'Decker' | 'Decker Lite' | 'Unknown'` at runtime (the type stays `string`). New `DeviceInfo.model?: string`, documented as "Product model for a recognized device (`VM-5SW`, `VML-5SW`); absent for unknown devices".

- [ ] **Step 1: Implement.**
  - `getDeviceInfo` returns `name: deckerStore.deviceType` and `model: MODEL_BY_TYPE[type]` when the type is known.
  - Add `model?` to the SDK `DeviceInfo`.
  - In the `rgb.ts` class doc, say that calls fail on devices without LEDs, such as Decker Lite.
  - Update the README wherever it says the device is always "Decker" or that RGB always works.
- [ ] **Step 2: Run** `npm run generate-types`, then the SDK build (see `plugin-sdk/package.json` and the CI job in `.github/workflows/ci.yml`). Expected: success, with only the intended diff in generated files.
- [ ] **Step 3: Run** `yarn build`. Expected: success.
- [ ] **Step 4: Commit** `feat(plugins): expose device name and model, document rgb on decker lite`

### Task 6: Linux udev rule

**Files:**
- Modify: `src-tauri/extra/70-dot-x.rules:9`, `src/SettingsModal/SerialAccessDialog.vue:59`

- [ ] **Step 1: Implement.** Add `SUBSYSTEM=="tty", ATTRS{idVendor}=="04d8", ATTRS{idProduct}=="e4b5", MODE="0660", TAG+="uaccess"` beneath the Decker rule in the rules file. In the dialog, show both rules when the device's PID is Lite's, or always show both lines. Pick whichever reads simpler after looking at how `DECKER_UDEV_RULE` is used.
- [ ] **Step 2: Check the docs.** Grep `LINUX-SUPPORT.md` and `README.md` for `e626` or the rule text and update any matches.
- [ ] **Step 3: Run** `yarn build`. Expected: success.
- [ ] **Step 4: Commit** `feat(device): allow decker lite serial access on linux`

### Task 7: Verify end to end

- [ ] **Step 1:** Run `yarn build`, `yarn test`, and `cargo test --locked` (in `src-tauri/`). Expected: all green.
- [ ] **Step 2:** Using the `simulate-decker` skill, make the emulator answer `get-device-info` with the Lite frame (`batchNumber`, `VML-5SW`). Back up `%APPDATA%\com.dot-x.dev` to `%TEMP%` first. Close the installed app if it holds a port, and say so. Confirm the dev app log shows the connect line with `batch B001`, and that the `device-info` event reaches the frontend. Note that a virtual port can't present PID `E4B5`, so the PID-based UI branches are checked by reading the code and the Task 2–3 unit tests.
- [ ] **Step 3:** Run the same emulator flow with the Decker frame. Settings still show RGB and the serial number: a regression check.
- [ ] **Step 4:** Draft the PR notes, but don't open the PR until asked. Include:
  - "No Decker Lite hardware exists yet; untested on hardware."
  - "Lite firmware updates (bundled `.hex`, bootloader search for `0xE4B5`) are a follow-up to `decker-firmware-updates`."
  - Which entries from AGENTS.md's "Hit every surface" list applied.
  - Linux was only checked by reading the code.

  Ask the maintainer before posting the follow-up note on #166.
