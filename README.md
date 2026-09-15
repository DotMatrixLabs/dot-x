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

Dot X reports to two Frogbyte-operated services. Both are enabled by default and there
is currently no in-app opt-out — see
[#229](https://github.com/Frogbyte-io/dot-x/issues/229).

**Crash reports, via [Sentry](https://sentry.io/)** self-hosted at
`sentry-ingest.frogbyte.io`. Sent only when the app panics or crashes: the panic
message, a Rust stack trace, the app version, and a minidump.

The minidump is the one item here that is not a fixed, enumerable set of fields, and it
deserves to be described honestly. It is a snapshot of the crashed process's memory. By
format it always contains the filesystem paths of every loaded module — on a per-user
install those sit under `C:\Users\<account>\`, so they carry the OS account name — and
`MiniDumpNormal` captures the stack memory of every thread. That stack memory can
incidentally hold whatever strings the process had in flight: audio session names,
running application names, channel labels, or plugin payloads in transit through
`plugin_server.rs`, which can include credentials a user typed into a plugin's settings.
None of it is deliberately collected and it is used only to diagnose the crash, but the
payload is unscrubbed and cannot be listed exhaustively in advance.

To keep crash reporting without the minidump, disable the plugin's default features in
`src-tauri/Cargo.toml`:

```toml
tauri-plugin-sentry = { version = "0.5", default-features = false }
```

The panic message and stack trace still arrive; only the memory snapshot goes away.

**Usage analytics, via [Aptabase](https://aptabase.com/)**. The app key is an `A-EU-`
key, so events are ingested at `eu.aptabase.com` and stay in the EU data region. Six
events, each carrying nothing beyond the properties listed:

| Event | When | Properties |
| --- | --- | --- |
| `app_started` | app launch | `slider_amount` |
| `app_heartbeat` | every 59 minutes while running | none |
| `app_exited` | app shutdown | none |
| `decker_connected` | a Decker is found on a serial port | none |
| `midi_toggled` | MIDI is switched on or off in settings | `enabled` |
| `midi_attached` | a MIDI output port is opened | none |

`slider_amount` is currently the hardcoded string `"5"` rather than the real channel
count, so treat it as meaningless.

The Aptabase SDK attaches the same system properties to every event: OS name and
version, system locale, webview engine and version, app version, a debug flag, and a
session id. The session id is random, held in memory, regenerated on every launch and
never written to disk, so it is not derived from anything about the machine and cannot
recognise a returning user. Aptabase receives no account details, no persistent device
identifier, no file paths, no running application names, and no channel configuration.

The heartbeat fires at 59 minutes rather than 60 so it does not land on the analytics
session boundary and inflate the session count.

To build without either service, drop the `tauri_plugin_aptabase` and
`tauri_plugin_sentry` registrations in `src-tauri/src/main.rs`. The formal policy is in
[`src-tauri/licenses/privacy_policy.txt`](src-tauri/licenses/privacy_policy.txt).

## Contributing

1. Create a feature branch
2. Make your changes
3. Test with actual hardware
4. Submit for internal review

