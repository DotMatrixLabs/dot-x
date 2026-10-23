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
- Windows 10/11, or Linux: see [LINUX-SUPPORT.md](LINUX-SUPPORT.md) for build dependencies, Distrobox on Bazzite, and `yarn build:linux`

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
`HKLM`). The v2 installer removes it before installing per-user, on both paths:
a manually downloaded `-setup.exe` and an auto-update (`/P /R /UPDATE`).

Tauri's NSIS template has its own WiX migration, but it runs the bare MSI
uninstall string (an unexplained "uninstall this product?" Yes/No box that can
open behind other windows) and, in passive mode, keeps installing when the
removal fails. So `src-tauri/windows/installer-hooks.nsh` takes over:

- **Detection** is the same as Tauri's: an entry under `HKLM\...\Uninstall`
  whose `DisplayName` + `Publisher` equals `Dot X` + `dot-x` and whose uninstall
  string is an `msiexec` call. The hook spells out these values (they are what
  v1 wrote) because Tauri includes the hooks file before it defines
  `PRODUCTNAME` and `MANUFACTURER`.
- **Removal** runs from `.onGUIInit`, before the first page, as
  `msiexec /x {GUID} /passive /norestart`. The only prompt is UAC. Tauri's own
  check then finds nothing to do.
- **If the removal fails** (UAC declined, or the user has no admin rights), the
  installer explains why and offers Retry/Cancel. Cancel exits without
  installing anything. v1 stays installed and working, and with `/R` (the
  updater) it is started again. The v1 updater will offer v2 again on its next
  check; the user needs an administrator once, either to approve the prompt or
  to uninstall v1 from Settings > Apps.
- **Silent installs** (`/S`) skip `.onGUIInit` and all pages, so they cannot
  migrate. `NSIS_HOOK_PREINSTALL` aborts them while the v1 MSI is still there,
  instead of installing next to it.

Things to know about the transition:

- **One unavoidable UAC prompt.** Removing a per-machine `Program Files`
  install requires admin, so the one-time MSI removal triggers a single UAC
  prompt, mid-update for v1.x clients that auto-update. This is inherent to
  leaving admin-land. Every update *after* a completed migration is
  elevation-free.
- **Do NOT set `plugins.updater.windows.installMode` to `quiet`.** That runs the
  installer with `/S`, which cannot migrate (see above), so every v1.x
  auto-update would fail. The default (`passive`) is what the migration relies
  on.
- **Autostart needs re-pointing after the move.** The plugin writes an
  `HKCU\...\Run` entry holding the full path to the binary, and its
  `is_enabled()` only checks that an entry with our name exists — it never
  compares the path. Left alone, a migrated user keeps a Run entry aimed at the
  deleted `Program Files` binary while the settings toggle still reads "on", so
  the app silently stops launching at login. The app now refreshes that entry on
  startup whenever autostart is already enabled (see `setup` in
  `src-tauri/src/main.rs`). Release builds only — in dev this would repoint your
  autostart entry at `target/debug` on every `tauri dev` run.
- **Publishing:** v1.x clients have the Anystack endpoint compiled in, so they
  can only reach v2 through Anystack, even after #245 moves v2's own updates to
  GitHub Releases. Publish the `-setup.nsis.zip` updater artifact (produced via
  `createUpdaterArtifacts: v1Compatible`) plus its `.sig` on Anystack for the
  `windows-x86_64` slot. Sign with the same key as v1. The updater `pubkey` is
  unchanged, so a different key makes every existing client reject the update.
- **Follow-up:** `createUpdaterArtifacts` is only set to `v1Compatible` for the
  sake of v1.x clients. Once they have drained, set it back to `true` (v2
  clients accept either form) so we stop shipping the legacy `.nsis.zip`
  wrapper.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to open issues and pull
requests, and [SECURITY.md](SECURITY.md) for reporting security problems
privately.

## License

Dot X source code and official binaries are licensed under the GNU General
Public License, version 3 or any later version, `GPL-3.0-or-later`. See
[LICENSE](LICENSE). The installer displays the GPL notice and full license
text bundled in [GPL-3.0.txt](src-tauri/licenses/GPL-3.0.txt).

The plugin SDK is separately licensed under [MIT](plugin-sdk/LICENSE).
Bundled third-party components retain their own licenses and notices in
`src-tauri/licenses/`.

When distributing an official binary release, provide its corresponding
source and build instructions alongside the installer. The source must match
that release and include the required dependency sources. Make those available
before publishing the binary.

