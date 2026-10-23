# Dot X

[![Version](https://img.shields.io/badge/version-2.0.0--1-blue.svg)](src-tauri/tauri.conf.json)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](#installation)
[![License](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)

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
- [Rust](https://rustup.rs/) (stable; the repo pins the toolchain in `rust-toolchain.toml`)
- Windows 10/11

Install the license-report CLI before running `yarn build` or `yarn tauri build`:

```bash
cargo install cargo-license --version 0.7.0 --locked
```

`cargo-license` runs during license-report generation; it is not an app dependency.

Dot X runs plugins on a bundled Deno runtime. The 44 MB archive is not committed;
`yarn tauri dev` and `yarn tauri build` download it into `src-tauri/resources/deno/`
before building. Run `yarn fetch-deno` yourself before any bare `cargo` command,
which does not go through those hooks.

### Setup

```bash
# Clone the repository
git clone https://github.com/Frogbyte-io/dot-x.git
cd dot-x

# Create your local env file
cp .env.example .env

# Install dependencies
yarn install
```

#### Environment variables

Copy `.env.example` to `.env` and fill in what you need. A fresh contributor
build works with everything left empty: the app skips Sentry and Aptabase
initialisation and marketplace statistics when their variables are unset, so
nothing crashes — the features are just quieter.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DOTX_SENTRY_DSN` | Rust backend | DSN for the self-hosted Sentry crash reporter |
| `DOTX_APTABASE_KEY` | Rust backend | App key for Aptabase usage analytics |
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL for marketplace statistics |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon key for marketplace statistics |
| `VITE_STATS_SECRET_KEY` | Frontend | Key for hashing the local slider-distance stat |
| `VITE_MARKETPLACE_REGISTRY_URL` | Frontend | Plugin marketplace registry index (has a default) |

`.env` is gitignored; never commit it. Forks can set their own values.

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
yarn fetch-deno                 # bundled Deno runtime, needed by the Rust build
(cd src-tauri && cargo test)    # Rust unit tests (Windows only)
```

### Build Notes

- Initial build takes time (Rust compilation + package downloads)
- The Rust toolchain is pinned to stable via `rust-toolchain.toml`; rustup picks it up automatically

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to open issues and pull
requests, and [SECURITY.md](SECURITY.md) for reporting security problems
privately.

