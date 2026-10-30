use std::path::PathBuf;

const COMPILE_TIME_KEYS: [&str; 2] = ["DOTX_SENTRY_DSN", "DOTX_APTABASE_KEY"];

fn main() {
    load_dotenv_files();

    for key in COMPILE_TIME_KEYS {
        if let Ok(value) = std::env::var(key) {
            let value = value.trim();
            if !value.is_empty() {
                println!("cargo:rustc-env={key}={value}");
            }
        }
        println!("cargo:rerun-if-env-changed={key}");
    }

    for path in dotenv_paths() {
        if let Some(path) = path {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }

    // On Linux: verify that the soup-3.0 pkg-config module is visible.
    // Ubuntu 24.04 ships it as libsoup-3.0 instead of soup-3.0; the alias
    // .pc file in src-tauri/pkgconfig/ (wired via .cargo/config.toml) bridges
    // that gap automatically for clean environments. If it's still missing,
    // print an actionable error rather than letting soup3-sys fail cryptically.
    #[cfg(target_os = "linux")]
    check_linux_pkgconfig();

    tauri_build::build()
}

fn dotenv_paths() -> Vec<Option<PathBuf>> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok().map(PathBuf::from);
    let repo_root = manifest_dir
        .as_ref()
        .and_then(|dir| dir.parent())
        .map(|parent| parent.join(".env"));
    let crate_root = manifest_dir.map(|dir| dir.join(".env"));
    vec![repo_root, crate_root]
}

fn load_dotenv_files() {
    for path in dotenv_paths().into_iter().flatten() {
        let Ok(contents) = std::fs::read_to_string(&path) else {
            continue;
        };
        for line in contents.lines() {
            let Some((key, value)) = parse_env_line(line) else {
                continue;
            };
            if std::env::var_os(&key).is_none() {
                unsafe { std::env::set_var(&key, value) };
            }
        }
    }
}

fn parse_env_line(line: &str) -> Option<(String, String)> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    let (key, value) = line.split_once('=')?;
    let key = key.trim().to_string();
    let mut value = value.trim().to_string();
    if value.len() >= 2
        && ((value.starts_with('"') && value.ends_with('"'))
            || (value.starts_with('\'') && value.ends_with('\'')))
    {
        value = value[1..value.len() - 1].to_string();
    }
    if key.is_empty() || value.is_empty() {
        return None;
    }
    Some((key, value))
}

#[cfg(target_os = "linux")]
fn check_linux_pkgconfig() {
    use std::process::Command;

    let soup_found = Command::new("pkg-config")
        .args(["--exists", "soup-3.0"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    if !soup_found {
        // Check whether libsoup-3.0-dev is at least installed under the Ubuntu name.
        let libsoup_found = Command::new("pkg-config")
            .args(["--exists", "libsoup-3.0"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);

        if libsoup_found {
            println!(
                "cargo::warning=soup-3.0 not found by pkg-config, but libsoup-3.0 is \
                 present (Ubuntu 24.04 naming). The alias in src-tauri/pkgconfig/ \
                 should fix this automatically via PKG_CONFIG_PATH in .cargo/config.toml. \
                 If the build still fails, run: \
                 sudo ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/libsoup-3.0.pc \
                 /usr/lib/x86_64-linux-gnu/pkgconfig/soup-3.0.pc"
            );
        } else {
            println!(
                "cargo::warning=soup-3.0 not found by pkg-config. \
                 Install libsoup-3.0-dev: sudo apt-get install libsoup-3.0-dev \
                 (run scripts/install-linux-deps.sh to install all build dependencies)"
            );
        }
    }
}
