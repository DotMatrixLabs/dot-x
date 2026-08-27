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
- **Installer branding** is set via `nsis.headerImage`
  (`src-tauri/icons/NSISInstallerBanner.bmp`, 150x57) and `nsis.sidebarImage`
  (`src-tauri/icons/NSISInstaller.bmp`, 164x314). Both are 24-bit BMPs at exact
  pixel size — NSIS does not scale them, so any redraw must keep those
  dimensions.

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
  Every update *after* a completed migration is fully elevation-free.
- **The v1→v2 auto-update surfaces that UAC mid-update.** A v1.x client that
  auto-updates will show the UAC prompt during what otherwise looks like a
  background update. What happens if the user *declines* depends on how the
  installer was launched, and the two paths differ:
  - **Manual `-setup.exe`:** safe. `msiexec` returns 1602, and `Abort` in the
    reinstall page's leave function keeps the wizard on that page, so nothing
    has been written yet and the user can retry or cancel. v1 stays intact.
  - **Auto-update:** *not* safe. The updater runs the installer passively
    (`/P /R /UPDATE`), and in passive mode the installer calls the reinstall
    page's leave function from inside the page's *creator* function. There,
    NSIS treats `Abort` as "skip this page and carry on" rather than "stay
    put", and the install section has no WiX guard of its own — so a declined
    prompt is expected to install v2 per-user **while leaving the v1 MSI in
    place**: two entries in Add/Remove Programs, an orphaned `Program Files`
    copy, and a fresh UAC prompt on every later update until it is accepted.

  Both of these are read off the generated `installer.nsi`; verify them on a VM
  before rolling v2 out as an auto-update. Because the bad path is the one real
  users hit, **prefer announcing v2 as a manual download for existing v1.x
  users**, and only push it through the updater once the declined-prompt
  behaviour has been confirmed acceptable. Users with no admin credentials at
  all cannot accept the prompt, so they hit the bad path unavoidably.
- **Do NOT set `bundle.publisher` in the config.** The match above works only
  because both v1 and v2 derive the manufacturer as `dot-x` from the
  `com.dot-x.dev` identifier (neither sets an explicit publisher). Adding a
  `publisher` field changes the NSIS installer's manufacturer string, the
  `HKLM` match stops firing, the old MSI is *not* removed, and the user ends up
  with two copies installed — exactly the failure mode this migration exists to
  prevent.
- **Do NOT set `plugins.updater.windows.installMode` to `quiet`.** That runs the
  NSIS installer with `/S`, and silent NSIS installs skip page callbacks
  entirely — including the reinstall page that performs the MSI uninstall. The
  migration would never fire, giving every v1.x user the double-installed state
  above. The default (`passive`) is what this migration relies on.
- **Autostart needs re-pointing after the move.** The plugin writes an
  `HKCU\...\Run` entry holding the full path to the binary, and its
  `is_enabled()` only checks that an entry with our name exists — it never
  compares the path. Left alone, a migrated user keeps a Run entry aimed at the
  deleted `Program Files` binary while the settings toggle still reads "on", so
  the app silently stops launching at login. The app now refreshes that entry on
  startup whenever autostart is already enabled (see `setup` in
  `src-tauri/src/main.rs`). Release builds only — in dev this would repoint your
  autostart entry at `target/debug` on every `tauri dev` run.
- **Publishing:** for v1.x clients to auto-update into v2 at all, the
  `-setup.nsis.zip` updater artifact (produced via
  `createUpdaterArtifacts: v1Compatible`) plus its `.sig` must be published on
  Anystack for the `windows-x86_64` slot. Sign with the same key as v1 — the
  updater `pubkey` is unchanged, so a different key makes every existing client
  reject the update.
- **Follow-up:** `createUpdaterArtifacts` is only set to `v1Compatible` for the
  sake of v1.x clients. Once they have drained, set it back to `true` (v2
  clients accept either form) so we stop shipping the legacy `.nsis.zip`
  wrapper.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test with actual hardware
4. Submit for internal review

