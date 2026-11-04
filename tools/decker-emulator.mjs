#!/usr/bin/env node
// Decker emulator: stands in for the device firmware on a serial port so Dot X
// can be tested without hardware. See .claude/skills/simulate-decker/SKILL.md.
//
// Wire protocol (decker-firmware/src/sliders.cpp, src-tauri/src/decker.rs):
// - Device -> app: msgpack maps, each followed by "\r\n".
//   Sliders {slider1..slider5: 0..1023}, sent on change and every second.
//   Device info {serialNumber, deviceModel, firmwareVersion}, sent on request.
// - App -> device: msgpack {command, options}, no terminator. Commands:
//   get-device-info, set-device-info {serialNumber, deviceModel},
//   rgb-control {effect, color, brightness, speed, ...}.
//
// Usage:
//   node tools/decker-emulator.mjs --pty            (Linux: creates a PTY pair via socat)
//   node tools/decker-emulator.mjs --port COM21     (Windows: device side of a com0com pair)
//   node tools/decker-emulator.mjs --port /dev/pts/7
// Then type commands on stdin (or pipe them in); `help` lists them.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const NUM_SLIDERS = 5;
export const MAX_VALUE = 1023;
const FRAME_END = Buffer.from("\r\n");
const IDLE_INTERVAL_MS = 1000;

// --- minimal msgpack ---------------------------------------------------------

function encodeValue(value, out) {
  if (value === null || value === undefined) return out.push(Buffer.from([0xc0]));
  if (value === true || value === false) return out.push(Buffer.from([value ? 0xc3 : 0xc2]));
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      const b = Buffer.alloc(9);
      b[0] = 0xcb;
      b.writeDoubleBE(value, 1);
      return out.push(b);
    }
    if (value >= 0) {
      if (value < 0x80) return out.push(Buffer.from([value]));
      if (value <= 0xff) return out.push(Buffer.from([0xcc, value]));
      if (value <= 0xffff) { const b = Buffer.alloc(3); b[0] = 0xcd; b.writeUInt16BE(value, 1); return out.push(b); }
      const b = Buffer.alloc(5); b[0] = 0xce; b.writeUInt32BE(value, 1); return out.push(b);
    }
    if (value >= -32) return out.push(Buffer.from([value & 0xff]));
    if (value >= -128) { const b = Buffer.alloc(2); b[0] = 0xd0; b.writeInt8(value, 1); return out.push(b); }
    if (value >= -32768) { const b = Buffer.alloc(3); b[0] = 0xd1; b.writeInt16BE(value, 1); return out.push(b); }
    const b = Buffer.alloc(5); b[0] = 0xd2; b.writeInt32BE(value, 1); return out.push(b);
  }
  if (typeof value === "string") {
    const s = Buffer.from(value, "utf8");
    let head;
    if (s.length < 32) head = Buffer.from([0xa0 | s.length]);
    else if (s.length <= 0xff) head = Buffer.from([0xd9, s.length]);
    else { head = Buffer.alloc(3); head[0] = 0xda; head.writeUInt16BE(s.length, 1); }
    return out.push(head, s);
  }
  if (Array.isArray(value)) {
    out.push(value.length < 16 ? Buffer.from([0x90 | value.length]) : Buffer.from([0xdc, value.length >> 8, value.length & 0xff]));
    for (const v of value) encodeValue(v, out);
    return;
  }
  const entries = Object.entries(value);
  out.push(entries.length < 16 ? Buffer.from([0x80 | entries.length]) : Buffer.from([0xde, entries.length >> 8, entries.length & 0xff]));
  for (const [k, v] of entries) {
    encodeValue(k, out);
    encodeValue(v, out);
  }
}

export function encodeMsgpack(value) {
  const out = [];
  encodeValue(value, out);
  return Buffer.concat(out);
}

class Incomplete extends Error {}

function decodeAt(buf, pos) {
  const need = (n) => { if (pos + n > buf.length) throw new Incomplete(); };
  need(1);
  const t = buf[pos++];
  const str = (len) => { need(len); const s = buf.toString("utf8", pos, pos + len); pos += len; return s; };
  const arr = (len) => { const a = []; for (let i = 0; i < len; i++) { const r = decodeAt(buf, pos); a.push(r.value); pos = r.pos; } return a; };
  const map = (len) => {
    const o = {};
    for (let i = 0; i < len; i++) {
      const k = decodeAt(buf, pos); pos = k.pos;
      const v = decodeAt(buf, pos); pos = v.pos;
      o[k.value] = v.value;
    }
    return o;
  };
  const num = (n, read) => { need(n); const v = read(pos); pos += n; return v; };
  let value;
  if (t < 0x80) value = t;
  else if (t >= 0xe0) value = t - 0x100;
  else if ((t & 0xf0) === 0x80) value = map(t & 0x0f);
  else if ((t & 0xf0) === 0x90) value = arr(t & 0x0f);
  else if ((t & 0xe0) === 0xa0) value = str(t & 0x1f);
  else switch (t) {
    case 0xc0: value = null; break;
    case 0xc2: value = false; break;
    case 0xc3: value = true; break;
    case 0xca: value = num(4, (p) => buf.readFloatBE(p)); break;
    case 0xcb: value = num(8, (p) => buf.readDoubleBE(p)); break;
    case 0xcc: value = num(1, (p) => buf.readUInt8(p)); break;
    case 0xcd: value = num(2, (p) => buf.readUInt16BE(p)); break;
    case 0xce: value = num(4, (p) => buf.readUInt32BE(p)); break;
    case 0xcf: value = num(8, (p) => Number(buf.readBigUInt64BE(p))); break;
    case 0xd0: value = num(1, (p) => buf.readInt8(p)); break;
    case 0xd1: value = num(2, (p) => buf.readInt16BE(p)); break;
    case 0xd2: value = num(4, (p) => buf.readInt32BE(p)); break;
    case 0xd3: value = num(8, (p) => Number(buf.readBigInt64BE(p))); break;
    case 0xd9: value = str(num(1, (p) => buf.readUInt8(p))); break;
    case 0xda: value = str(num(2, (p) => buf.readUInt16BE(p))); break;
    case 0xdb: value = str(num(4, (p) => buf.readUInt32BE(p))); break;
    case 0xdc: value = arr(num(2, (p) => buf.readUInt16BE(p))); break;
    case 0xdd: value = arr(num(4, (p) => buf.readUInt32BE(p))); break;
    case 0xde: value = map(num(2, (p) => buf.readUInt16BE(p))); break;
    case 0xdf: value = map(num(4, (p) => buf.readUInt32BE(p))); break;
    default: throw new Error(`unsupported msgpack type 0x${t.toString(16)}`);
  }
  return { value, pos };
}

/**
 * Decodes back-to-back msgpack values from a byte stream (the app's commands
 * have no terminator). Keeps an unfinished tail between chunks and skips a
 * byte at a time past anything it cannot decode.
 */
export class MsgpackStreamDecoder {
  #pending = Buffer.alloc(0);

  push(chunk) {
    this.#pending = Buffer.concat([this.#pending, chunk]);
    const values = [];
    while (this.#pending.length > 0) {
      try {
        const { value, pos } = decodeAt(this.#pending, 0);
        values.push(value);
        this.#pending = this.#pending.subarray(pos);
      } catch (error) {
        if (error instanceof Incomplete) break;
        this.#pending = this.#pending.subarray(1);
      }
    }
    return values;
  }
}

// --- device model ------------------------------------------------------------

export const clampSlider = (v) => Math.max(0, Math.min(MAX_VALUE, Math.round(Number(v) || 0)));

/** The device's frames, as written to the wire. */
export function sliderFrame(values) {
  const map = {};
  values.forEach((v, i) => { map[`slider${i + 1}`] = clampSlider(v); });
  return Buffer.concat([encodeMsgpack(map), FRAME_END]);
}

export function deviceInfoFrame(info) {
  return Buffer.concat([
    encodeMsgpack({ serialNumber: info.serialNumber, deviceModel: info.deviceModel, firmwareVersion: info.firmwareVersion }),
    FRAME_END,
  ]);
}

/**
 * Firmware behaviour without the hardware: holds slider values and device
 * info, answers commands, and reports what it sends and receives via `log`.
 * Transport-agnostic: `write` takes a Buffer.
 */
export class DeckerEmulator {
  constructor({ write, log = () => {}, info = {}, sliders } = {}) {
    this.write = write;
    this.log = log;
    this.sliders = (sliders ?? Array(NUM_SLIDERS).fill(0)).map(clampSlider);
    this.info = { serialNumber: "EMU-00000-0001", deviceModel: "VM-5SW", firmwareVersion: "0.0.0-emulator", ...info };
    this.rgb = null;
    this.decoder = new MsgpackStreamDecoder();
  }

  sendSliders() {
    this.write(sliderFrame(this.sliders));
    this.log("tx", "sliders", { values: this.sliders });
  }

  sendDeviceInfo() {
    this.write(deviceInfoFrame(this.info));
    this.log("tx", "device-info", this.info);
  }

  /** Set one slider (1-based) or all five; sends a frame like a moved fader. */
  setSliders(next) {
    this.sliders = next.map(clampSlider);
    this.sendSliders();
  }

  setSlider(channel, value) {
    const next = [...this.sliders];
    next[channel - 1] = value;
    this.setSliders(next);
  }

  receive(chunk) {
    for (const message of this.decoder.push(chunk)) this.handleCommand(message);
  }

  handleCommand(message) {
    const command = message && typeof message === "object" ? message.command : undefined;
    const options = (message && message.options) || {};
    this.log("rx", String(command ?? "unknown"), command ? options : message);
    if (command === "get-device-info") this.sendDeviceInfo();
    else if (command === "set-device-info") {
      if (options.serialNumber) this.info.serialNumber = String(options.serialNumber);
      if (options.deviceModel) this.info.deviceModel = String(options.deviceModel);
    } else if (command === "rgb-control") this.rgb = { ...this.rgb, ...options };
  }
}

// --- CLI ---------------------------------------------------------------------

const HELP = `commands (stdin, one per line):
  set <channel 1-5> <0-1023>   move one slider
  set <v1> <v2> <v3> <v4> <v5> set all five
  sweep <channel> [from] [to] [ms]   move a slider step by step (default 0 1023 1000)
  info                         send the device-info frame unprompted
  state                        print sliders, device info and last rgb-control
  wait <ms>                    pause (for piped scripts)
  quit                         close the port and exit`;

function parseArgs(argv) {
  const args = { port: null, pty: false, sliders: null, info: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = argv[++i];
    else if (a === "--pty") args.pty = true;
    else if (a === "--sliders") args.sliders = argv[++i].split(",").map(Number);
    else if (a === "--serial") args.info.serialNumber = argv[++i];
    else if (a === "--model") args.info.deviceModel = argv[++i];
    else if (a === "--firmware") args.info.firmwareVersion = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

// socat stand-in: two raw PTYs whose masters are bridged, like
// `socat pty,raw,echo=0 pty,raw,echo=0`. Prints "PTY is <path>" twice.
const PYTHON_PTY_BRIDGE = `
import os, pty, select, tty
a_master, a_slave = pty.openpty()
b_master, b_slave = pty.openpty()
for fd in (a_slave, b_slave):
    tty.setraw(fd)
print("PTY is " + os.ttyname(a_slave), flush=True)
print("PTY is " + os.ttyname(b_slave), flush=True)
peer = {a_master: b_master, b_master: a_master}
while True:
    for fd in select.select(list(peer), [], [])[0]:
        os.write(peer[fd], os.read(fd, 4096))
`;

function spawnPtyBridge(command, args, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", output === "stdout" ? "pipe" : "ignore", output === "stderr" ? "pipe" : "ignore"] });
    const paths = [];
    child.on("error", reject);
    child[output].on("data", (d) => {
      for (const m of d.toString().matchAll(/PTY is (\S+)/g)) paths.push(m[1]);
      if (paths.length === 2) resolve([paths[0], paths[1], child]);
    });
    child.on("exit", (code) => { if (paths.length < 2) reject(new Error(`${command} exited (${code})`)); });
  });
}

/** Linux/macOS: create a linked PTY pair; returns [devicePath, appPath, process]. */
async function createPtyPair() {
  try {
    return await spawnPtyBridge("socat", ["-d", "-d", "pty,raw,echo=0", "pty,raw,echo=0"], "stderr");
  } catch {
    try {
      return await spawnPtyBridge("python3", ["-u", "-c", PYTHON_PTY_BRIDGE], "stdout");
    } catch (e) {
      throw new Error(`could not create a PTY pair: install socat (or python3), or pass --port (${e.message})`);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.port && !args.pty)) {
    console.log(`usage: node tools/decker-emulator.mjs (--pty | --port <path>) [--sliders a,b,c,d,e] [--serial S] [--model M] [--firmware F]\n\n${HELP}`);
    process.exit(args.help ? 0 : 1);
  }

  let socat = null;
  let portPath = args.port;
  if (args.pty) {
    let appPath;
    [portPath, appPath, socat] = await createPtyPair();
    console.log(`app port: ${appPath}`);
    console.log(`launch Dot X with DOTX_EXTRA_SERIAL_PORTS=${appPath} and pick that port in Settings > Device`);
  }

  const { SerialPort } = await import("serialport");
  const port = new SerialPort({ path: portPath, baudRate: 115200, autoOpen: false });
  await new Promise((resolve, reject) => port.open((e) => (e ? reject(e) : resolve())));
  console.log(`device side open on ${portPath}`);

  const log = (dir, kind, data) => console.log(`${dir} ${kind} ${JSON.stringify(data)}`);
  const emu = new DeckerEmulator({ write: (b) => port.write(b), log, info: args.info, sliders: args.sliders ?? undefined });
  port.on("data", (chunk) => emu.receive(chunk));
  port.on("error", (e) => console.error(`port error: ${e.message}`));

  // Firmware sends the current values every second even when nothing moves.
  const idle = setInterval(() => emu.sendSliders(), IDLE_INTERVAL_MS);

  const shutdown = async () => {
    clearInterval(idle);
    await new Promise((r) => port.close(() => r()));
    socat?.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);

  const run = async (line) => {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    const n = rest.map(Number);
    switch (cmd) {
      case "":
        return;
      case "set":
        if (n.length === 2) emu.setSlider(n[0], n[1]);
        else if (n.length === NUM_SLIDERS) emu.setSliders(n);
        else console.log("set needs <channel> <value> or five values");
        return;
      case "sweep": {
        const [channel, from = 0, to = MAX_VALUE, ms = 1000] = n;
        const steps = Math.max(1, Math.round(ms / 50)); // firmware samples every 50 ms
        for (let i = 0; i <= steps; i++) {
          emu.setSlider(channel, from + ((to - from) * i) / steps);
          await sleep(ms / steps);
        }
        return;
      }
      case "info": return emu.sendDeviceInfo();
      case "state": return console.log(`state ${JSON.stringify({ sliders: emu.sliders, info: emu.info, rgb: emu.rgb })}`);
      case "wait": return sleep(n[0] || 0);
      case "quit": return shutdown();
      case "help": return console.log(HELP);
      default: console.log(`unknown command "${cmd}" (try help)`);
    }
  };

  // Run stdin commands strictly in order so piped scripts behave like typing.
  let queue = Promise.resolve();
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => { queue = queue.then(() => run(line)).catch((e) => console.error(e.message)); });
  rl.on("close", () => { queue.then(() => { if (!process.stdin.isTTY) setTimeout(shutdown, 200); }); });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
