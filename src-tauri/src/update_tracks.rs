use std::sync::Mutex;
use std::time::Duration;

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const RELEASES_API: &str = "https://api.github.com/repos/DotMatrixLabs/dot-x/releases?per_page=100";

/// The beta update found by the last `check_beta_update`. `install_beta_update` installs this one.
#[derive(Default)]
pub struct PendingBetaUpdate(Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct BetaUpdate {
    version: String,
    body: Option<String>,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    assets: Vec<ReleaseAsset>,
}

#[derive(Deserialize)]
struct ReleaseAsset {
    name: String,
    browser_download_url: String,
}

fn newest_update_manifest(releases: Vec<Release>) -> Option<tauri::Url> {
    releases
        .into_iter()
        .filter(|release| !release.draft)
        .filter_map(|release| {
            let version = Version::parse(release.tag_name.strip_prefix('v')?).ok()?;
            if release.prerelease != !version.pre.is_empty() {
                return None;
            }
            let url = release.assets.into_iter()
                .find(|asset| asset.name == "latest.json")?
                .browser_download_url;
            let parsed = url.parse::<tauri::Url>().ok()?;
            if parsed.scheme() != "https" || parsed.host_str() != Some("github.com") {
                return None;
            }
            Some((version, parsed))
        })
        .max_by(|(a, _), (b, _)| a.cmp(b))
        .map(|(_, url)| url)
}

async fn find_beta_update(app: &AppHandle) -> Result<Option<Update>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Dot-X-Updater")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| error.to_string())?;
    let releases = client
        .get(RELEASES_API)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<Vec<Release>>()
        .await
        .map_err(|error| error.to_string())?;

    let Some(manifest) = newest_update_manifest(releases) else {
        return Ok(None);
    };
    app.updater_builder()
        .endpoints(vec![manifest])
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn check_beta_update(
    app: AppHandle,
    pending: State<'_, PendingBetaUpdate>,
) -> Result<Option<BetaUpdate>, String> {
    *pending.0.lock().unwrap() = None;
    let update = find_beta_update(&app)
        .await
        .inspect_err(|error| log::error!("Beta update check failed: {error}"))?;
    let found = update.as_ref().map(|update| BetaUpdate {
        version: update.version.clone(),
        body: update.body.clone(),
    });
    *pending.0.lock().unwrap() = update;
    Ok(found)
}

#[tauri::command]
pub async fn install_beta_update(pending: State<'_, PendingBetaUpdate>) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .unwrap()
        .clone()
        .ok_or("No beta update to install, check for updates first")?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, prerelease: bool, manifest_url: Option<&str>) -> Release {
        Release {
            tag_name: tag.to_string(),
            draft: false,
            prerelease,
            assets: manifest_url
                .map(|url| ReleaseAsset {
                    name: "latest.json".to_string(),
                    browser_download_url: url.to_string(),
                })
                .into_iter()
                .collect(),
        }
    }

    fn manifest(tag: &str) -> String {
        format!("https://github.com/DotMatrixLabs/dot-x/releases/download/{tag}/latest.json")
    }

    #[test]
    fn picks_highest_semver_across_stable_and_prerelease() {
        let releases = vec![
            release("v2.0.0", false, Some(&manifest("v2.0.0"))),
            release("v2.1.0-beta.2", true, Some(&manifest("v2.1.0-beta.2"))),
            release("v2.1.0-beta.10", true, Some(&manifest("v2.1.0-beta.10"))),
        ];
        assert_eq!(
            newest_update_manifest(releases).unwrap().as_str(),
            manifest("v2.1.0-beta.10")
        );
    }

    #[test]
    fn stable_release_beats_its_own_prerelease() {
        let releases = vec![
            release("v2.1.0-beta.1", true, Some(&manifest("v2.1.0-beta.1"))),
            release("v2.1.0", false, Some(&manifest("v2.1.0"))),
        ];
        assert_eq!(newest_update_manifest(releases).unwrap().as_str(), manifest("v2.1.0"));
    }

    #[test]
    fn skips_drafts_missing_manifests_and_mismatched_prerelease_flags() {
        let mut draft = release("v9.0.0", false, Some(&manifest("v9.0.0")));
        draft.draft = true;
        let releases = vec![
            draft,
            release("v8.0.0", false, None),
            release("v7.0.0-beta.1", false, Some(&manifest("v7.0.0-beta.1"))),
            release("v6.0.0", true, Some(&manifest("v6.0.0"))),
            release("not-a-version", false, Some(&manifest("not-a-version"))),
            release("v1.0.0", false, Some(&manifest("v1.0.0"))),
        ];
        assert_eq!(newest_update_manifest(releases).unwrap().as_str(), manifest("v1.0.0"));
    }

    #[test]
    fn rejects_manifests_outside_https_github() {
        let releases = vec![
            release("v3.0.0", false, Some("http://github.com/DotMatrixLabs/dot-x/latest.json")),
            release("v2.0.0", false, Some("https://evil.example/latest.json")),
            release("v1.0.0", false, Some("https://github.com.evil.example/latest.json")),
        ];
        assert!(newest_update_manifest(releases).is_none());
    }
}
