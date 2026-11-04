import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DeckerEmulator,
  MsgpackStreamDecoder,
  deviceInfoFrame,
  encodeMsgpack,
  sliderFrame,
} from "./decker-emulator.mjs";

const key = (s) => [0xa0 | s.length, ...Buffer.from(s)];

test("slider frame matches the firmware's ArduinoJson encoding", () => {
  // serializeMsgPack({slider1..5}) + Serial.println() in decker-firmware/src/sliders.cpp:
  // fixmap(5), fixstr keys, smallest unsigned int per value, then "\r\n".
  const expected = Buffer.from([
    0x85,
    ...key("slider1"), 0x00,
    ...key("slider2"), 0x7f,
    ...key("slider3"), 0xcc, 0x80,
    ...key("slider4"), 0xcd, 0x02, 0x00,
    ...key("slider5"), 0xcd, 0x03, 0xff,
    0x0d, 0x0a,
  ]);
  assert.deepEqual(sliderFrame([0, 127, 128, 512, 1023]), expected);
});

// Frames captured from a real Decker (firmware 0.0.3); same bytes as the
// SLIDER_FRAME / DEVICE_FRAME fixtures in src-tauri/src/decker.rs tests.
const REAL_SLIDER_FRAME = Buffer.from("\x85\xa7slider1\xcd\x02\x96\xa7slider2\x00\xa7slider3\x00\xa7slider4\x01\xa7slider5\x31\r\n", "latin1");
const REAL_DEVICE_FRAME = Buffer.from("\x83\xacserialNumber\xa4test\xabdeviceModel\xa8VM-5SW-L\xaffirmwareVersion\xa50.0.3\r\n", "latin1");

test("frames are byte-identical to a real Decker's", () => {
  assert.deepEqual(sliderFrame([0x296, 0, 0, 1, 0x31]), REAL_SLIDER_FRAME);
  assert.deepEqual(deviceInfoFrame({ serialNumber: "test", deviceModel: "VM-5SW-L", firmwareVersion: "0.0.3" }), REAL_DEVICE_FRAME);
});

test("slider values are clamped to the 10-bit ADC range", () => {
  const [value] = new MsgpackStreamDecoder().push(sliderFrame([-5, 2000, 1.6, 0, 0]).subarray(0, -2));
  assert.deepEqual(value, { slider1: 0, slider2: 1023, slider3: 2, slider4: 0, slider5: 0 });
});

test("device info frame uses the firmware's camelCase keys", () => {
  const frame = deviceInfoFrame({ serialNumber: "A1-B1234-0001", deviceModel: "VM-5SW", firmwareVersion: "1.0.0" });
  assert.deepEqual(frame.subarray(-2), Buffer.from("\r\n"));
  assert.deepEqual(new MsgpackStreamDecoder().push(frame.subarray(0, -2)), [
    { serialNumber: "A1-B1234-0001", deviceModel: "VM-5SW", firmwareVersion: "1.0.0" },
  ]);
});

test("command stream decodes split, batched and garbled input", () => {
  // decker.rs writes msgpack(serde_json Value) with no terminator, back to back.
  const a = encodeMsgpack({ command: "get-device-info", options: null });
  const b = encodeMsgpack({ command: "rgb-control", options: { brightness: 128, color: "#ff8800", effect: "static", speed: 1.5 } });
  const d = new MsgpackStreamDecoder();
  assert.deepEqual(d.push(a.subarray(0, 5)), []);
  assert.deepEqual(d.push(Buffer.concat([a.subarray(5), Buffer.from([0xc1]), b])), [
    { command: "get-device-info", options: null },
    { command: "rgb-control", options: { brightness: 128, color: "#ff8800", effect: "static", speed: 1.5 } },
  ]);
});

test("emulator answers get-device-info and records commands", () => {
  const written = [];
  const log = [];
  const emu = new DeckerEmulator({ write: (b) => written.push(b), log: (...e) => log.push(e) });

  emu.receive(encodeMsgpack({ command: "set-device-info", options: { serialNumber: "S-1", deviceModel: "M-1" } }));
  emu.receive(encodeMsgpack({ command: "get-device-info", options: null }));
  emu.receive(encodeMsgpack({ command: "rgb-control", options: { brightness: 0 } }));

  assert.equal(written.length, 1);
  assert.deepEqual(new MsgpackStreamDecoder().push(written[0].subarray(0, -2))[0], {
    serialNumber: "S-1",
    deviceModel: "M-1",
    firmwareVersion: "0.0.0-emulator",
  });
  assert.deepEqual(emu.rgb, { brightness: 0 });
  assert.deepEqual(log.map(([dir, kind]) => `${dir} ${kind}`), [
    "rx set-device-info",
    "rx get-device-info",
    "tx device-info",
    "rx rgb-control",
  ]);
});

test("setSlider moves one 1-based channel and sends a full frame", () => {
  const written = [];
  const emu = new DeckerEmulator({ write: (b) => written.push(b), sliders: [1, 2, 3, 4, 5] });
  emu.setSlider(3, 900);
  assert.deepEqual(new MsgpackStreamDecoder().push(written[0].subarray(0, -2))[0], {
    slider1: 1, slider2: 2, slider3: 900, slider4: 4, slider5: 5,
  });
});
