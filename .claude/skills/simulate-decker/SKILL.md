---
name: simulate-decker
description: Simulate a Decker hardware mixer over a virtual serial port (PTY pair) so device flows can be tested without physical hardware. Use when testing slider/volume/brightness/MIDI paths, decker.rs changes, or any flow that needs a connected device and no real Decker is available.
---

# Simulating a Decker

The Decker sends msgpack-encoded frames over serial. You can stand in for the firmware with a PTY pair.

## 1. Create the virtual port pair

```sh
socat -d -d pty,raw,echo=0 pty,raw,echo=0 2>&1 | grep -o '/dev/pts/[0-9]*'
```

This prints two PTYs: give one to the app, keep the other as the "firmware" side you write to. Keep the `socat` process running for the whole session.

## 2. Point the app at it

Launch with `DOTX_EXTRA_SERIAL_PORTS=/dev/pts/<app-side>` (comma-separated for multiple). This makes the PTY appear in `get_devices` (Linux only — see `src-tauri/src/decker.rs`). Then either connect through the Settings UI, invoke `connect_decker` via the tauri MCP bridge with `{ "portName": "/dev/pts/<app-side>", "inverted": false }`, or set `comPort` in the app's persisted `config.json` (the same file the Settings UI writes) before launch.

Note: PTYs don't support DTR; the app logs a warning and proceeds (a hard failure here was a real bug, fixed 2026-07-02 — don't reintroduce it).

## 3. Send slider frames

Each frame is one self-contained msgpack map — no length prefix or delimiter; the reader treats each `port.read()` chunk as one message, so write one whole frame per write. Slider values are `u32` in `0..=1023` under keys `slider1..slider5` (see `SliderData` in `src-tauri/src/decker.rs`). Example with Python:

```python
import msgpack, sys, time
port = open(sys.argv[1], "wb", buffering=0)
for v in (0, 512, 1023):
    port.write(msgpack.packb({f"slider{i}": v for i in range(1, 6)}))
    time.sleep(0.2)
```

(`pip install msgpack` if missing; a tiny Rust script with `rmp-serde` works too.)

The device-info frame (`firmwareVersion`, `deviceModel`, `serialNumber` — camelCase keys) uses the same encoding if you need to emulate the identification handshake.

## 4. Verify the round trip

Watch the effect end-to-end: backend logs the parsed values and emits `slider-change` to the frontend; use `mcp__tauri__ipc_monitor`/`ipc_get_captured` to confirm the event, and check the mapped output (volume via `pactl`/mixer, brightness via `ddcutil getvcp 10`, MIDI via a monitor client). A precedent for a full simulated verification (including known pitfalls) is written up in `LINUX-SUPPORT.md` under the DDC/CI brightness entry.

Remember: a simulated pass is not a hardware pass — say which one you did.
