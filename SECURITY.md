# Security policy

## Supported versions

Security fixes land on the `v2` branch. Installed copies of Dot X receive them through the built-in updater, so the supported version is whatever the updater currently ships. Older tags and branches get no fixes.

## Reporting a vulnerability

Do not open a public issue for anything you believe is exploitable.

Email **post@frogbyte.io**, or use GitHub's private vulnerability reporting (Security tab, "Report a vulnerability") if you prefer to keep it on GitHub. Include:

- What you found and how an attacker would use it
- Steps to reproduce, or a proof of concept
- The build you tested, including the version number and where you got it
- Your assessment of the impact

We are a small team, but we will acknowledge your report and keep you informed while we work on a fix. Please give us a reasonable amount of time before publishing anything, and coordinate disclosure with us.

## Scope

In scope:

- The Dot X desktop app and its Rust backend in `src-tauri/`, including the plugin server and the filesystem, shell, MIDI, and process capabilities the app grants
- The updater, including how the app verifies and applies updates
- The plugin SDK and the packaged `.dotxplugin` format
- The marketplace install path, including integrity hash verification

Out of scope:

- The Decker hardware and its firmware
- Third-party plugins and anything else already running on your machine
- Denial of service against our endpoints, social engineering, or physical access attacks
- Anything requiring a modified or jailbroken build of Dot X

## What is not a vulnerability

- The app sends crash reports to Sentry and a usage heartbeat to Aptabase. That is intentional. If you want it changed or configurable, open a feature request instead.
- Findings that only apply to end-of-life versions.

## Safe harbor

If you follow this policy in good faith, we will not pursue legal action over your research, and we will consider your work authorized. This covers accidental exposure of non-public data encountered while testing. It does not cover data exfiltration beyond what a proof of concept needs, service degradation, or privacy violations against other users.
