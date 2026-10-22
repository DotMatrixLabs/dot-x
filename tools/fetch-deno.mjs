import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// The plugin runtime spawns Deno, so the archive is bundled as a Tauri resource
// and extracted on first launch. It is fetched here instead of committed because
// it is 44 MB and would otherwise land in git history on every version bump.
//
// To move to a new Deno release, update the version and every archive checksum. The published checksum
// lives next to the archive on the release page:
// https://github.com/denoland/deno/releases/download/v<version>/<archive>.sha256sum
const DENO_VERSION = '2.4.5';
const ARCHIVES = {
  win32: {
    name: 'deno-x86_64-pc-windows-msvc.zip',
    sha256: '9d89dd28951e4176a8c7643dc98401757e1ff0f83585f25921496195b3669c08',
  },
  linux: {
    name: 'deno-x86_64-unknown-linux-gnu.zip',
    sha256: '6f9d8115bb3df582c0c5674507e906323b680be0f0b15e735d0cd5ec6be44444',
  },
};

const archive = ARCHIVES[process.platform];
if (!archive) {
  console.error(`No bundled Deno archive is configured for ${process.platform}.`);
  process.exit(1);
}
const ARCHIVE_NAME = archive.name;
const ARCHIVE_SHA256 = archive.sha256;
const ARCHIVE_URL = `https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/${ARCHIVE_NAME}`;

const ROOT = resolve(process.cwd());
const TARGET_DIR = resolve(ROOT, 'src-tauri', 'resources', 'deno');
const TARGET = resolve(TARGET_DIR, ARCHIVE_NAME);
const DOWNLOAD_TMP = `${TARGET}.download`;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * True when the archive is already on disk with the expected contents.
 */
async function isUpToDate() {
  try {
    return sha256(await readFile(TARGET)) === ARCHIVE_SHA256;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function download() {
  const response = await fetch(ARCHIVE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download ${ARCHIVE_URL}: ${response.status} ${response.statusText}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  const actual = sha256(body);
  if (actual !== ARCHIVE_SHA256) {
    throw new Error(
      `Checksum mismatch for ${ARCHIVE_NAME}\n  expected ${ARCHIVE_SHA256}\n  actual   ${actual}`
    );
  }

  // Write to a temporary name first so an interrupted download cannot leave a
  // truncated archive that later runs would treat as present.
  await writeFile(DOWNLOAD_TMP, body);
  await rename(DOWNLOAD_TMP, TARGET);
}

async function main() {
  await mkdir(TARGET_DIR, { recursive: true });

  if (await isUpToDate()) {
    console.log(`Deno ${DENO_VERSION} runtime already present.`);
    return;
  }

  console.log(`Downloading Deno ${DENO_VERSION} runtime...`);
  try {
    await download();
  } finally {
    await rm(DOWNLOAD_TMP, { force: true });
  }
  console.log(`Saved ${TARGET}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
