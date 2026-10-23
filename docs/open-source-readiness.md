# Open source readiness

Audit of `v2` at `d70836a` on 2026-10-23 against
[issue #191](https://github.com/Frogbyte-io/dot-x/issues/191).
This records source changes already merged and work still needed before making
the repository public. An open issue checkbox alone is not evidence that its
implementation is missing.

## Remaining publication gates

- [ ] Resolve the installer EULA in [#192](https://github.com/Frogbyte-io/dot-x/issues/192).
  The root GPL-3.0 license and MIT SDK license are present, and SDK metadata
  declares MIT. However, `bundle.licenseFile` still selects
  `src-tauri/licenses/EULA.txt`, which restricts redistribution and reverse
  engineering. Decide the terms for official binaries and align the installer
  notice and README with that decision.
- [ ] Record the personal-email policy in
  [#193](https://github.com/Frogbyte-io/dot-x/issues/193).
  Obtain consent before exposing an unrelated employer's address, or replace
  it during the rewrite. A `.mailmap` alone does not erase original addresses.
- [ ] Record the AI attribution policy and the exact branches and tags to
  publish in [#208](https://github.com/Frogbyte-io/dot-x/issues/208).
  Do not infer approval to delete branches from their names.
- [ ] Prepare and approve the history rewrite in
  [#197](https://github.com/Frogbyte-io/dot-x/issues/197), after those decisions.
  Use a separate mirror and retain a backup. Inventory every retained ref,
  remove the Deno archives and SDK tarball, handle checkpoint commits and
  approved identity changes, and verify the result before replacing remote
  history. Include previously embedded telemetry values in the removal plan.
  Agree how collaborators and open PRs will move to the rewritten history.
- [ ] Rotate the historical Sentry DSN and Aptabase app key. Configure the
  replacement build values in Actions secrets as described in the
  [README](../README.md#release-build-configuration). Source externalization
  and workflow wiring do not prove rotation or backend receipt of events.
- [ ] Run the redacted full-history secret scan on the rewritten publication
  refs. Verify the checks actually execute before changing visibility.

## Changes already merged

These entries confirm source changes, not a new end-to-end runtime test.

| Requirement | Merged work and current evidence |
| --- | --- |
| App and SDK license files, contribution and security guidance | [#218](https://github.com/Frogbyte-io/dot-x/pull/218), [#221](https://github.com/Frogbyte-io/dot-x/pull/221). Root `LICENSE`, SDK `LICENSE`, MIT package metadata and community files exist. The EULA remains a separate gate above. |
| Embedded values externalized | [#215](https://github.com/Frogbyte-io/dot-x/pull/215). `.env.example`, ignored local env files and optional Rust build configuration exist. Rotation remains unverified. |
| Secret-scanning CI | [#225](https://github.com/Frogbyte-io/dot-x/pull/225). `.github/workflows/secret-scanning.yml` scans history with Gitleaks. |
| Deno and generated schemas untracked, bundled Deno notice | [#213](https://github.com/Frogbyte-io/dot-x/pull/213), [#228](https://github.com/Frogbyte-io/dot-x/pull/228). Build-time download and `src-tauri/licenses/NOTICE.txt` exist. Historical objects still require the rewrite. |
| Filesystem restriction and deduplication | [#214](https://github.com/Frogbyte-io/dot-x/pull/214). One filesystem scope, no unrestricted `**` entry, and `yarn check:capabilities` guards the configuration. |
| Marketplace integrity required on both install paths | [#212](https://github.com/Frogbyte-io/dot-x/pull/212). Both paths call `registry_entry_integrity_hash`; tests cover missing, empty and invalid values. |
| Plugin environment isolation and payload logging | [#237](https://github.com/Frogbyte-io/dot-x/pull/237), [#238](https://github.com/Frogbyte-io/dot-x/pull/238). Runtime clears inherited environment and supplies an allowlist. Frontend logs omit settings and event payloads. |
| Logging cleanup | [#227](https://github.com/Frogbyte-io/dot-x/pull/227). Frontend level-aware logger and Rust `log` calls replace debug output. |
| Telemetry documentation and controls | [#230](https://github.com/Frogbyte-io/dot-x/pull/230), [#236](https://github.com/Frogbyte-io/dot-x/pull/236). Crash minidumps disabled, documented telemetry and separate consent controls. |
| Dead code and comment cleanup | [#210](https://github.com/Frogbyte-io/dot-x/pull/210), [#211](https://github.com/Frogbyte-io/dot-x/pull/211). |
| SDK documentation paths, Cargo metadata and README | [#219](https://github.com/Frogbyte-io/dot-x/pull/219), [#226](https://github.com/Frogbyte-io/dot-x/pull/226), [#233](https://github.com/Frogbyte-io/dot-x/pull/233). |

## Release checks beyond repository publication

Windows code signing is tracked in
[#244](https://github.com/Frogbyte-io/dot-x/issues/244). Verify signed installers,
updater signatures and real installation/update paths before shipping. v1
clients still need the Anystack migration artifact described in the README.
Making the repository public does not by itself complete those release checks.
