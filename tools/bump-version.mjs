import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const CARGO_TOML = resolve(ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_CONF = resolve(ROOT, 'src-tauri', 'tauri.conf.json');

/**
 * Parse a semver string like 1.2.3-4 into parts.
 */
function parseVersion(versionString) {
  const [core, prerelease = null] = versionString.split('-', 2);
  const parts = core.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid version format (expected major.minor.patch): ${versionString}`);
  }
  const [majorStr, minorStr, patchStr] = parts;
  const major = Number(majorStr);
  const minor = Number(minorStr);
  const patch = Number(patchStr);
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new Error(`Invalid version format: ${versionString}`);
  }
  return { major, minor, patch, prerelease };
}

function formatVersion({ major, minor, patch, prerelease }) {
  const base = `${major}.${minor}.${patch}`;
  return prerelease != null && prerelease !== '' ? `${base}-${prerelease}` : base;
}

function bumpPatch(ver) {
  return { major: ver.major, minor: ver.minor, patch: ver.patch + 1, prerelease: null };
}

function bumpMinor(ver) {
  return { major: ver.major, minor: ver.minor + 1, patch: 0, prerelease: null };
}

function bumpMajor(ver) {
  return { major: ver.major + 1, minor: 0, patch: 0, prerelease: null };
}

/**
 * Bump prerelease (aka "test") part.
 * - If there is an existing purely numeric prerelease, increment it.
 * - If there is an existing prerelease with trailing digits, increment those digits.
 * - If there is no prerelease, start with 1.
 */
function bumpPrerelease(ver) {
  if (!ver.prerelease) {
    return { ...ver, prerelease: '1' };
  }
  const pre = ver.prerelease;
  if (/^\d+$/.test(pre)) {
    return { ...ver, prerelease: String(Number(pre) + 1) };
  }
  const match = pre.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, head, num] = match;
    const next = String(Number(num) + 1);
    return { ...ver, prerelease: `${head}${next}` };
  }
  // No trailing digits, append .1
  return { ...ver, prerelease: `${pre}.1` };
}

function getArgMode(argv) {
  const modes = new Set();
  for (const arg of argv.slice(2)) {
    if (arg === '--patch') modes.add('patch');
    if (arg === '--minor') modes.add('minor');
    if (arg === '--major') modes.add('major');
    if (arg === '--test' || arg === '--prerelease') modes.add('prerelease');
  }
  if (modes.size === 0) return null;
  if (modes.size > 1) throw new Error('Specify only one of --major, --minor, --patch, --test/--prerelease');
  return [...modes][0];
}

async function readCurrentVersions() {
  const [cargoText, tauriText] = await Promise.all([
    readFile(CARGO_TOML, 'utf8'),
    readFile(TAURI_CONF, 'utf8'),
  ]);

  const cargoMatch = cargoText.match(/^version\s*=\s*"([^"]+)"/m);
  if (!cargoMatch) throw new Error('Could not find version in Cargo.toml');
  const cargoVersion = cargoMatch[1];

  const tauriMatch = tauriText.match(/"version"\s*:\s*"([^"]+)"/);
  if (!tauriMatch) throw new Error('Could not find version in tauri.conf.json');
  const tauriVersion = tauriMatch[1];

  if (cargoVersion !== tauriVersion) {
    console.warn(`Warning: Cargo.toml (${cargoVersion}) and tauri.conf.json (${tauriVersion}) differ. Using Cargo.toml as source of truth.`);
  }

  return { cargoText, tauriText, version: cargoVersion };
}

function applyVersionToCargo(cargoText, newVersion) {
  return cargoText.replace(/^version\s*=\s*"([^"]+)"/m, `version = "${newVersion}"`);
}

function applyVersionToTauri(tauriText, newVersion) {
  // Replace only the first occurrence of "version": "..."
  let replaced = false;
  const result = tauriText.replace(/("version"\s*:\s*")([^"]+)(")/, (m, p1, _v, p3) => {
    if (replaced) return m;
    replaced = true;
    return `${p1}${newVersion}${p3}`;
  });
  if (!replaced) throw new Error('Failed to update version in tauri.conf.json');
  return result;
}

async function main() {
  const mode = getArgMode(process.argv);
  if (!mode) {
    console.error('Usage: yarn bump --major | --minor | --patch | --test');
    console.error('(Alias: --prerelease for --test)');
    process.exit(1);
  }

  const { cargoText, tauriText, version } = await readCurrentVersions();
  const parsed = parseVersion(version);

  let bumped;
  if (mode === 'major') bumped = bumpMajor(parsed);
  else if (mode === 'patch') bumped = bumpPatch(parsed);
  else if (mode === 'minor') bumped = bumpMinor(parsed);
  else if (mode === 'prerelease') bumped = bumpPrerelease(parsed);
  else throw new Error('Unknown mode');

  const newVersion = formatVersion(bumped);

  const [newCargo, newTauri] = [
    applyVersionToCargo(cargoText, newVersion),
    applyVersionToTauri(tauriText, newVersion),
  ];

  await Promise.all([
    writeFile(CARGO_TOML, newCargo, 'utf8'),
    writeFile(TAURI_CONF, newTauri, 'utf8'),
  ]);

  console.log(`Version bumped (${mode}) -> ${newVersion}`);
  console.log('Updated:');
  console.log(` - ${CARGO_TOML}`);
  console.log(` - ${TAURI_CONF}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});


