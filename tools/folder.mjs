#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Dynamic paths using environment variables
function getBuildPath() {
  return path.resolve(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'msi');
}

function getAppDataPath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'com.dot-x.dev');
}

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
    const buildPath = getBuildPath();
    if (!existsSync(buildPath)) {
      console.error(`Build folder does not exist: ${buildPath}`);
      process.exit(1);
    }
    openFolder(buildPath);
    return;
  }

  const appDataPath = getAppDataPath();
  if (!existsSync(appDataPath)) {
    console.error(`AppData folder does not exist: ${appDataPath}`);
    process.exit(1);
  }
  openFolder(appDataPath);
}

main();
