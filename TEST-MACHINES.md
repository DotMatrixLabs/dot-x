# Dot X Linux Test Machines

Machine inventory and per-machine launch instructions for testing Linux support (see `LINUX-SUPPORT.md` for the actual goal list and findings). **First check which machine you're running on** — the test machine may be local (no SSH) or remote.

Testing is done on Ubuntu/Bazzite. Currently up for testing:

- **`ananords-dev`** — Ubuntu 24.04.4 LTS, GNOME Shell 46.0 on Wayland (session on tty2), real Decker (`VM-5SW`) on `/dev/ttyACM0`. No `/sys/class/backlight`; external HP 24uh monitor on HDMI-A-1 (`/dev/i2c-1`), DDC/CI working. The only machine in this inventory that can verify GNOME Wayland work (see `LINUX-SUPPORT.md`'s "Active window — GNOME Wayland" entry). When a session runs directly on this machine, no SSH is needed. Otherwise reach it via `ssh ananords@192.168.68.149` — key-based access set up 2026-07-03 from `bazzite` (`~/.ssh/id_ed25519`, comment `bazzite-dotx-dev`, added to this machine's `authorized_keys`). If access ever breaks (host key changed, key rotated, `Permission denied (publickey,password)`), a human needs to add the new public key to `authorized_keys` out of band — there's no password fallback Claude can answer.
- **`bazzite`** — Also available for testing. NVIDIA GeForce GTX 1660 SUPER (driver 610.43), KDE Plasma/KWin Wayland. The app used to crash immediately on launch here; as of 2026-07-02 the app pulls in the `webkit2gtk-nvidia-quirk` crate, which detects NVIDIA + session type at startup and sets `__NV_DISABLE_EXPLICIT_SYNC=1` (Wayland) or `WEBKIT_DISABLE_DMABUF_RENDERER=1` (X11) itself, so no manual workaround is needed (see `LINUX-SUPPORT.md`'s "Verified working on Linux"). For development/builds, prefer Distrobox instead of the immutable host; native Bazzite has the runtime `.so` files but not the `-devel` pkg-config metadata or unversioned linker names needed by `yarn tauri dev`. Real Decker also present at `/dev/ttyACM0`, but the user account isn't in the `dialout` group and the `99-dot-x.rules` udev rule isn't installed on this machine, so serial access needs one of those fixed before Decker/MIDI-round-trip testing can happen here.

To launch the app on `ananords-dev` with the live Wayland display:
```sh
WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
  XDG_CURRENT_DESKTOP=ubuntu:GNOME \
  src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```
Over SSH, the login shell has no `WAYLAND_DISPLAY`/`DBUS_SESSION_BUS_ADDRESS` set (confirmed 2026-07-03) — always export them explicitly as above, or webview/tray/D-Bus calls will fail silently.

To launch the app on `bazzite` from an already-built binary (env vars are already set in a normal desktop login shell there):
```sh
src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```
As of 2026-07-02 the app auto-detects NVIDIA + session type (via `webkit2gtk-nvidia-quirk`) and sets `__NV_DISABLE_EXPLICIT_SYNC=1` on Wayland itself, so the crash workaround above is no longer needed manually — and unlike `WEBKIT_DISABLE_DMABUF_RENDERER=1`, it keeps WebKitGTK's fast DMA-BUF rendering path enabled. `GDK_BACKEND=x11` / `WEBKIT_DISABLE_COMPOSITING_MODE=1` are unrelated to the crash but can still be set if you hit a black/unrendered webview:
```sh
GDK_BACKEND=x11 WEBKIT_DISABLE_COMPOSITING_MODE=1 src-tauri/target/debug/dot_x &> /tmp/dotx.log &
```

For development on Bazzite, use `yarn dev:linux`. It enters the Fedora Distrobox automatically on the immutable host, checks for Linux build dependencies, and applies the WebKit/X11 launch flags. Plain `yarn tauri dev` is intentionally left as the raw Tauri command.

**Debug-binary gotcha (found 2026-07-03, applies to any machine):** `target/debug/dot_x`'s bundled config points `devUrl` at `http://localhost:1420` (`beforeDevCommand: yarn dev`, i.e. Vite). Launching the raw binary directly without a Vite dev server running behind it produces a fully black, correctly-sized, correctly-titled, `IsViewable` window — everything *looks* alive (process up, window mapped, no crash/error logged) except the webview never loads any content, and the MCP bridge's `webview_execute_js`/`webview_screenshot` calls all time out because the in-page bridge script never runs. `GDK_BACKEND=x11`/`WEBKIT_DISABLE_DMABUF_RENDERER=1`/`WEBKIT_DISABLE_COMPOSITING_MODE=1` do not fix this. Use `yarn dev:linux` (or `yarn tauri dev` on a known-good machine) rather than the raw binary when you need the webview to actually render or need MCP-bridge webview automation.
