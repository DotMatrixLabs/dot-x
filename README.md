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
message, a Rust stack trace, a minidump, and the app version. Channel configuration,
labels, and plugin settings are not attached.

**Usage analytics, via [Aptabase](https://aptabase.com/)**. Six events, each carrying
nothing beyond the properties listed:

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
session id. The session id is random and regenerated each run, so it is not derived
from anything about the machine and cannot be used to link one session to another. No
account details, file paths, running application names, or channel configuration are
sent.

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

