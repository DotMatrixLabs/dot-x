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
#### Migration from the v1.x MSI install

Existing users are on the per-machine MSI (in `Program Files`, registered under
`HKLM`). The Tauri v2 NSIS installer handles the switch automatically: on run it
enumerates `HKLM\...\Uninstall`, finds the entry whose `DisplayName` +
`Publisher` equals `Dot X` + `dot-x` and whose uninstall string is an
`msiexec` call, then runs that MSI uninstaller **before** installing per-user.
This happens on both paths — a manually downloaded `-setup.exe` and an
auto-update — because the installer's `WixMode` check runs ahead of its
`UpdateMode` check.

Things to know about the transition:

- **One unavoidable UAC prompt.** Removing a per-machine `Program Files`
  install requires admin, so the one-time MSI uninstall triggers a single UAC
  prompt. This is inherent to leaving admin-land, not something we can suppress.
  Every update *after* the migration is fully elevation-free.
- **The v1→v2 auto-update surfaces that UAC mid-update.** A v1.x client that
  auto-updates will show the UAC prompt during what otherwise looks like a
  background update. **Declining it is safe:** the MSI uninstall runs on the
  installer's reinstall page, *before* any new files are written, so a declined
  prompt makes the installer `Abort` cleanly — the old MSI stays fully intact,
  nothing new is installed, and the app remains on v1. The updater just reports
  the update as failed and retries on the next check. There is no half-migrated
  or double-installed state from a declined prompt; the only cost is the update
  is deferred until the user accepts. For the smoothest rollout you can still
  announce v2 as a manual download for existing users.
- **Do NOT set `bundle.publisher` in the config.** The match above works only
  because both v1 and v2 derive the manufacturer as `dot-x` from the
  `com.dot-x.dev` identifier (neither sets an explicit publisher). Adding a
  `publisher` field changes the NSIS installer's manufacturer string, the
  `HKLM` match stops firing, the old MSI is *not* removed, and the user ends up
  with two copies installed — exactly the failure mode this migration exists to
  prevent.
- **Publishing:** for v1.x clients to auto-update into v2 at all, the
  `-setup.nsis.zip` updater artifact (produced via
  `createUpdaterArtifacts: v1Compatible`) plus its `.sig` must be published on
  Anystack for the `windows-x86_64` slot.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test with actual hardware
4. Submit for internal review

