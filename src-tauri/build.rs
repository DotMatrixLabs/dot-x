fn main() {
    // On Linux: verify that the soup-3.0 pkg-config module is visible.
    // Ubuntu 24.04 ships it as libsoup-3.0 instead of soup-3.0; the alias
    // .pc file in src-tauri/pkgconfig/ (wired via .cargo/config.toml) bridges
    // that gap automatically for clean environments. If it's still missing,
    // print an actionable error rather than letting soup3-sys fail cryptically.
    #[cfg(target_os = "linux")]
    check_linux_pkgconfig();

    tauri_build::build()
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
