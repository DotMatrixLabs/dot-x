# Decker Firmware Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dot X flashes bundled firmware onto Decker and Decker Lite: automatically right after a Dot X update, otherwise from a prompt, a red dot and an Update button.

**Architecture:** A new Rust module `src-tauri/src/firmware/` holds the Intel HEX parser, an AVR109 client written against `Read + Write`, the bundled-firmware manifest, and the flash orchestration (reboot at 1200 baud, find the bootloader, write, verify, exit). `decker.rs` stops talking to a port until it has heard valid firmware frames, reports a silent port that answers as the bootloader, and refuses to connect while a flash runs. A Pinia `firmwareStore` drives the dots, the Device tab row, the prompt and the automatic flash.

**Tech Stack:** Rust (Tauri 2, `serialport` 4.3.0, `semver` 1, `serde`), Vue 3 + Pinia + DaisyUI 3, `vue-sonner` toasts.

**Spec:** `docs/superpowers/specs/2026-11-25-decker-firmware-updates-design.md`

## Global Constraints

- Decker VID/PID `1240` / `58918` (`0x04D8` / `0xE626`); the bootloader uses the same ID.
- Application flash `0x0000–0x6FFF` (28 672 bytes), 128-byte pages. Never write outside it; never write EEPROM, fuses or lock bits.
- Bootloader identifies as `CATERIN` in reply to `S`. Its timeout is 8 s while flash word 0 is not `0xFFFF`.
- Write page 0 last. Verify everything with `g` reads before `E`.
- Model strings: Decker `VM-5SW` (and `VM-5SW-L`, seen on a real Decker); Decker Lite `VML-5SW`.
- Unparseable device versions (not semver) get no dot, no prompt, no button.
- No new polling or latency on the slider path. The 3 s silence check runs only on a port that has sent nothing.
- Every command the frontend calls exists on Windows and Linux. The firmware module needs no `#[cfg]`.
- Commits: `.github/instructions/commit-format.instructions.md` format, one lowercase line, scope `device` (or `build`/`docs`). No body, no `Co-Authored-By`.
- Copy (exact): prompt title "Decker firmware update"; buttons "Later" / "Update now"; button "Update to {version}"; progress "Updating… {percent}%"; warning "Don't unplug Decker. Sliders resume when the update finishes."; done "Up to date"; interrupted "Update didn't finish"; unknown model error "Dot X doesn't know which device this is. Connect it to the PC where it was last updated."

## Changes from the approved design (confirm when reviewing this plan)

1. **The automatic flash shows progress in a toast, not the What's New modal.** What's New only opens when a release has a changelog (`updateStore.shouldShowWhatsNewOnLaunch` returns `show: false` without one), so it can't be relied on as the place for progress. A `vue-sonner` loading toast shows on top of whatever is open, What's New included.
2. **"First launch after a Dot X update" is detected with a ConfigStore key `lastLaunchedVersion`**, not from What's New, for the same reason. If the key is missing, this is a fresh install, not an update.
3. **The bootloader probe runs inside the connection thread** and emits a `device-in-bootloader` event, rather than being a separate `firmware_bootloader_present` command. The thread already holds the port, so nothing has to close and reopen it.
4. **New safety rule found while planning:** today `decker.rs` sends `get-device-info` as soon as a Decker port opens. If that port is the bootloader, those msgpack bytes are read as AVR109 commands. `c`, `o`, `m` in `"command"` fill and commit a flash page, and `D` writes EEPROM. That would corrupt a device that's mid-recovery. From now on Dot X sends nothing to a Decker port until it has received one valid firmware frame (firmware sends slider values at least every second).

## Review Focus

1. **Unplugged mid-write.** The device must stay in the bootloader (page 0 still erased) and show "Update didn't finish" with Retry after replug. Pinned by `avr109::tests::interrupted_write_leaves_page_zero_erased` (Task 2).
2. **Bytes reaching a bootloader that aren't AVR109.** Dot X must send nothing until it has heard a valid frame. Pinned by `decker::tests::outbound_gate_blocks_until_first_frame` (Task 4).
3. **Oversized or out-of-range hex** (a build that grew past 28 672 bytes, or a hex that includes the bootloader). It must be rejected before erase. Pinned by `hex::tests::rejects_data_in_bootloader_area` (Task 1), and the flash validates before step `e` (Task 5).
4. **Unknown or odd versions** (`0.0.0-emulator`, empty, `1.0`). These must offer nothing. Pinned by `bundle::tests::unparseable_device_version_offers_nothing` (Task 3).
5. **A second flash while one is running** (prompt and Settings button both clicked, or auto-flash racing a click). It must be refused, not run twice. Pinned by `flash::tests::second_begin_is_refused` (Task 5).

---

## File Structure

- Create `src-tauri/src/firmware/mod.rs`: Tauri commands `firmware_check` and `firmware_flash`, plus `pub use`.
- Create `src-tauri/src/firmware/hex.rs`: Intel HEX → padded flash image.
- Create `src-tauri/src/firmware/avr109.rs`: AVR109 client plus an in-test fake bootloader.
- Create `src-tauri/src/firmware/bundle.rs`: `firmware.json` loading and the newer-version check.
- Create `src-tauri/src/firmware/flash.rs`: `FLASHING` guard, reboot, bootloader discovery, run.
- Create `src-tauri/firmware/firmware.json`, `src-tauri/firmware/decker-0.0.3.hex`, `src-tauri/firmware/decker-lite-0.0.3.hex`, `src-tauri/firmware/README.md`.
- Modify `src-tauri/tauri.conf.json`: add `"firmware/*"` to `bundle.resources`.
- Modify `src-tauri/src/main.rs`: `mod firmware;`, register commands.
- Modify `src-tauri/src/decker.rs`: Lite `batchNumber`, outbound gate, silence probe, refuse while flashing.
- Create `src/store/firmwareStore.ts`: all firmware state and actions.
- Modify `src/ts/decker.ts`: global `device-info` and `device-in-bootloader` listeners, and skip reconnect while flashing.
- Modify `src/components/TopBar.vue`, `src/SettingsModal/SettingsModal.vue`, `src/SettingsModal/Device.vue`: dots and the Firmware row.
- Create `src/components/FirmwarePrompt.vue`. Modify `src/App.vue` to mount it and start the store.
- Modify `.github/RELEASING.md`: beta-first firmware rule.

---

### Task 1: Intel HEX parser

**Files:**
- Create: `src-tauri/src/firmware/hex.rs`
- Create: `src-tauri/src/firmware/mod.rs` (only `pub mod hex;` for now)
- Modify: `src-tauri/src/main.rs` (add `mod firmware;` next to `mod decker;`, line 24)

**Interfaces:**
- Produces: `pub const PAGE_SIZE: usize = 128;`, `pub const APP_SIZE: usize = 28_672;`, and `pub fn parse_ihex(text: &str) -> Result<Vec<u8>, String>`. It returns the image starting at address 0, padded with `0xFF` to a whole number of pages, and its length is a multiple of `PAGE_SIZE` and `<= APP_SIZE`.

- [ ] **Step 1: Write the failing tests** in `hex.rs` `#[cfg(test)] mod tests`:

```rust
#[test] fn parses_and_pads_to_page() {
    // 4 data bytes at 0x0000, then EOF
    let img = parse_ihex(":0400000001020304F2\n:00000001FF\n").unwrap();
    assert_eq!(img.len(), PAGE_SIZE);
    assert_eq!(&img[..4], &[1, 2, 3, 4]);
    assert!(img[4..].iter().all(|b| *b == 0xFF));
}
#[test] fn fills_gaps_with_ff() {
    let img = parse_ihex(":0100800055 2A\n:00000001FF\n".replace(' ', "").as_str()).unwrap();
    assert_eq!(img.len(), 2 * PAGE_SIZE);
    assert_eq!(img[0x80], 0x55);
    assert!(img[..0x80].iter().all(|b| *b == 0xFF));
}
#[test] fn rejects_bad_checksum() { assert!(parse_ihex(":0400000001020304F3\n:00000001FF\n").is_err()); }
#[test] fn rejects_data_in_bootloader_area() { assert!(parse_ihex(":01700000AA E5\n:00000001FF\n".replace(' ', "").as_str()).is_err()); }
#[test] fn rejects_empty_and_missing_eof() {
    assert!(parse_ihex(":00000001FF\n").is_err());
    assert!(parse_ihex(":0400000001020304F2\n").is_err());
}
#[test] fn accepts_crlf_line_endings() { assert!(parse_ihex(":0400000001020304F2\r\n:00000001FF\r\n").is_ok()); }
```

- [ ] **Step 2: Run them to make sure they fail.** Run `cargo test --locked firmware::hex` in `src-tauri/`. Expected: compile error, because `parse_ihex` isn't defined.

- [ ] **Step 3: Implement `parse_ihex`.** Handle record types `00` (data), `01` (EOF; required), and `02`/`04` (extended address; accept only when the result stays below `APP_SIZE`). Reject other types, bad hex digits, bad checksums, any byte at an address `>= APP_SIZE`, and a file with no data. Errors are plain sentences that include the line number.

- [ ] **Step 4: Run the tests to make sure they pass.** Run `cargo test --locked firmware::hex`. Expected: 6 passed.

- [ ] **Step 5: Commit.** `git commit -m "feat(device): parse intel hex firmware images"`

---

### Task 2: AVR109 client

**Files:**
- Create: `src-tauri/src/firmware/avr109.rs`
- Modify: `src-tauri/src/firmware/mod.rs` (`pub mod avr109;`)

**Interfaces:**
- Consumes: `hex::PAGE_SIZE`.
- Produces:
  - `#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize)] #[serde(rename_all = "lowercase")] pub enum Stage { Rebooting, Writing, Verifying, Done }`
  - `pub fn identify<P: Read + Write>(port: &mut P) -> io::Result<bool>`: sends `S`, reads 7 bytes, and returns whether they equal `b"CATERIN"`.
  - `pub fn program<P: Read + Write>(port: &mut P, image: &[u8], progress: &mut dyn FnMut(Stage, u8)) -> Result<(), String>`. It requires `image.len() % PAGE_SIZE == 0` and a non-empty image.

Protocol to implement (each command byte, then what follows; `\r` = ack):

| Step | Send | Expect |
|---|---|---|
| erase | `e` | `\r` |
| set address | `A`, word address hi, lo (word address = byte address / 2) | `\r` |
| block write | `B`, size hi, size lo, `F`, `PAGE_SIZE` bytes | `\r` |
| block read | `g`, size hi, size lo, `F` | `size` bytes |
| exit | `E` | `\r` |

Order: `e`. Then for page 1..n: `A` + `B`, reporting `Writing` with a percent. Then `A` 1 + `g` over pages 1..n, comparing and reporting `Verifying`. Then `A` 0 + `B` page 0, then `A` 0 + `g` page 0 and compare. Then `E`, then `Done` 100. Any byte other than the expected ack, a short read, or a compare mismatch returns `Err` with the failing address. Reads rely on the port's own timeout.

- [ ] **Step 1: Write the fake bootloader and the failing tests.** `FakeCaterina { flash: Vec<u8> /* APP_SIZE of 0xFF, preset junk to prove erase */, addr: usize, input: VecDeque<u8>, output: VecDeque<u8>, writes: Vec<usize> /* page addresses in write order */, fail_after_writes: Option<usize>, corrupt_reads: bool }` implements `Read + Write`. It parses the commands in the table above, and `fail_after_writes` makes `write` return `Err(BrokenPipe)` after that many `B` blocks.

```rust
#[test] fn identify_recognises_caterina() { let mut f = FakeCaterina::new(); assert!(identify(&mut f).unwrap()); }
#[test] fn programs_and_verifies_image() {
    let image = test_image(3); let mut f = FakeCaterina::new();
    program(&mut f, &image, &mut |_, _| {}).unwrap();
    assert_eq!(&f.flash[..image.len()], &image[..]);
    assert!(f.flash[image.len()..].iter().all(|b| *b == 0xFF));
}
#[test] fn writes_page_zero_last() {
    let mut f = FakeCaterina::new(); program(&mut f, &test_image(3), &mut |_, _| {}).unwrap();
    assert_eq!(f.writes, vec![128, 256, 0]);
}
#[test] fn interrupted_write_leaves_page_zero_erased() {
    let mut f = FakeCaterina::new(); f.fail_after_writes = Some(1);
    assert!(program(&mut f, &test_image(3), &mut |_, _| {}).is_err());
    assert_eq!(&f.flash[..2], &[0xFF, 0xFF]);
}
#[test] fn verify_mismatch_fails_before_page_zero() {
    let mut f = FakeCaterina::new(); f.corrupt_reads = true;
    assert!(program(&mut f, &test_image(3), &mut |_, _| {}).is_err());
    assert!(!f.writes.contains(&0));
}
#[test] fn reports_progress_ending_in_done() {
    let mut seen = vec![]; let mut f = FakeCaterina::new();
    program(&mut f, &test_image(3), &mut |s, p| seen.push((s, p))).unwrap();
    assert_eq!(seen.last(), Some(&(Stage::Done, 100)));
    assert!(seen.iter().any(|(s, _)| *s == Stage::Verifying));
}
```

`test_image(pages)` returns `pages * PAGE_SIZE` bytes of `(i % 251) as u8`.

- [ ] **Step 2: Run them to make sure they fail.** Run `cargo test --locked firmware::avr109`. Expected: compile error, because `program`/`identify` aren't defined.
- [ ] **Step 3: Implement `identify` and `program`** as specified above.
- [ ] **Step 4: Run them to make sure they pass.** Run `cargo test --locked firmware::avr109`. Expected: 6 passed.
- [ ] **Step 5: Commit.** `git commit -m "feat(device): add an avr109 client for the decker bootloader"`

---

### Task 3: Bundled firmware and `firmware_check`

**Files:**
- Create: `src-tauri/src/firmware/bundle.rs`
- Create: `src-tauri/firmware/firmware.json`, `src-tauri/firmware/decker-0.0.3.hex`, `src-tauri/firmware/decker-lite-0.0.3.hex`, `src-tauri/firmware/README.md`
- Modify: `src-tauri/src/firmware/mod.rs`, `src-tauri/src/main.rs` (register `firmware::firmware_check` in `generate_handler!`, line 920), `src-tauri/tauri.conf.json` (`bundle.resources` += `"firmware/*"`)

**Interfaces:**
- Produces:
  - `#[derive(Deserialize, Clone)] pub struct BundledFirmware { pub models: Vec<String>, pub version: String, pub file: String }`
  - `pub fn find_update(manifest: &[BundledFirmware], model: &str, device_version: &str) -> Option<BundledFirmware>`: matches the model exactly, and returns `None` when either version doesn't parse as semver or the bundled version isn't greater.
  - `pub fn for_model(manifest: &[BundledFirmware], model: &str) -> Option<BundledFirmware>`
  - `pub fn load_manifest(app: &tauri::AppHandle) -> Result<Vec<BundledFirmware>, String>` and `pub fn load_image(app: &tauri::AppHandle, fw: &BundledFirmware) -> Result<Vec<u8>, String>`. Both resolve `firmware/<name>` with `BaseDirectory::Resource`, the same way `main.rs:825` does for Deno. `load_image` runs `hex::parse_ihex`.
  - Command `#[tauri::command] pub fn firmware_check(app: AppHandle, model: String, version: String) -> Result<Option<String>, String>`: returns the bundled version string when it's newer.

- [ ] **Step 1: Write the failing tests** in `bundle.rs`:

```rust
fn manifest() -> Vec<BundledFirmware> { vec![
    BundledFirmware { models: vec!["VM-5SW".into(), "VM-5SW-L".into()], version: "0.0.4".into(), file: "decker-0.0.4.hex".into() },
    BundledFirmware { models: vec!["VML-5SW".into()], version: "0.0.4".into(), file: "decker-lite-0.0.4.hex".into() },
]}
#[test] fn offers_newer_firmware_for_matching_model() { assert_eq!(find_update(&manifest(), "VM-5SW", "0.0.3").unwrap().file, "decker-0.0.4.hex"); }
#[test] fn lite_gets_lite_firmware() { assert_eq!(find_update(&manifest(), "VML-5SW", "0.0.3").unwrap().file, "decker-lite-0.0.4.hex"); }
#[test] fn same_or_newer_device_version_offers_nothing() {
    assert!(find_update(&manifest(), "VM-5SW", "0.0.4").is_none());
    assert!(find_update(&manifest(), "VM-5SW", "0.1.0").is_none());
}
#[test] fn unknown_model_offers_nothing() { assert!(find_update(&manifest(), "ARDUINO", "0.0.1").is_none()); }
#[test] fn unparseable_device_version_offers_nothing() {
    for v in ["", "1.0", "0.0.0-emulator", "garbage"] { assert!(find_update(&manifest(), "VM-5SW", v).is_none(), "{v}"); }
}
#[test] fn shipped_manifest_parses_and_files_exist() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("firmware");
    let m: Vec<BundledFirmware> = serde_json::from_str(&std::fs::read_to_string(dir.join("firmware.json")).unwrap()).unwrap();
    for fw in &m { crate::firmware::hex::parse_ihex(&std::fs::read_to_string(dir.join(&fw.file)).unwrap()).unwrap(); }
    assert!(for_model(&m, "VM-5SW").is_some() && for_model(&m, "VML-5SW").is_some());
}
```

Note: `0.0.0-emulator` parses as semver, but it is a pre-release. Treat any device version with a pre-release tag as unparseable, because the emulator must never be offered a flash.

- [ ] **Step 2: Add the firmware files.** Decker: copy `D:\decker-firmware\.pio\build\decker\firmware.hex` to `src-tauri/firmware/decker-0.0.3.hex`, after confirming `D:\decker-firmware\include\version.h` says `0.0.3` and the build is from the hand-patched core. Ask the maintainer to confirm that build is the one shipped. Decker Lite: no build exists locally and PlatformIO isn't installed. Ask the maintainer for `decker-lite-0.0.3.hex` (built from `decker-lite-firmware`, `version.h` `0.0.3`) instead of installing tools. `firmware.json`:

```json
[
  { "models": ["VM-5SW", "VM-5SW-L"], "version": "0.0.3", "file": "decker-0.0.3.hex" },
  { "models": ["VML-5SW"], "version": "0.0.3", "file": "decker-lite-0.0.3.hex" }
]
```

`README.md`: three lines. Which repo each hex comes from, that `version` must equal the firmware's `version.h`, and that new firmware ships in a beta Dot X first.

- [ ] **Step 3: Run the tests to make sure they fail.** Run `cargo test --locked firmware::bundle`. Expected: compile error.
- [ ] **Step 4: Implement `bundle.rs` and register `firmware_check`.**
- [ ] **Step 5: Run the tests to make sure they pass.** Run `cargo test --locked firmware::bundle`. Expected: 6 passed. Also run `cargo build` to confirm the resource glob is accepted.
- [ ] **Step 6: Commit.** `git commit -m "feat(device): bundle decker and decker lite firmware"`

---

### Task 4: Safe connection in `decker.rs`

**Files:**
- Modify: `src-tauri/src/decker.rs` (`DeviceData` lines 54-62; `initialize_decker` lines 323-488; tests at 567+)

**Interfaces:**
- Consumes: `firmware::avr109::identify`, `firmware::flash::is_flashing() -> bool` (defined in Task 5; add a stub `pub fn is_flashing() -> bool { FLASHING.load(Ordering::SeqCst) }` with `static FLASHING: AtomicBool` in `flash.rs` now, and Task 5 extends it).
- Produces:
  - `DeviceData.serial_number` accepts either `serialNumber` or `batchNumber` (`#[serde(rename = "serialNumber", alias = "batchNumber")]`).
  - `struct OutboundGate { open: bool }` with `fn on_frame(&mut self)` and `fn allows_send(&self) -> bool`. Commands received while closed are dropped with a `debug!` log line. Nothing queues, and the RGB/brightness state is re-sent anyway by the frontend on connect.
  - On the first valid frame from a Decker port, the thread opens the gate and sends `get-device-info` itself. This replaces the immediate `send_decker_command("get-device-info")` at line 478.
  - If a Decker port (`is_decker`) has produced no valid frame 3 s after opening, the thread calls `avr109::identify` once on its port. If that returns true, it emits `device-in-bootloader` with payload `{ "message": port_name }`, keeps the port open and idle, and never probes again on this connection.
  - `initialize_decker` returns `Err(io::Error::new(ErrorKind::Other, "Firmware update in progress"))` while `flash::is_flashing()`.

- [ ] **Step 1: Write the failing tests:**

```rust
#[test] fn parses_lite_device_info_with_batch_number() {
    // msgpack {"batchNumber":"B1","deviceModel":"VML-5SW","firmwareVersion":"0.0.3"} + \r\n
    let frame = b"\x83\xabbatchNumber\xa2B1\xabdeviceModel\xa7VML-5SW\xaffirmwareVersion\xa50.0.3\r\n";
    let mut pending = frame.to_vec();
    match drain_messages(&mut pending, false).pop() { Some(DataType::Device(d)) => { assert_eq!(d.serial_number, "B1"); assert_eq!(d.device_model, "VML-5SW"); } other => panic!("{other:?}") }
}
#[test] fn outbound_gate_blocks_until_first_frame() {
    let mut g = OutboundGate::default(); assert!(!g.allows_send()); g.on_frame(); assert!(g.allows_send());
}
#[test] fn refuses_to_connect_while_flashing() { /* set FLASHING via flash::test_set_flashing(true); assert initialize_decker-equivalent guard fn `connect_allowed()` is false; reset */ }
```

For the last test, put the guard in `fn connect_allowed() -> bool { !crate::firmware::flash::is_flashing() }` and test that function, with `#[cfg(test)] pub fn test_set_flashing(v: bool)` in `flash.rs`.

- [ ] **Step 2: Run them to make sure they fail.** Run `cargo test --locked decker::`. Expected: the Lite parse test fails, and the gate and guard tests don't compile.
- [ ] **Step 3: Implement the alias, the gate, the first-frame `get-device-info`, the 3 s probe, and the flashing guard.** Keep the probe off the hot path: one `Instant` comparison per loop iteration, only while `!gate.open && !probed`.
- [ ] **Step 4: Run the tests to make sure they pass.** Run `cargo test --locked`. Expected: everything passes, including the existing `decker::tests`.
- [ ] **Step 5: Check against the emulator** (skill `simulate-decker`). Device info still arrives, and sliders still move with no added lag.
- [ ] **Step 6: Commit.** `git commit -m "fix(device): wait for decker frames before sending commands"`

---

### Task 5: Flash orchestration and `firmware_flash`

**Files:**
- Create: `src-tauri/src/firmware/flash.rs`
- Modify: `src-tauri/src/firmware/mod.rs`, `src-tauri/src/main.rs` (register `firmware::firmware_flash`)

**Interfaces:**
- Consumes: `bundle::{load_manifest, for_model, load_image}`, `avr109::{identify, program, Stage}`, `decker::kill_decker_thread`.
- Produces:
  - `pub fn is_flashing() -> bool`.
  - `struct FlashGuard;` with `fn begin() -> Result<FlashGuard, String>` (compare-exchange on `FLASHING`; `Err("A firmware update is already running")` if it's already set). `Drop` clears the flag.
  - Command `#[tauri::command(async)] pub fn firmware_flash(app: AppHandle, port_name: String, model: String) -> Result<(), String>`. It emits `firmware-progress` with `{ "stage": Stage, "percent": u8 }`.

Sequence (spec steps 1–9):
1. `FlashGuard::begin()`.
2. Load the manifest, run `for_model(model)` (if none: `Err("No firmware bundled for {model}")`), and run `load_image`. All validation happens before the device is touched.
3. `kill_decker_thread()`. Then retry opening `port_name` for up to 1 s until it succeeds.
4. If `identify` on the open port at 115200 returns true, it's already the bootloader: go to step 6.
5. Emit `Rebooting` 0. Close, open `port_name` at 1200 baud, set DTR false, and drop it.
6. Find the bootloader: every 100 ms for up to 5 s, list `available_ports()` with VID/PID 1240/58918 (plus `port_name` itself). For each, open it at 115200 with a 500 ms timeout and run `identify`. Take the first that returns true. On timeout: `Err("Decker did not enter update mode. Unplug it, plug it back in, and try again.")`.
7. `avr109::program`, forwarding progress as events.
8. Return. The guard clears `FLASHING` on drop, including on every error path.

- [ ] **Step 1: Write the failing test:**

```rust
#[test] fn second_begin_is_refused() {
    let g = FlashGuard::begin().unwrap();
    assert!(FlashGuard::begin().is_err());
    drop(g);
    assert!(FlashGuard::begin().is_ok());
}
```

- [ ] **Step 2: Run it to make sure it fails.** Run `cargo test --locked firmware::flash`. Expected: compile error.
- [ ] **Step 3: Implement `flash.rs` and register the command.** Log each stage at `info!`, and failures at `error!` with the port and model.
- [ ] **Step 4: Run the tests.** Run `cargo test --locked`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat(device): flash decker firmware over the bootloader"`

---

### Task 6: Firmware store and device-info plumbing

**Files:**
- Create: `src/store/firmwareStore.ts`
- Modify: `src/ts/decker.ts` (`initClass` lines 28-41, and `detectDeviceChanges` lines 231-244)

**Interfaces:**
- Consumes: commands `firmware_check(model, version) -> string | null` and `firmware_flash(portName, model)`; events `device-info`, `device-in-bootloader`, `firmware-progress`, `connection-change`.
- Produces: `useFirmwareStore()` with
  - state: `available: string | null`, `deviceVersion: string | null`, `model: string | null`, `portName: string | null`, `flashing: boolean`, `percent: number`, `error: string | null`, `inBootloader: boolean`, `justUpdated: boolean`.
  - getter `needsAttention: boolean`: `available !== null || inBootloader`. This drives both dots.
  - `onDeviceInfo(portName: string, info: { deviceModel: string; firmwareVersion: string })`: stores the info, saves the model under ConfigStore `firmwareModelByPort[portName]`, and sets `available` from `firmware_check`. It also clears `inBootloader`. If `flashing` was set by a just-finished flash and `firmwareVersion === <flashed version>`, it sets `flashing = false` and `justUpdated = true`.
  - `onBootloader(portName: string)`: sets `inBootloader = true`, `portName`, and `model` from `firmwareModelByPort[portName] ?? null`.
  - `flash(): Promise<void>`: needs `portName` and `model`. If `model` is null, it sets `error` to the exact unknown-model copy and returns. Otherwise it sets `flashing`, `percent`, and `error = null`, then invokes `firmware_flash`. If the call fails, it puts the error string in `error`. If it succeeds, it waits up to 10 s for `onDeviceInfo` to report the bundled version; otherwise it sets `error` to "Decker didn't come back after the update. Unplug it and plug it back in." It always clears `flashing` at the end.
- `decker.ts`: in `initClass`, also `listen('device-info', …)` (it parses `event.payload.message` like line 282), and call `useFirmwareStore().onDeviceInfo(this.comPort, info)`. Listen for `device-in-bootloader`, then `onBootloader(event.payload.message)`. In `detectDeviceChanges`, return early while `useFirmwareStore().flashing`.

- [ ] **Step 1: Implement the store and listeners.** There's no frontend test runner in this repo. Typing is the check.
- [ ] **Step 2: Run `yarn build`.** Expected: vue-tsc passes and the build succeeds.
- [ ] **Step 3: Check with the emulator.** Run it with `--firmware 0.0.2 --model VM-5SW`, then run `useFirmwareStore().available` in the WebView console (CDP, see memory `dotx-gui-testing-on-windows`). Expected: `"0.0.3"`. With `--firmware 0.0.0-emulator`, expected: `null`.
- [ ] **Step 4: Commit.** `git commit -m "feat(device): track bundled firmware against the connected decker"`

---

### Task 7: Red dots and the Firmware row

**Files:**
- Modify: `src/components/TopBar.vue` (gear button, line 23), `src/SettingsModal/SettingsModal.vue` (tab buttons, lines 67-76, `Device` only), `src/SettingsModal/Device.vue` (Device Info block, lines 66-77)

**Interfaces:**
- Consumes: `useFirmwareStore()` (Task 6).

Markup to match the approved mockups:
- Gear: add `relative` to the button, plus `<span v-if="firmware.needsAttention" class="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-red-500"></span>`.
- Device tab: `<span v-if="tab === 'Device' && firmware.needsAttention" class="ml-auto w-2 h-2 rounded-full bg-red-500"></span>`.
- Device.vue firmware row (the `firmwareVersion` entry in `deviceInfoPoints`). Render it separately, after the version value:
  - `inBootloader && !flashing`: "Update didn't finish", plus a `btn btn-xs btn-primary` "Retry" button that calls `flash()`.
  - `available && !flashing`: a `btn btn-xs btn-primary` "Update to {available}" button that calls `flash()`.
  - `flashing`: "Updating… {percent}%", plus a full-width `progress progress-primary` and a `text-xs text-warning` line with the warning copy.
  - `justUpdated`: `text-success` "Up to date".
  - `error`: `text-xs text-error` with the error, plus Retry.
- The row must also render when the device is in the bootloader, since `deviceInfo` is empty then. Show the version as "N/A".

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `yarn build`.** Expected: it passes.
- [ ] **Step 3: Take screenshots.** Use the emulator with `--firmware 0.0.2`. Capture the main view (gear dot) and Settings → Device (tab dot plus button), using the AGENTS.md window-capture script, into `%TEMP%\dotx-pr\`. Compare them against the mockups in `C:\Users\ananords\AppData\Local\Temp\claude\3c5b224cd3d06b31\1144bb3d-88c9-46a7-82b3-f9d5a454afd6\scratchpad\mock\`.
- [ ] **Step 4: Commit.** `git commit -m "feat(device): show firmware updates in settings"`

---

### Task 8: Prompt, automatic flash after a Dot X update, release note

**Files:**
- Create: `src/components/FirmwarePrompt.vue`
- Modify: `src/App.vue` (mount next to `<UpdatePrompt />` at line 5, and register the component at line 50), `src/store/firmwareStore.ts`, `.github/RELEASING.md`

**Interfaces:**
- Consumes: `useFirmwareStore()`, `useUpdateStore().whatsNewOpen`, `ConfigStore`, and `toast` from `vue-sonner`.
- Adds to `firmwareStore`:
  - `autoFlashPending: boolean`. Set once at startup by `initLaunch()`, which App.vue calls in `mounted`. It reads ConfigStore `lastLaunchedVersion`, compares it to `useUpdateStore().currentVersion`, and sets `autoFlashPending = (saved != null && saved !== current && platform() !== 'linux')`. It then writes the current version.
  - In `onDeviceInfo`, when `available` becomes non-null and `autoFlashPending`: clear `autoFlashPending` and call `flash()` with a toast. That's `toast.loading("Updating Decker firmware… {percent}%. Don't unplug Decker.", { id: 'firmware' })`, updated as `percent` changes. It ends with `toast.success("Decker updated to {version}", { id: 'firmware' })` or `toast.error(error, { id: 'firmware' })`. `autoFlashPending` is cleared after the first `device-info` of the launch either way.
  - getter `showPrompt`: `available && !autoFlashPending && !flashing && dismissedVersion !== available && !useUpdateStore().whatsNewOpen`. `dismissedVersion` is loaded from ConfigStore `firmwarePromptDismissed`.
  - `dismissPrompt()`: writes `available` to `firmwarePromptDismissed`.
- `FirmwarePrompt.vue`: a DaisyUI `modal modal-open`, laid out like mockup C. Title "Decker firmware update"; body "Firmware {available} is ready for your Decker (you have {deviceVersion})."; a small line "The update takes about 10 seconds. Sliders pause while it runs."; buttons "Later" (`dismissPrompt`) and "Update now". "Update now" calls `dismissPrompt()` (so the prompt doesn't come back), opens Settings on Device (emit `open-settings`; App.vue sets `settingsModalOpen = true`), and calls `flash()`.
- `RELEASING.md`: a short section, "Firmware". The `.hex` files and `firmware.json` live in `src-tauri/firmware/`. New firmware ships in a beta first, because Dot X flashes it automatically after updating.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `yarn build`.** Expected: it passes.
- [ ] **Step 3: Check with the emulator.** Use `--firmware 0.0.2`. The prompt shows. "Later" closes it, and it stays closed after relaunch; the dot remains. Set `firmwarePromptDismissed` to `0.0.1` and the prompt shows again. Set `lastLaunchedVersion` to an older version and relaunch: the automatic path starts and fails honestly, because the emulator can't reboot. The toast shows the "did not enter update mode" error, and the dot and Retry remain. Back up `%APPDATA%\com.dot-x.dev` to `%TEMP%` before this step, and restore it after.
- [ ] **Step 4: Commit.** `git commit -m "feat(device): offer decker firmware updates on connect and after updating"`

---

### Task 9: Hardware verification

No code changes unless something fails here. If it does, fix it in the owning task's files and commit with that task's scope.

- [ ] **Step 1: Prepare.** Close the installed Dot X: kill only the PID whose path is under `Program Files` or the installer location, confirmed with `Get-Process "Dot X" | Select Id, Path`, and say so. Back up `%APPDATA%\com.dot-x.dev` to `%TEMP%`.
- [ ] **Step 2: Build a test firmware.** Copy `decker-0.0.3.hex` to a scratch `firmware.json` entry with version `0.0.4`, in the dev `src-tauri/firmware/` only. Don't commit it. The device (0.0.3) now sees an update to the same code, which proves the flash path without changing firmware behaviour.
- [ ] **Step 3: Run the real Decker on Windows.** Click Update. Expected: progress runs to 100%, sliders come back, and the device reports... the same 0.0.3, because the image says 0.0.3. So also expect the "didn't come back" error at 10 s. That's correct behaviour for a mislabelled image and proves the confirm step. Then set the scratch entry back to the real version and confirm no dot shows.
- [ ] **Step 4: Interrupt a flash.** Unplug the Decker at around 40% and plug it back in. Expected: "Update didn't finish" plus Retry and the red dots. Retry completes the flash and the device works.
- [ ] **Step 5: Run Linux** on the test device (memory `linux-test-device-decker`, `/dev/ttyACM0`): Update completes, including when the port name changes across the reboot.
- [ ] **Step 6: Run Decker Lite**, if a unit is available. Otherwise say so in the PR as untested.
- [ ] **Step 7: Restore.** Remove the scratch `firmware.json` change, restore the app data backup if anything changed, and restart the installed Dot X.
- [ ] **Step 8: Run the final checks.** `cargo test --locked` and `yarn build` must both pass.
