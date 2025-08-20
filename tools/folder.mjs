#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Absolute paths as requested
const BUILD_PATH = 'D:/dot-x/src-tauri/target/release/bundle/msi';
const APPDATA_PATH = 'C:/Users/ananords/AppData/Roaming/com.dot-x.dev';

function openFolder(targetPath) {
  const normalized = targetPath.replace(/\//g, '\\');
  execSync(`cmd /c start "" "${normalized}"`, { stdio: 'ignore', windowsHide: true });
}

function main() {
  const args = process.argv.slice(2);
  const hasBuild = args.includes('--build');
  const hasData = args.includes('--data');

  if ((hasBuild && hasData) || (!hasBuild && !hasData)) {
    console.error('Usage: yarn folder --build | --data');
    process.exit(1);
  }

  if (hasBuild) {
    if (!existsSync(BUILD_PATH)) {
      console.error(`Build folder does not exist: ${BUILD_PATH}`);
      process.exit(1);
    }
    openFolder(BUILD_PATH);
    return;
  }

  if (!existsSync(APPDATA_PATH)) {
    console.error(`AppData folder does not exist: ${APPDATA_PATH}`);
    process.exit(1);
  }
  openFolder(APPDATA_PATH);
}

main();
