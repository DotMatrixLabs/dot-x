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
- Windows 10/11, or Linux (see below)

#### Linux — Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential pkg-config curl wget file \
  libwebkit2gtk-4.1-dev librsvg2-dev libgtk-3-dev \
  libxcb-ewmh-dev libxcb-randr0-dev libdbus-1-dev \
  libpulse-dev libudev-dev libasound2-dev \
  libayatana-appindicator3-dev
```

#### Linux — Fedora / RHEL

```bash
sudo dnf install \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libxcb-devel alsa-lib-devel pulseaudio-libs-devel \
  systemd-devel dbus-devel
sudo dnf groupinstall "Development Tools"
```

#### Linux — Bazzite / Fedora Atomic (immutable OS)

Bazzite cannot install `-devel` packages natively. Use [Distrobox](https://distrobox.it/) (pre-installed on Bazzite) to build inside a mutable Fedora container that shares your home directory.

**One-time setup:**

```bash
distrobox create --name fedora-dev --image fedora:41
distrobox enter fedora-dev

sudo dnf install \
  webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel \
  libxcb-devel alsa-lib-devel pulseaudio-libs-devel \
  systemd-devel dbus-devel nodejs npm
sudo dnf groupinstall "Development Tools"

# Install Rust and Yarn inside the container
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
npm install -g yarn

# Allow serial port access to the Decker
sudo usermod -a -G dialout $USER
exit && distrobox enter fedora-dev  # re-enter so the group takes effect
```

**Daily use** — enter the container and build normally:

```bash
distrobox enter fedora-dev
cd ~/Code/dot-x
yarn tauri dev
```

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

## Contributing

1. Create a feature branch
2. Make your changes
3. Test with actual hardware
4. Submit for internal review

