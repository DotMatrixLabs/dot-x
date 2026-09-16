# Dot X

[![Version](https://img.shields.io/badge/version-2.0.0--1-blue.svg)](src-tauri/tauri.conf.json)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/your-repo/dot-x)
[![License](https://img.shields.io/badge/license-Private-red.svg)](https://github.com/your-repo/dot-x)

Desktop interface for DotMatrixLabs Decker physical volume mixer built with Tauri (Rust + Vue.js).

## Features

- 🎛️ **Per-app volume control** through physical sliders
- 🌈 **Control Decker RGB lights**
- 🎵 **MIDI control** through physical sliders
- 💡 **Screen brightness adjustment**
- 🔔 **System tray operation** with auto-start
- ⬆️ **Automatic updates**

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ and [Yarn](https://yarnpkg.com/)
- [Rust](https://rustup.rs/) 1.90.0
- Windows 10/11

Install the license-report CLI before running `yarn build` or `yarn tauri build`:

```bash
cargo install cargo-license --version 0.7.0 --locked
```

`cargo-license` runs during license-report generation; it is not an app dependency.

### Setup

```bash
# Clone the repository
git clone https://github.com/your-repo/dot-x.git
cd dot-x

# Install dependencies
yarn install
cd src-tauri
cargo

# Start development server
yarn tauri dev
```

## Usage

### Development

```bash
yarn tauri dev      # Start development server
yarn tauri build          # Build for production
yarn licenses       # Generate license reports
```

## Tech Stack

- **Frontend:** Vue 3, TypeScript, Tailwind CSS, DaisyUI, Pinia
- **Backend:** Rust, Tauri, Serial Port, MIDI, Windows Volume Control
- **Build Tools:** Vite, PostCSS, Cargo

## Project Structure

```
src/
├── components/           # Vue components
├── ts/
│   ├── decker.ts        # Hardware communication
│   ├── volumeControl.ts # Audio session control
│   └── config.ts        # Configuration management
└── App.vue              # Main application

src-tauri/
├── src/
│   ├── main.rs          # Rust backend entry point
│   ├── decker.rs        # Device interface
│   └── midi.rs          # MIDI functionality
└── Cargo.toml           # Rust dependencies
```

## Development

### IDE Setup

Recommended VS Code extensions:
- [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Checks

CI runs these on every pull request against `main` and `v2`; run them locally
before pushing:

```bash
yarn typecheck                  # vue-tsc, no emit
yarn build:web                  # vite build, no license generation
(cd plugin-sdk && yarn build)   # SDK build + regenerated plugin types
(cd src-tauri && cargo test)    # Rust unit tests (Windows only)
```

### Build Notes

- Initial build takes time (Rust compilation + package downloads)
- Requires exact Rust version 1.75.0: `rustup install 1.75.0 && rustup override set 1.75.0`

## Telemetry

Dot X reports to two services that Frogbyte runs. Both are on by default. Neither has an
in-app off switch yet, which [#229](https://github.com/Frogbyte-io/dot-x/issues/229)
tracks.

Crash reports go to a self-hosted [Sentry](https://sentry.io/) at
`sentry-ingest.frogbyte.io`. Dot X sends one only when it panics or crashes, and each
report holds the panic message, a Rust stack trace, and the app version.

Crash reports carry no minidump. A minidump is a copy of the memory of the crashed
process, and `tauri-plugin-sentry` attaches one by default. This repo turns that default
off with `default-features = false` in `src-tauri/Cargo.toml`. A minidump always lists
the file path of every loaded module, which on a per-user install holds the Windows
account name, and it copies the stack of every thread. A thread stack can hold any
string the process had open at that moment, such as an audio session name, an
application name, a channel label, or a plugin payload moving through
`plugin_server::send_to_plugin`. That last one can hold a credential a user typed into a
plugin's settings. Nobody can list those contents ahead of time, so Dot X does not send
them. The panic message and the stack trace explain most Rust panics without a minidump.
The cost is that a native crash inside a C or C++ dependency now produces no Sentry
event.

Usage analytics go to [Aptabase](https://aptabase.com/). The app key starts with
`A-EU-`, and `config.rs` maps that prefix to `eu.aptabase.com`, so the events stay in
the EU data region. Dot X sends six events, and each one carries only the properties in
this table.

| Event | When | Properties |
| --- | --- | --- |
| `app_started` | app launch | `slider_amount` |
| `app_heartbeat` | every 59 minutes while running | none |
| `app_exited` | app shutdown | none |
| `decker_connected` | a Decker is found on a serial port | none |
| `midi_toggled` | MIDI is switched on or off in settings | `enabled` |
| `midi_attached` | a MIDI output port is opened | none |

Read `slider_amount` as meaningless. It is the hardcoded string `"5"` rather than the
real channel count.

The Aptabase SDK adds the same system properties to every event. Those are the OS name
and version, the system locale, the webview engine and version, the app version, a debug
flag, and a session id. Dot X generates the session id at random in memory on each
launch and never writes it to disk, so it cannot recognise a returning user. Aptabase
receives no account details, no lasting device identifier, no file path, no application
name, and no channel configuration.

The heartbeat fires at 59 minutes rather than 60 so that it does not coincide with the
analytics session boundary and inflate the session count.

To build Dot X with no telemetry, delete the `tauri_plugin_aptabase` and
`tauri_plugin_sentry` registrations in `src-tauri/src/main.rs`. The formal policy is in
[`src-tauri/licenses/privacy_policy.txt`](src-tauri/licenses/privacy_policy.txt).

## Contributing

1. Create a feature branch
2. Make your changes
3. Test with actual hardware
4. Submit for internal review

