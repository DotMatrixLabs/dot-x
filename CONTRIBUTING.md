# Contributing to Dot X

Thanks for wanting to help. This page covers setting up a build, reporting problems, and getting changes merged.

## Status

Dot X is being prepared for its first public release (tracked in issue #191).

## License

The app source is licensed GPL-3.0-or-later, see [LICENSE](LICENSE). The plugin SDK in `plugin-sdk/` is MIT, so plugins you build on it can carry any license. By contributing code you agree that your contributions ship under the license of the files you touch.

## Development build

Prerequisites: Node.js 22+, Yarn, Rust (stable), and Windows 10 or 11. The app talks to the Decker mixer over serial and MIDI, so most features need the hardware attached to test properly.

```bash
git clone https://github.com/Frogbyte-io/dot-x.git
cd dot-x
yarn install
yarn tauri dev
```

The first build takes a while because Rust compiles everything from scratch.

## Reporting bugs and requesting features

Search existing issues first. If yours is new, use the bug or feature template and fill in what it asks for.

For bugs, the useful details are the Dot X version and where the build came from, your Windows version, steps to reproduce, and log output if you have it. The app writes logs to `%APPDATA%\com.dot-x.dev\logs`.

Redact API keys, tokens, and passwords before pasting logs or screenshots. Plugin settings can hold credentials, and some of that can end up in log output.

Anything you believe is exploitable does not belong in a public issue. See [SECURITY.md](SECURITY.md) for how to report it privately.

## Making changes

- Base your branch on `v2` and open pull requests against `v2`. That is the active development branch.
- Keep PRs small and focused on one thing.
- Commit messages use conventional prefixes (`feat:`, `fix:`, `chore:`), lowercase imperative mood, one line, no body. Details in [.github/instructions/commit-format.instructions.md](.github/instructions/commit-format.instructions.md).
- Run `yarn build` before pushing. It generates license reports, typechecks, and builds the frontend. If your change touches Rust, also run `cargo check` in `src-tauri/`.
- Test hardware changes (sliders, MIDI, volume routing) with a Decker attached and say in the PR that you did. If you could not test something, say that instead of implying you did.

## Pull requests

The `Secret scanning / Gitleaks` check scans the full history reachable from the
checked-out commit on pull requests and pushes to `main` and `v2`. Findings fail
the check, and secret values are redacted from its output. It uses the standalone
[Gitleaks CLI](https://github.com/gitleaks/gitleaks) with no license key required.

To run the same check locally, install Gitleaks 8.30.1 and run from the repository
root:

```bash
gitleaks git --redact --no-banner --log-opts=HEAD .
```

If the check finds a credential, revoke or rotate it and remove it from the
affected commits. Deleting it in a later commit leaves it in the scanned history.
Report exposed credentials through [SECURITY.md](SECURITY.md). This check runs
after a push and does not enable GitHub's separate push-protection setting.

Describe the problem you are fixing, the change, and how you verified it. Link the issue the PR closes. Reviews happen when maintainers have time; the team is small, so patience helps.

## Plugins

If you want to build a plugin rather than change the app itself, start with the [plugin SDK README](plugin-sdk/README.md). The scaffolder gets you a working project:

```bash
npx @dotmatrixlabs/create-dotx-plugin --name "My Plugin"
```

Questions about plugin development can go through regular issues.
