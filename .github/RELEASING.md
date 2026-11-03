# Dot X releases

Dot X's updater reads `latest.json` from the latest published GitHub Release. The release workflow builds a Windows NSIS installer and its Tauri-signed updater bundle from a `v<version>` tag on `main`, then adds a Linux `.deb` and AppImage built on Ubuntu 24.04. It leaves the release as a draft for review.

## Before the first GitHub-hosted update

- Make this repository public and publish a stable release containing `latest.json` before shipping a build that uses the GitHub endpoint. Installed apps cannot download release metadata or assets from a private repository without GitHub credentials. Until then both update tracks fail: Stable cannot fetch `latest.json`, and Beta/Nightly gets a 404 from the releases API. Settings > About shows "Update check failed".
- Add the `TAURI_SIGNING_PRIVATE_KEY` Actions secret. It must match the public updater key in `src-tauri/tauri.conf.json`. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has a password. Tauri requires an updater signature even when the Windows installer is not Authenticode-signed.
- Plan a final Anystack-served update for existing installations. Apps already installed with the Anystack endpoint cannot learn the new endpoint until they receive a build containing it. If the current updater private key is unavailable, that migration needs a separate path.
- Official binaries use GPL-3.0-or-later, matching the app source. The installer displays `src-tauri/licenses/GPL-3.0.txt`. Before publishing a binary, provide its corresponding source and build instructions, including required dependency sources, alongside the installer. #191 tracks the remaining publication gates.

Windows Authenticode signing is deferred to #244. The draft workflow currently produces an unsigned Windows installer with a Tauri-signed updater bundle.

Building and uploading are separate steps. `tools/release-assets.mjs` verifies
Windows updater signatures before upload, then checks each uploaded asset by
downloading it and comparing SHA-256 hashes. If GitHub stores an asset but returns
an error, matching remote bytes count as success. Otherwise the entire replace
and upload operation is retried, up to four attempts, without rebuilding the app.

## 2.0 signing-key migration

2.0.0 embeds only the new public updater key, identifier `85C0179C61673E1`, and
uses GitHub Releases for subsequent updates. 1.3.0 embeds the previous key,
identifier `56C5CAF345DF2C71`, and checks Anystack. Publishing on GitHub alone
does not reach those installed copies.

The new private key and password are stored in the repository's
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` Actions
secrets. The local migration checkout keeps them in ignored `.env`, with the
previous credentials in ignored `.env.updater-previous`. Keep both files private.
Tauri's signing CLI does not load these files automatically. Export the selected
credentials into the signing process; existing system variables may still hold
the previous pair. Never use a `VITE_` name for signing credentials.

Prepare two signatures for the same Windows 2.0 updater bundle:

- GitHub's `latest.json` and bundle `.sig` must use the new key. They must match
  the public key embedded in 2.0, as the release workflow checks.
- The copy served to 1.x by Anystack must use a separate signature made with the
  previous key. Signing the package with that key lets 1.x install it; the
  installed 2.0 still trusts only the new key. Keep this signature separate from
  GitHub's `.sig`, and retain the signed bridge for users who upgrade later.

Before publishing 2.0 or making the repository public:

1. Exercise a real 1.3.0 MSI installation updating through Anystack to the 2.0
   NSIS bundle with the previous-key signature. Check installer compatibility,
   settings, mappings, plugins, startup, and the device connection.
2. Confirm the installed 2.0 checks GitHub, accepts a subsequent test update
   signed with the new key, and rejects an update signed only with the previous
   key. A signature smoke test alone does not prove installation works.
3. Verify stable and Beta/Nightly release selection and anonymous downloads.
   Keep publication and repository visibility changes for the coordinated
   release after these tests. Do not publish a test update as the stable latest.
4. Finish the historical secret cleanup, including GitHub's retained PR refs and
   cached commit views. Other contributors must clean or replace their old
   clones before pushing, or they can restore the removed history.

Nightly beta publishing is disabled while this migration is being tested. Leave
it disabled until the signing configuration and rollout are ready and the stable
`v2.0.0` tag exists. Otherwise nightly selection starts at `2.0.1-beta.*`. These changes
prepare 2.0; they do not authorize a release or visibility change.

## Prepare a release

1. Merge the intended changes into `main` and set the same version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
2. Tag that `main` commit as `v<version>` and push the tag. The workflow rejects tags outside `main` or with a version mismatch.
3. Review the draft release. Confirm it contains the NSIS installer, `.nsis.zip`, `.nsis.zip.sig`, the Linux `.deb`, `.AppImage`, `.AppImage.sig`, and `latest.json`. The workflow checks that the Windows x64 metadata refers to the bundle on that tag and that the `linux-x86_64` entry is signed with the bundled updater key.
4. Publish the draft after release review. Publishing makes `latest.json` available to the updater.
5. Exercise an update from an older installed version. Check the resulting app version and that settings and mappings remain intact. Update the website download link and changelog content from `.github/RELEASE_TEMPLATE.md` only after that check passes.

Tags with a prerelease suffix create GitHub prereleases. Stable is the default update track and uses GitHub's latest published stable release. Users can opt into Beta/Nightly in Settings > About. That track checks published releases for the highest semantic version with a `latest.json` asset, including stable releases and GitHub prereleases. Drafts are never offered. Publish prereleases only after reviewing their updater assets and version order.

## Nightly beta releases

The beta-release.yml workflow runs at 02:17 UTC every night. It builds when a PR
merged into main after the source commit of the last published nightly beta.
Failed or draft releases do not advance the baseline. Manual runs can enable
force to build without a newly merged PR.

Each run creates a v<version>-beta.<UTC timestamp>.<attempt> tag with matching
Tauri, Cargo and lockfile versions. This version commit exists only on the tag;
main is not bumped, and nor is the version: main at 2.0.0 produces 2.0.0 betas
until someone changes the version on main.

Windows and Linux builds must both pass before automatic publication. Releases
are marked prerelease and explicitly excluded from latest. Only the Beta/Nightly
update track offers them. The workflow does not publish to Anystack.

Windows installers have no Authenticode signature yet. Updater artifacts use the
configured signing secrets and must match the public updater key in that build.

While the repo is private, download the installer from GitHub while signed in
and install manually. Anonymous in-app beta checks cannot access private releases.

## Linux

The `linux` job runs after the Windows job, builds with `yarn build:linux`, signs the repacked AppImage (see `LINUX-SUPPORT.md`), uploads the `.deb` and AppImage, and adds a `linux-x86_64` entry to the draft's `latest.json`. The `.deb` is offered as a download only. Linux builds still skip update checks (`linuxUpdatesDisabled()` in `src/ts/updater.ts`); remove that once an AppImage update has been exercised from one published release to the next.
