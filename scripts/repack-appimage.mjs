#!/usr/bin/env node
// Removes the bundled libwayland-* libraries from the AppImage that `tauri build` produced.
// linuxdeploy bundles them as ordinary GTK/WebKit dependencies, but they must match the
// host's Mesa: an AppImage built on Ubuntu 24.04 crashes WebKitWebProcess on Fedora 44
// (Bazzite) with them bundled, and runs on both without them. linuxdeploy has no exclude
// option that Tauri passes through, so unpack, delete, and repack with the same runtime.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, openSync, readSync, closeSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const bundleDir = "src-tauri/target/release/bundle/appimage";
const pluginAppImage = join(homedir(), ".cache/tauri/linuxdeploy-plugin-appimage.AppImage");

const appImages = existsSync(bundleDir)
  ? readdirSync(bundleDir).filter((name) => name.endsWith(".AppImage"))
  : [];
if (appImages.length === 0) process.exit(0);
if (!existsSync(pluginAppImage)) {
  console.error(`Cannot repack the AppImage: ${pluginAppImage} (provides appimagetool) is missing.`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "dotx-appimage-"));
try {
  execFileSync(pluginAppImage, ["--appimage-extract"], { cwd: join(work), stdio: "ignore" });
  const appimagetool = join(work, "squashfs-root/appimagetool-prefix/AppRun");

  for (const name of appImages) {
    const appImage = join(process.cwd(), bundleDir, name);
    const unpackDir = mkdtempSync(join(work, "app-"));

    // The runtime is everything before the squashfs payload; reuse it instead of downloading one.
    const offset = Number(execFileSync(appImage, ["--appimage-offset"], { encoding: "utf8" }).trim());
    const runtime = Buffer.alloc(offset);
    const fd = openSync(appImage, "r");
    readSync(fd, runtime, 0, offset, 0);
    closeSync(fd);
    writeFileSync(join(unpackDir, "runtime"), runtime);

    execFileSync(appImage, ["--appimage-extract"], { cwd: unpackDir, stdio: "ignore" });
    const libDir = join(unpackDir, "squashfs-root/usr/lib");
    const removed = readdirSync(libDir).filter((lib) => lib.startsWith("libwayland-"));
    for (const lib of removed) rmSync(join(libDir, lib));

    const repacked = join(unpackDir, name);
    execFileSync(appimagetool, ["--runtime-file", join(unpackDir, "runtime"), join(unpackDir, "squashfs-root"), repacked], {
      env: { ...process.env, ARCH: "x86_64" },
      stdio: "ignore",
    });
    renameSync(repacked, appImage);
    console.log(`Repacked ${name} without ${removed.length} bundled libwayland libraries.`);

    // Updater artifacts were made from the original AppImage and no longer match it.
    for (const stale of [`${name}.tar.gz`, `${name}.tar.gz.sig`, `${name}.sig`]) {
      if (existsSync(join(bundleDir, stale))) {
        rmSync(join(bundleDir, stale));
        console.warn(`Removed stale updater artifact ${stale}; Linux updates are not published yet.`);
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
