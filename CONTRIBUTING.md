# Contributing

## Read This First

We accept contributions, but they should be small and focused.

You can still report a bug or open a PR, but please do so knowing there is a high chance we close it, defer it forever, or never look at it.

That still does not mean we will want the change, but it keeps scope, quality, and direction under control for a project that drives physical hardware.

PRs are automatically labeled with a `vouch:*` trust status and a `size:*` diff size based on changed lines.

If you are an external contributor, expect `vouch:unvouched` until we explicitly add you to `.github/VOUCHED.td`. Comment `/recheck-vouch` on your PR if you believe the label is stale.

## What We Are Most Likely To Accept

Small, focused bug fixes.

Small reliability fixes.

Small performance improvements.

Tightly scoped maintenance work that clearly improves the project without changing its direction.

## What We Are Least Likely To Accept

Large PRs.

Drive-by feature work.

Opinionated rewrites.

Anything that expands product scope without us asking for it first.

If you open a 1,000+ line PR full of new features, we will probably close it quickly and remember that you ignored the clearly written instructions.

## Developer Setup

Dot X is a Tauri 2 app: Vue 3 + TypeScript in `src/`, Rust in `src-tauri/`. Prerequisites: Node.js 22+, Yarn, Rust stable, and the `cargo-license` subcommand (`cargo install cargo-license` — `yarn build` calls `cargo license`), on Windows 10 or 11.

```bash
git clone https://github.com/Frogbyte-io/dot-x.git
cd dot-x
yarn install
yarn tauri dev
```

The first build compiles all of Rust from scratch, so it takes a while.

Most features need a Decker physically attached over serial. The app holds the device's serial and MIDI ports, so close any installed Dot X instance before running the dev app, and restore it after.

## Reporting Bugs And Requesting Features

Use the issue forms. The bug template asks for the Dot X version, where the build came from, steps to reproduce, and your environment.

The app does not write its own log files, so if you built from source, run it from a terminal and copy the console output. Plugin output is written to `plugin.log` inside each installed plugin's folder under `%APPDATA%\com.dot-x.dev\plugins\`; include it for plugin issues.

Redact API keys, tokens, and passwords before pasting logs or screenshots. Plugin settings can hold credentials, and some of that can end up in log output.

Anything you believe is exploitable does not belong in a public issue. See [SECURITY.md](SECURITY.md) for how to report it privately.

Feature requests and ideas go through the feature request form, not the bug tracker. We read every request; a request is not a promise.

## If You Still Want To Open A PR

Keep it small.

Base your branch on `v2` and open the PR against `v2`. That is the active development branch.

Commit messages use conventional prefixes (`feat:`, `fix:`, `chore:`), lowercase imperative mood, one line, no body.

Explain exactly what changed.

Explain exactly why the change should exist.

Run `yarn build` before pushing. It generates license reports, typechecks, and builds the frontend. If your change touches Rust, also run `cargo check` in `src-tauri/`.

Do not mix unrelated fixes together.

If the PR makes anything resembling a UI change, include clear before/after images.

If the change depends on motion, timing, transitions, or interaction details, include a short video.

Test hardware changes (sliders, MIDI, volume routing, RGB) with a Decker attached and say in the PR that you did. If you could not test something, say that instead of implying you did.

If we have to guess what changed, we are much less likely to review it.

## Discuss Changes First

If you are thinking about a non-trivial change, open a feature request describing the problem first, and wait for a maintainer response before building. Issues are where we work out whether something should exist.

That still does not mean we will want the PR, but it gives you a chance to avoid wasting your time.

## Be Realistic

Opening a PR does not create an obligation on our side.

We may close it. We may ignore it. We may ask you to shrink it. We may reimplement the idea ourselves later.

If you are fine with that, proceed.

## Plugins

If you want to build a plugin rather than change the app itself, start with the [plugin SDK README](plugin-sdk/README.md). The scaffolder gets you a working project:

```bash
npx @dotmatrixlabs/create-dotx-plugin --name "My Plugin"
```

Questions about plugin development can go through regular issues.
