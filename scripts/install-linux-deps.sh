#!/usr/bin/env bash
# install-linux-deps.sh — install all build-time dependencies for Dot X on Linux.
# Tested on Ubuntu 24.04 (Noble). Run once before your first `yarn tauri build`.
# Usage: bash scripts/install-linux-deps.sh
set -euo pipefail

info()  { printf '\033[1;34m[info]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m  %s\n' "$*"; }
fatal() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# ── 0. Sanity checks ──────────────────────────────────────────────────────────
[[ "$(uname -s)" == "Linux" ]] || fatal "This script is for Linux only."
command -v apt-get >/dev/null 2>&1 || fatal "apt-get not found. Debian/Ubuntu is required."

# ── 1. Remove arm64 foreign architecture if present ──────────────────────────
# On machines where arm64 was added as a foreign dpkg architecture (e.g. for
# cross-compilation), several amd64 dev packages become unresolvable because
# apt tries to satisfy their arm64 dependencies from repos that don't carry
# them. Removing the foreign arch unblocks the install.
if dpkg --print-foreign-architectures | grep -q arm64; then
    warn "arm64 foreign architecture detected — removing it before installing deps."
    warn "This only affects package management; your installed arm64 packages are unaffected."
    sudo dpkg --remove-architecture arm64
fi

# ── 2. Update package lists ───────────────────────────────────────────────────
info "Updating package lists…"
sudo apt-get update -qq

# ── 3. Install build dependencies ────────────────────────────────────────────
info "Installing build dependencies…"
sudo apt-get install -y --fix-missing \
    build-essential pkg-config curl wget file \
    libssl-dev \
    libwebkit2gtk-4.1-dev librsvg2-dev libgtk-3-dev \
    libxcb-ewmh-dev libxcb-randr0-dev libdbus-1-dev \
    libpulse-dev libudev-dev libasound2-dev \
    libayatana-appindicator3-dev \
    ddcutil \
    xvfb

# ── 4. Fix Ubuntu 24.04 soup-3.0 pkg-config naming ───────────────────────────
# Ubuntu 24.04 ships the libsoup3 dev package with a .pc file named
# `libsoup-3.0.pc`, but the soup3-sys Rust crate (via webkit2gtk) looks for
# `soup-3.0`. We ship an alias .pc in src-tauri/pkgconfig/ that is wired in
# automatically via .cargo/config.toml. The system symlink below is belt-and-
# suspenders for environments where PKG_CONFIG_PATH is already set externally
# (CI, Docker, custom shell configs) and our .cargo/config.toml is overridden.
SOUP_PC_DIR="/usr/lib/x86_64-linux-gnu/pkgconfig"
LIBSOUP_PC="${SOUP_PC_DIR}/libsoup-3.0.pc"
SOUP_ALIAS="${SOUP_PC_DIR}/soup-3.0.pc"

if [[ -f "$LIBSOUP_PC" && ! -e "$SOUP_ALIAS" ]]; then
    info "Creating soup-3.0 → libsoup-3.0 pkg-config alias (Ubuntu 24.04 naming quirk)…"
    sudo ln -sf "$LIBSOUP_PC" "$SOUP_ALIAS"
elif [[ -e "$SOUP_ALIAS" ]]; then
    info "soup-3.0.pc already present — skipping."
else
    warn "libsoup-3.0.pc not found at ${LIBSOUP_PC}. Your system may use a different path."
    warn "If the build fails on soup-3.0, find the correct .pc and symlink it to soup-3.0.pc."
fi

# ── 5. Verify pkg-config can find the key libraries ──────────────────────────
info "Verifying pkg-config resolution…"
MISSING=()
for pkg in javascriptcoregtk-4.1 soup-3.0 gdk-3.0 alsa; do
    if ! pkg-config --exists "$pkg" 2>/dev/null; then
        MISSING+=("$pkg")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    warn "The following pkg-config packages could not be found: ${MISSING[*]}"
    warn "The build may fail. Check that the corresponding -dev packages are installed."
else
    info "All key pkg-config packages found."
fi

# ── 6. Remind about Node + Yarn ───────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || ! command -v yarn >/dev/null 2>&1; then
    warn "Node.js and/or Yarn not found. Install them before running 'yarn tauri build'."
    warn "  Node 20+: https://github.com/nodesource/distributions"
    warn "  Yarn:     sudo npm install -g yarn   (or: sudo corepack enable && corepack prepare yarn@stable --activate)"
fi

info "Done. You can now run: yarn install && yarn tauri build"
