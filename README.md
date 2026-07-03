# Dot X

[![Version](https://img.shields.io/badge/version-1.2.3--1-blue.svg)](https://github.com/your-repo/dot-x)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/your-repo/dot-x)
[![License](https://img.shields.io/badge/license-Private-red.svg)](https://github.com/your-repo/dot-x)

Desktop interface for DotMatrixLabs Decker physical volume mixer built with Tauri (Rust + Vue.js).

## Features

- 🎛️ **Per-app volume control** through physical sliders
- 🌈 **Control Decker RGB lights**
- 🎵 **MIDI control** through physical sliders
- 💡 **Screen brightness adjustment**
- 🔔 **System tray operation** with auto-start
- ⬆️ **Automatic updates** with distribution through Anystack.sh

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 22+ and [Yarn](https://yarnpkg.com/)
- [Rust](https://rustup.rs/) 1.90.0
- Windows 10/11

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

### Build Notes

- Initial build takes time (Rust compilation + package downloads)
- Requires exact Rust version 1.75.0: `rustup install 1.75.0 && rustup override set 1.75.0`

### Windows installer & auto-updates

The Windows build produces an NSIS installer with `installMode: currentUser`
(see `src-tauri/tauri.conf.json`). It installs to `%LOCALAPPDATA%\Dot X` and
registers under `HKCU`, so **installing and auto-updating never require admin
rights**.

- The MSI (WiX) target is intentionally not built. MSI installs are always
  per-machine in Tauri, which is why v1.x updates required admin. Don't re-add
  `msi` to `bundle.targets` unless per-machine installs are wanted again.
- `installMode: "both"` (a per-user/per-machine choice dialog) was considered
  and rejected: Tauri implements it with `MULTIUSER_EXECUTIONLEVEL Highest`,
  which triggers a UAC prompt for admin users even for per-user installs and
  on every auto-update.
- **Migration from v1.x:** the Tauri NSIS installer detects an existing
  per-machine MSI install (matching `DisplayName` "Dot X" + `Publisher`
  "dot-x" under `HKLM\...\Uninstall`) and uninstalls it before installing
  per-user. That one-time uninstall shows a single UAC prompt; afterwards
  updates run without elevation. For v1.x clients to auto-update into v2, the
  `-setup.nsis.zip` updater artifact (produced via
  `createUpdaterArtifacts: v1Compatible`) must be published on Anystack.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test with actual hardware
4. Submit for internal review

