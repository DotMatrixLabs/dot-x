use std::time::Duration;

use semver::Version;
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

const RELEASES_API: &str = "https://api.github.com/repos/Frogbyte-io/dot-x/releases?per_page=100";

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

#[tauri::command]
pub async fn install_beta_update(app: AppHandle) -> Result<Option<String>, String> {
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
    let updater = app
        .updater_builder()
        .endpoints(vec![manifest])
        .map_err(|error| error.to_string())?
        .build()
        .map_err(|error| error.to_string())?;
    let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
        return Ok(None);
    };

    let version = update.version.clone();
    let progress_app = app.clone();
    let finish_app = app.clone();
    let mut downloaded = 0_u64;
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                let _ = progress_app.emit("app-update-progress", json!({
                    "downloaded": downloaded,
                    "total": total,
                }));
            },
            move || {
                let _ = finish_app.emit("app-update-downloaded", ());
            },
        )
        .await
        .map_err(|error| error.to_string())?;
    Ok(Some(version))
}
