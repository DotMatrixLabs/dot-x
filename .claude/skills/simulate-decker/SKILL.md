---
name: simulate-decker
description: Simulate a Decker hardware mixer over a virtual serial port with the checked-in emulator, so device flows can be tested without physical hardware. Use when testing slider/volume/brightness/MIDI/RGB paths, decker.rs changes, or any flow that needs a connected device and no real Decker is available.
---

# Simulating a Decker

`tools/decker-emulator.mjs` stands in for the firmware: it sends slider and device-info frames the way a real Decker does (byte-identical, see its tests) and logs every command the app sends back. You give it one end of a virtual serial port pair and the app the other.

## 1. Start the emulator

**Linux:** let it create the PTY pair (uses `socat`, falls back to `python3`):

```sh
yarn emulate-decker --pty
# app port: /dev/pts/7   <- give this one to the app
```

**Windows:** install [com0com](https://sourceforge.net/projects/com0com/) (signed 3.0.0.0 build; admin) and create a pair, e.g. `setupc install PortName=COM20 PortName=COM21`. Give the app one end and the emulator the other:

```powershell
yarn emulate-decker --port COM21
```

Options: `--sliders 0,512,1023,0,0` (start values), `--serial`, `--model`, `--firmware` (device-info answers).

## 2. Point the app at it

Launch with `DOTX_EXTRA_SERIAL_PORTS=<app port>` (comma-separated for multiple; works on every platform). The port then shows up in Settings > Device. Either pick it there, invoke `connect_decker` with `{ "portName": "<app port>", "inverted": false }`, or set `comPort` in the app's persisted `config.json` before launch.

PTYs don't support DTR; the app logs a warning and proceeds (a hard failure here was a real bug, fixed 2026-07-02, don't reintroduce it).

## 3. Drive it

Type commands on the emulator's stdin, or pipe a script into it (it exits when the script ends):

```
set 1 512            move slider 1 (channels are 1-5, values 0-1023)
set 0 256 512 768 1023
sweep 3 0 1023 2000  move slider 3 over 2 s in firmware-sized steps
info                 send the device-info frame unprompted
state                print sliders, device info and the last rgb-control
wait 500             pause (for scripts)
quit
```

Like the firmware, it resends the current values every second even when nothing moves.

## 4. Verify the round trip

The emulator's stdout is the device side of the conversation, one line per message:

```
tx sliders {"values":[512,0,0,0,0]}
rx get-device-info {}
tx device-info {"serialNumber":"EMU-00000-0001","deviceModel":"VM-5SW","firmwareVersion":"0.0.0-emulator"}
rx rgb-control {"brightness":128}
```

`tx` is what the app received, `rx` is what the app sent; assert on these for the outbound path (RGB, brightness, device info). For the inbound path, check the app: the backend emits `slider-change` to the frontend (use `mcp__tauri__ipc_monitor`/`ipc_get_captured`), then the mapped output (volume via the mixer or `pactl`, brightness via `ddcutil getvcp 10`, MIDI via a monitor client). A precedent for a full simulated verification (including known pitfalls) is in `LINUX-SUPPORT.md` under the DDC/CI brightness entry.

## Protocol reference

- Device to app: msgpack maps, each followed by `\r\n`. Sliders `{slider1..slider5}` (0-1023) on change and every second; device info `{serialNumber, deviceModel, firmwareVersion}` on `get-device-info`.
- App to device: msgpack `{command, options}`, no terminator: `get-device-info`, `set-device-info {serialNumber, deviceModel}`, `rgb-control {effect, color, brightness, speed}`.
- Sources: `decker-firmware/src/sliders.cpp`, `src-tauri/src/decker.rs`.

Remember: a simulated pass is not a hardware pass. Say which one you did.
