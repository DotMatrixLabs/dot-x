# Dot X releases

Dot X's updater reads `latest.json` from the latest published GitHub Release. The release workflow builds a Windows NSIS installer and its Tauri-signed updater bundle from a `v<version>` tag on `v2`. It leaves the release as a draft for review.

## Before the first GitHub-hosted update

- Make this repository public and publish a stable release containing `latest.json` before shipping a build that uses the GitHub endpoint. Installed apps cannot download release metadata or assets from a private repository without GitHub credentials.
- Add the `TAURI_SIGNING_PRIVATE_KEY` Actions secret. It must match the public updater key in `src-tauri/tauri.conf.json`. Add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has a password. Tauri requires an updater signature even when the Windows installer is not Authenticode-signed.
- Plan a final Anystack-served update for existing installations. Apps already installed with the Anystack endpoint cannot learn the new endpoint until they receive a build containing it. If the current updater private key is unavailable, that migration needs a separate path.
- Resolve the release-facing legal text before publication. The bundled EULA still names Anystack; #191 and #192 track the broader legal review.

Windows Authenticode signing is deferred to #244. The draft workflow currently produces an unsigned Windows installer with a Tauri-signed updater bundle.

## Prepare a release

1. Merge the intended changes into `v2` and set the same version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`.
2. Tag that `v2` commit as `v<version>` and push the tag. The workflow rejects tags outside `v2` or with a version mismatch.
3. Review the draft release. Confirm it contains the NSIS installer, `.nsis.zip`, `.nsis.zip.sig`, and `latest.json`. The workflow checks that the Windows x64 metadata refers to the bundle on that tag.
4. Publish the draft after release review. Publishing makes `latest.json` available to the updater.
5. Exercise an update from an older installed version. Check the resulting app version and that settings and mappings remain intact. Update the website download link and changelog content from `.github/RELEASE_TEMPLATE.md` only after that check passes.

Tags with a prerelease suffix create GitHub prereleases. The stable updater endpoint uses GitHub's latest published release. User selection of Beta/Nightly updates remains in #117.
