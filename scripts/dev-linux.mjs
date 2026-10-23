#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, openSync, closeSync } from "node:fs";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const requestedDistroboxName = process.env.DOTX_DISTROBOX_NAME;
const dryRun = process.argv.includes("--dry-run");
const checkOnly = process.argv.includes("--check-only");
const buildMode = process.argv.includes("--build");
const skipPreflight = process.env.DOTX_SKIP_LINUX_PREFLIGHT === "1";

function readOsRelease() {
  for (const path of ["/etc/os-release", "/usr/lib/os-release"]) {
    if (!existsSync(path)) continue;
    const values = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      values[match[1]] = match[2].replace(/^"|"$/g, "");
    }
    return values;
  }
  return {};
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function formatCommand(command, args) {
  return [command, ...args].map(shellQuote).join(" ");
}

function commandExists(command) {
  return spawnSync("sh", ["-lc", `command -v ${shellQuote(command)} >/dev/null 2>&1`], {
    stdio: "ignore",
  }).status === 0;
}

function getDistroboxNames() {
  const result = spawnSync("distrobox", ["list"], { encoding: "utf8" });
  if (result.status !== 0) return [];

  return result.stdout
    .split("\n")
    .slice(1)
    .map((line) => line.split("|")[1]?.trim())
    .filter(Boolean);
}

function resolveDistroboxName() {
  if (requestedDistroboxName) return requestedDistroboxName;

  const names = getDistroboxNames();
  if (names.includes("fedora-dev")) return "fedora-dev";
  if (names.includes("dotx-ubuntu-ci")) return "dotx-ubuntu-ci";
  return names[0] || "fedora-dev";
}

function run(command, args, options = {}) {
  if (dryRun) {
    console.log(formatCommand(command, args));
    process.exit(0);
  }

  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: options.env || process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function pkgConfigExists(pkg) {
  const env = {
    ...process.env,
    PKG_CONFIG_PATH: [process.env.PKG_CONFIG_PATH, `${repoRoot}/src-tauri/pkgconfig`]
      .filter(Boolean)
      .join(":"),
  };

  return spawnSync("pkg-config", ["--exists", pkg], {
    stdio: "ignore",
    env,
  }).status === 0;
}

function anyPkgConfigExists(pkgs) {
  return pkgs.some(pkgConfigExists);
}

function printDependencyHelp(missing) {
  console.error("Linux development dependencies are missing:");
  for (const item of missing) {
    console.error(`  - ${item}`);
  }

  console.error("");
  if (commandExists("apt-get")) {
    console.error("Run: yarn setup:linux");
  } else if (commandExists("dnf")) {
    console.error("Run:");
    console.error("  sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \\");
    console.error("    libappindicator-gtk3-devel librsvg2-devel libxcb-devel alsa-lib-devel \\");
    console.error("    pulseaudio-libs-devel systemd-devel dbus-devel ddcutil nodejs npm");
    console.error("  sudo dnf groupinstall \"Development Tools\"");
  } else {
    console.error("Install the Linux build prerequisites listed in LINUX-SUPPORT.md.");
  }

  console.error("");
  console.error("Set DOTX_SKIP_LINUX_PREFLIGHT=1 to bypass this check.");
}

function getSerialDevicePaths() {
  if (!existsSync("/dev")) return [];

  return readdirSync("/dev")
    .filter((name) => /^tty(ACM|USB)\d+$/.test(name))
    .map((name) => `/dev/${name}`)
    .sort();
}

function canOpenSerialDevice(path) {
  try {
    const fd = openSync(path, "r+");
    closeSync(fd);
    return true;
  } catch (error) {
    return false;
  }
}

function printSerialAccessWarning(paths) {
  console.warn("Linux serial devices are visible but not accessible to this process:");
  for (const path of paths) {
    console.warn(`  - ${path}`);
  }

  console.warn("");
  console.warn("Dot X will show a copyable udev-rule fix if device connection fails.");
  if (inContainer || process.env.DOTX_LINUX_DEV_INSIDE_DISTROBOX === "1") {
    console.warn("Because this is running inside a container/Distrobox, apply serial access fixes on the host.");
  }
  console.warn("");
}

function preflightLinuxDeps() {
  if (skipPreflight || dryRun) return;

  const missing = [];
  for (const command of ["node", "yarn", "cargo", "pkg-config", "ddcutil"]) {
    if (!commandExists(command)) missing.push(`command: ${command}`);
  }

  if (commandExists("pkg-config")) {
    const checks = [
      ["dbus-1"],
      ["xcb"],
      ["alsa"],
      ["gtk+-3.0", "gtk3"],
      ["gdk-3.0"],
      ["webkit2gtk-4.1"],
      ["javascriptcoregtk-4.1"],
      ["soup-3.0", "libsoup-3.0"],
      ["libudev", "udev"],
    ];

    for (const pkgs of checks) {
      if (!anyPkgConfigExists(pkgs)) missing.push(`pkg-config: ${pkgs.join(" or ")}`);
    }
  }

  if (missing.length > 0) {
    printDependencyHelp(missing);
    process.exit(1);
  }

  const inaccessibleSerialDevices = getSerialDevicePaths().filter((path) => !canOpenSerialDevice(path));
  if (inaccessibleSerialDevices.length > 0) {
    printSerialAccessWarning(inaccessibleSerialDevices);
  }
}

const osRelease = readOsRelease();
const isLinux = process.platform === "linux";
const isBazzite =
  osRelease.ID === "bazzite" ||
  osRelease.NAME?.toLowerCase().includes("bazzite") ||
  osRelease.IMAGE_ID?.toLowerCase().includes("bazzite");

const inContainer =
  Boolean(process.env.container) ||
  Boolean(process.env.DISTROBOX_ENTER_PATH) ||
  existsSync("/run/.containerenv") ||
  existsSync("/.dockerenv");

const forceWorkarounds = process.env.DOTX_FORCE_WEBKIT_WORKAROUNDS === "1";
const hasNvidia = existsSync("/proc/driver/nvidia/version");
const isWayland = Boolean(process.env.WAYLAND_DISPLAY);
const isKde = (process.env.XDG_CURRENT_DESKTOP || "").toLowerCase().includes("kde");
const shouldUseWebkitWorkarounds = forceWorkarounds || isBazzite || (hasNvidia && isWayland && isKde);

if (!isLinux) {
  run("yarn", ["tauri", buildMode ? "build" : "dev"]);
}

if (isBazzite && !inContainer && process.env.DOTX_SKIP_DISTROBOX !== "1") {
  if (!commandExists("distrobox")) {
    console.error("Bazzite detected, but distrobox was not found.");
    console.error("Install/use Distrobox, or set DOTX_SKIP_DISTROBOX=1 to run on the host anyway.");
    process.exit(1);
  }

  const distroboxName = resolveDistroboxName();
  const exports = shouldUseWebkitWorkarounds
    ? "GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 "
    : "";
  const passthroughArgs = (checkOnly ? " --check-only" : "") + (buildMode ? " --build" : "");

  const command = [
    `cd ${shellQuote(repoRoot)}`,
    `${exports}DOTX_LINUX_DEV_INSIDE_DISTROBOX=1 yarn dev:linux${passthroughArgs}`,
  ].join(" && ");

  console.log(`Bazzite host detected; entering Distrobox '${distroboxName}' for Linux ${buildMode ? "build" : "dev"}.`);
  run("distrobox", ["enter", distroboxName, "--", "bash", "-lc", command]);
}

const env = { ...process.env };
if (shouldUseWebkitWorkarounds) {
  env.GDK_BACKEND ||= "x11";
  env.WEBKIT_DISABLE_DMABUF_RENDERER ||= "1";
  env.WEBKIT_DISABLE_COMPOSITING_MODE ||= "1";
}

preflightLinuxDeps();
if (checkOnly) {
  console.log("Linux development dependency preflight passed.");
  process.exit(0);
}

if (!buildMode) {
  run("yarn", ["tauri", "dev"], { env });
}

// linuxdeploy's bundled strip predates .relr.dyn sections (Fedora 41+ system libs) and fails on them.
env.NO_STRIP ||= "1";
const buildArgs = ["tauri", "build"];
if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  console.warn("TAURI_SIGNING_PRIVATE_KEY is not set; building without updater artifacts.");
  buildArgs.push("--config", JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
}
if (dryRun) run("yarn", buildArgs, { env });
const build = spawnSync("yarn", buildArgs, { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);
run("node", ["scripts/repack-appimage.mjs"], { env });
