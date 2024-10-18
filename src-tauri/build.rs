use rustc_version::{version, Version};
use std::process::exit;

fn main() {
    if version().unwrap() > Version::parse("1.75.0").unwrap() {
        println!("This crate requires rustc 1.75.0.");
        println!("Please install using `rustup install 1.75.0` and run `rustup override set 1.75.0` to build Dot X.");
        exit(1);
    }
    tauri_build::build()
}
