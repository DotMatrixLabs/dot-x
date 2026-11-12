# Dot X releases

Dot X's updater reads `latest.json` from the latest published GitHub Release. The release workflow builds a Windows NSIS installer and its Tauri-signed updater bundle from a `v<version>` tag on `main`, then adds a Linux `.deb` and AppImage built on Ubuntu 24.04. It leaves the release as a draft for review.

## Windows signing

Windows release builds are Authenticode-signed on the self-hosted signer that the release job reaches over the tailnet (`tools/sign-windows.ps1`). The updater bundle is then signed with the Tauri updater key from the `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` Actions secrets, which must match the public key in `src-tauri/tauri.conf.json`.

Building and uploading are separate steps. `tools/release-assets.mjs` verifies
Windows updater signatures before upload, then checks each uploaded asset by
downloading it and comparing SHA-256 hashes. If GitHub stores an asset but returns
an error, matching remote bytes count as success. Otherwise the entire replace
and upload operation is retried, up to four attempts, without rebuilding the app.

Official binaries use GPL-3.0-or-later, matching the app source. The installer displays `src-tauri/licenses/GPL-3.0.txt`.

## 2.0 rollout

1.3.0 is a Tauri 1 app installed from an MSI. It checks Anystack and trusts only
the previous updater key, `56C5CAF345DF2C71`. 2.0 checks GitHub Releases and
trusts only the new key, `85C0179C61673E1`. Neither version can update the
other's way, so 2.0 reaches users by two routes:

- **Beta testers** download a 2.0 beta installer from GitHub and run it over
  1.3.0. The NSIS installer replaces the MSI install and keeps settings, since
  both use the `com.dot-x.dev` identifier. A beta build saves the Beta track on
  its first run (`getUpdateTrack()` in `src/ts/updater.ts`), so testers get
  later betas and then 2.0.0 without touching Settings. Betas never go to
  Anystack and never need the previous key. It does not matter when a tester
  joins; they install whatever beta is newest.
- **Everyone else** gets stable 2.0.0 through Anystack, signed with the previous
  key. After that update they are on 2.0's Stable track and check GitHub.

In-app updates need anonymous access to GitHub Releases, so the repository must
be public before testers can update in place. Order:

1. Make the repository public. Check that `latest.json` and the installer of the
   newest beta download without signing in.
2. Send testers the newest beta installer from the Releases page.
3. When 2.0.0 is ready, tag `v2.0.0`, review the draft, and publish it on GitHub
   first, so it is GitHub's latest stable release with `latest.json`.
4. Then sign the same `.nsis.zip` with the previous key (below) and publish it
   on Anystack. If Anystack shipped first, upgraded users would check GitHub
   and find only 1.3.0, which has no `latest.json`.
5. Update a real 1.3.0 install through Anystack. Check the version, settings,
   mappings, plugins, autostart, and the device connection. Keep the Anystack
   update published for users who upgrade later.

### Signing the Anystack copy with the previous key

The previous key is not in CI and should not be added. Keep the key and its
password in the password manager. `tauri signer sign` reads
`TAURI_PRIVATE_KEY` and `TAURI_PRIVATE_KEY_PASSWORD` (not the
`TAURI_SIGNING_*` names `tauri build` uses) and writes `<file>.sig` next to
the file, so sign a copy in its own folder to keep GitHub's `.sig` intact:

```powershell
New-Item -ItemType Directory -Force "$env:TEMPdotx-anystack" | Out-Null
gh release download v2.0.0 -R DotMatrixLabs/dot-x -p "*.nsis.zip" -D "$env:TEMPdotx-anystack"
$env:TAURI_PRIVATE_KEY = '<previous key>'; $env:TAURI_PRIVATE_KEY_PASSWORD = '<previous password>'
yarn tauri signer sign (Get-ChildItem "$env:TEMPdotx-anystack*.nsis.zip").FullName
Remove-Item Env:TAURI_PRIVATE_KEY, Env:TAURI_PRIVATE_KEY_PASSWORD
```

Check the result against 1.3.0's public key before uploading:

```powershell
git show v1.3.0:src-tauri/tauri.conf.json | node --input-type=module -e "const {verifyUpdaterSignature}=await import('./tools/release-assets.mjs');const fs=await import('node:fs');const pub=JSON.parse(fs.readFileSync(0,'utf8')).tauri.updater.pubkey;const z=fs.globSync(process.env.TEMP+'/dotx-anystack/*.nsis.zip')[0];verifyUpdaterSignature(fs.readFileSync(z),fs.readFileSync(z+'.sig','utf8'),pub);console.log('accepted by 1.3.0')"
```

Do not keep updater keys in Windows environment variables; every process on the
machine can read them, and `tauri signer sign` silently picks them up.

## Prepare a release

1. Merge the intended changes into `main` and set the same version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
2. Tag that `main` commit as `v<version>` and push the tag. The workflow rejects tags outside `main` or with a version mismatch.
3. Review the draft release. Confirm it contains the NSIS installer, `.nsis.zip`, `.nsis.zip.sig`, the Linux `.deb`, `.AppImage`, `.AppImage.sig`, and `latest.json`. The workflow checks that the Windows x64 metadata refers to the bundle on that tag and that the `linux-x86_64` entry is signed with the bundled updater key.
4. Publish the draft after release review. Publishing makes `latest.json` available to the updater.
5. Exercise an update from an older installed version. Check the resulting app version and that settings and mappings remain intact. Update the website download link and changelog content from `.github/RELEASE_TEMPLATE.md` only after that check passes.

Tags with a prerelease suffix create GitHub prereleases. Stable is the default update track and uses GitHub's latest published stable release. A beta build saves the Beta track on its first run; anyone can switch tracks in Settings > About. The Beta track checks published releases for the highest semantic version with a `latest.json` asset, including stable releases and GitHub prereleases. Drafts are never offered. Publish prereleases only after reviewing their updater assets and version order.

## Nightly beta releases

The beta-release.yml workflow runs at 02:17 UTC every night. It builds when a PR
merged into main after the source commit of the last published nightly beta.
Failed or draft releases do not advance the baseline. Manual runs can enable
force to build without a newly merged PR.

Each run creates a v<version>-beta.<N> tag with matching Tauri, Cargo and
lockfile versions. N is one more than the highest existing v<version>-beta.<N>
tag, so it restarts at 1 when main's version changes. A failed run still uses up
its number. This version commit exists only on the tag;
main is not bumped, and nor is the version: main at 2.0.0 produces 2.0.0 betas
until someone changes the version on main.

Windows and Linux builds must both pass before automatic publication. Releases
are marked prerelease and explicitly excluded from latest. Only the Beta/Nightly
update track offers them. The workflow does not publish to Anystack.

Updater artifacts use the configured signing secrets and must match the public
updater key in that build.

## Linux

The `linux` job runs after the Windows job, builds with `yarn build:linux`, signs the repacked AppImage (see `LINUX-SUPPORT.md`), uploads the `.deb` and AppImage, and adds a `linux-x86_64` entry to the draft's `latest.json`. The `.deb` is offered as a download only. Linux builds still skip update checks (`linuxUpdatesDisabled()` in `src/ts/updater.ts`); remove that once an AppImage update has been exercised from one published release to the next.
