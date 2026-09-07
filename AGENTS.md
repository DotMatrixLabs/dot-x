# Dot X

Dot X is the desktop companion app for the DotMatrixLabs Decker, a physical volume mixer. It is a Tauri 2 app: a Vue 3 + TypeScript frontend in `src/`, a Rust backend in `src-tauri/` that talks serial and MIDI to the Decker and uses Windows APIs for per-app volume, screen brightness, and tray.

You can think of Dot X as the driver, control surface, and update channel for a piece of hardware people keep on their desk and leave running in their tray all day.

## What makes Dot X special?

Dot X users bought a Decker because they want physical control over their machine. The app is the thing that makes the hardware feel real. Here is what we can never compromise on.

### 1. The hardware feel

Slider to volume must feel instant. Mapping changes must land without a reboot or a restart. If a change adds latency, buffering, or polling to the serial/MIDI/volume path, that change is wrong.

### 2. It lives in the tray

Dot X starts with Windows, sits in the tray, and holds the Decker's serial port for the whole session. Users do not "run" Dot X; they forget it exists. Features must work without windows being open, and must not add background CPU, memory growth, or wakeups.

### 3. It is allowed to touch the system

Per-app volume, screen brightness, autostart, MIDI routing. These are invasive privileges. Code that touches them fails loudly and honestly, never silently half-applies.

## A note from the maintainers

We like simple systems and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here.

## A small glossary

We need to be on the same page with terminology. When communicating, use this language:

- **you** means the agent reading this file and changing Dot X.
- **we, us, and maintainers** mean the people building Dot X. These are who you are talking to now.
- **user** means the person running Dot X on their PC with a Decker attached.
- **Decker** means the DotMatrixLabs hardware device: sliders, RGB LEDs, MIDI, over serial.
- **mapping** means the link between a physical slider/channel and an app's volume (or another controllable target).
- **plugin** means third-party code loaded by the plugin runtime. The public contract lives in `plugin-sdk/`.
- **dev app** means a Dot X built from this repo via `yarn tauri dev`. **installed app** means the user's production installation.

## The three ways to hurt yourself

1. **Killing by pattern.** Never `Stop-Process -Name "Dot X"`, `pkill -f`, or kill a PID you found by matching a name or path fragment. Dev builds and the user's installed, tray-resident production app are both named `Dot X.exe` — the only honest distinction is the executable path (`...\src-tauri\target\...` is a dev build; `Program Files` or an installer location is the user's real app, possibly holding the Decker right now). Kill only a PID you captured at spawn. `yarn tauri dev` spawns Vite, cargo, and the app; stop those by the PIDs you tracked.
2. **Writing to the live app data.** `%APPDATA%\com.dot-x.dev` is shared by the installed app and the dev app — same identifier, one profile. It holds mappings, plugin settings, and plugin credentials. Reading it and copying from it are fine, and a good way to get real test data. Never delete or "clean" it, and back it up (copy the folder to `%TEMP%`) before any test that can mutate settings.
3. **Grabbing the serial port.** Only one process can hold the Decker's serial and MIDI ports. If the installed app is running, the dev app cannot connect (or will fight it for device messages). Close the installed app before testing device features, say that you did, and restore it after. Never run two dev instances.

## Hit every surface

The most common defect in this repo is a change that works on the path you tested and is missing everywhere else. Before calling work done, walk this list and say which entries applied:

- **Entry points.** A behavior reachable from the main window is usually also reachable from the tray menu, settings, or a plugin. Fixing one is not fixing the feature.
- **Layers.** A feature crosses three layers: Vue UI (`src/`) → Tauri commands (`src-tauri/src/main.rs` and modules) → OS/device (serial, MIDI, Windows audio, brightness). A UI-only fix over a Rust-side behavior change is not a fix.
- **Plugins.** Anything crossing the plugin boundary is typed in `plugin-sdk/`. Change the contract and you regenerate types (`npm run generate-types`), update the SDK, and decide per feature whether it is "not supported in plugins".
- **Reverse states.** If you added a way in, add the way out and the way to see it. Add a mapping, remove a mapping. Enable autostart, disable autostart. A one-way door is a bug.
- **Docs.** Check whether the change makes the README or `plugin-sdk/` READMEs inaccurate.

## Dev environment

- `yarn install` installs. Then `yarn tauri dev` builds and launches the app. The first build compiles all of Rust from scratch; minutes are normal, do not kill it.
- The dev app window is titled "Dot X". Vite is pinned to port 1420 with `strictPort` and `tauri.conf.json` expects it; if the port is busy, free it — do not change the port.
- Windows 10/11 only, Node 22+, Yarn, Rust stable, plus the `cargo-license` subcommand (`cargo install cargo-license`) which `yarn build` needs. Most features need a Decker physically attached. Without it you can still exercise UI, settings, and plugins — say exactly that in the PR, and say what you could not test.
- The app does not write its own log files: `tauri_plugin_log` targets stdout only (the dev console), and crashes go to Sentry. Plugin stdout/stderr is appended to `plugin.log` inside each installed plugin's folder under `%APPDATA%\com.dot-x.dev\plugins\`. If you need app logs, run the app from a terminal and copy the console output.

## Verifying

- There is no automated test suite. The proof is a running app plus focused checks:
  - `yarn build` — regenerates license reports, typechecks with vue-tsc, builds the frontend. Run this before pushing, always.
  - `cargo check` in `src-tauri/` — run this if Rust changed.
- Test meaningful behavior in the running app, not a plausible-looking diff.
- Do not install tools (ffmpeg, gh upgrades) without asking.

## Screenshots and video

PRs that touch UI need before/after images. Motion, timing, or interaction changes need a short video. Here is how to produce and upload them without committing anything to the repo.

**Capture the window, not the desktop.** Save everything to a temp folder outside the repo, e.g. `%TEMP%\dotx-pr\`. Never commit PR evidence. Never create a `.github/pr-assets/` folder.

Capture the dev app's window (run `yarn tauri dev` first, and open the window from the tray icon if needed):

```powershell
New-Item -ItemType Directory -Force "$env:TEMP\dotx-pr" | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;using System.Runtime.InteropServices;
public struct RECT { public int Left, Top, Right, Bottom; }
public class Win {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
# Dev app and installed app are both named "Dot X" — see "The three ways to hurt yourself".
# Match the exact target dir of the checkout you are working in; run this from the repo/worktree root.
$devRoot = (Resolve-Path .).Path
$proc = Get-Process "Dot X" -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -like "$devRoot*" } | Select-Object -First 1
if (-not $proc) { throw "No visible dev Dot X window. Run 'yarn tauri dev' and open the window from the tray icon first." }
if (-not [Win]::SetForegroundWindow($proc.MainWindowHandle)) {
  throw "Could not bring the Dot X window to the foreground; capturing now would record whatever else is on screen."
}
Start-Sleep -Milliseconds 300
$r = New-Object RECT
[Win]::GetWindowRect($proc.MainWindowHandle, [ref]$r) | Out-Null
$w = $r.Right - $r.Left; $ht = $r.Bottom - $r.Top
if ($w -le 0 -or $ht -le 0) { throw "Got a $w x $ht window rect; the window is probably hidden or cloaked. Bring it to the foreground and retry." }
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
$bmp.Save("$env:TEMP\dotx-pr\after.png", [System.Drawing.Imaging.ImageFormat]::Png)
```

For a "before" shot, repeat against the previous build (e.g. a worktree on `v2` without your change) with the same window size and the same content on screen. Same framing, same data, only your change differs.

**Video** for motion or timing: a short `ffmpeg` gdigrab clip if ffmpeg is available (ask before installing it), using the same window rect as the capture script above:

```powershell
ffmpeg -f gdigrab -framerate 15 -offset_x $r.Left -offset_y $r.Top -video_size "$($w)x$($ht)" -i desktop -t 10 -pix_fmt yuv420p -vcodec libx264 "$env:TEMP\dotx-pr\demo.mp4"
```

Keep clips under 15 seconds and under 10 MB (GitHub's upload cap). Trim to the part that shows the behavior.

**Upload to GitHub, in two ways:**

- Preferred, `gh` 2.99.0 or newer: `gh pr create --attach "$env:TEMP\dotx-pr\before.png#Before" --attach "$env:TEMP\dotx-pr\after.png#After"`, or `gh pr comment 123 --attach "$env:TEMP\dotx-pr\demo.mp4#Slider lag"`. The repeatable `--attach` flag uploads the file and rewrites or appends references in the body. Works on `gh issue create/edit/comment` and `gh pr create/edit/comment`. Alt text follows the path after `#`.
- On older `gh`, upload directly and embed the returned URL:

  ```powershell
  $repoId = gh api repos/Frogbyte-io/dot-x --jq .id
  curl.exe -s -X POST `
    -H "Authorization: Bearer $(gh auth token)" -H "Accept: application/json" `
    --data-binary "@$env:TEMP\dotx-pr\after.png" `
    "https://uploads.github.com/user-attachments/assets?name=after.png&content_type=image/png&repository_id=$repoId"
  ```

  The response JSON contains the attachment URL; embed it in the PR body as `![after](<url>)`.

**Redact.** Plugin settings can hold credentials, and tokens can appear in logs and on screen. Keep them out of frame, out of logs, and out of uploads. The repo is private, but treat every upload like it is public: attachment URLs only render for people with repo access, and they still feel permanent.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Base the branch on `v2` and open the PR against `v2`. That is the active development branch.
- Conventional commit titles, plain language: `fix(audio): unmapped apps no longer drop volume sync`. Use scopes like `audio`, `device`, `midi`, `rgb`, `brightness`, `tray`, `plugins`, `build`, `docs`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- UI changes need before/after images. Motion or timing needs a short video. Upload evidence to GitHub per "Screenshots and video" above; never commit PR-only screenshots or assets.
- One concern per PR. If the description says "also", split it.
- When babysitting a PR: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new. Stop when the bots are green on the latest commit.

## Where code lives

- `src/` - Vue 3 + Pinia UI. `App.vue` and `SliderOverview.vue` are the main surfaces; `store/` holds Pinia stores; `ts/` holds device and system logic (`decker.ts`, `volumeControl.ts`, `RGBController.ts`, `plugins.ts`); `Plugins/`, `SettingsModal/`, `AppSelectModal/` are the feature surfaces.
- `src-tauri/src/` - Rust. `main.rs` wires Tauri commands, tray, autostart, and updater; `decker.rs` is the serial protocol; `midi.rs` is MIDI routing; `plugin_runtime.rs`, `plugin_server.rs`, and `plugin_marketplace.rs` are the plugin system; `power_monitor.rs` watches system power events.
- `plugin-sdk/` - the public SDK for plugin authors, plus its generated docs. The plugin API contract matters to third parties; change it deliberately and regenerate types with `npm run generate-types`.
- `tools/` - build scripts (`bump-version.mjs`, `generate-plugin-types.ts`).
- `.github/` - release template and workflows.

## Taste

- The slider-to-volume path is sacred. Latency there is measured in milliseconds, not reviews.
- Users run this app 24/7. No polling loops that peg CPU, no unbounded logs, no memory leaks in the tray.
- Inferred types over annotations. `any` is the enemy.
- Comments describe how a thing is used, and move when the code moves.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Additional tips

- Do not verify with browsers or computer use unless the user explicitly agrees or requests it.
- Security matters, but this is a pre-release private repo: ask before touching updater endpoints, telemetry keys, or anything that ships in release builds.
