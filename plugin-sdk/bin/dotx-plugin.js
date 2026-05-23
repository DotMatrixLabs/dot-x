#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const defaultIncludePaths = ['assets', 'data', 'bin'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(absolutePath, label) {
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read ${label}: ${error.message}`);
  }
}

function ensureArrayOfNonEmptyStrings(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of non-empty strings`);
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error(`${fieldName} must contain only non-empty strings`);
    }
  }
}

function normalizeProjectRelativePath(relativePath, fieldName) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    throw new Error(`${fieldName} entries must be non-empty strings`);
  }

  const trimmed = relativePath.trim();
  if (path.isAbsolute(trimmed)) {
    throw new Error(`${fieldName} entries must be relative paths. Received: ${trimmed}`);
  }

  const resolvedPath = path.resolve(repoRoot, trimmed);
  const repoRelativePath = path.relative(repoRoot, resolvedPath);
  if (!repoRelativePath || repoRelativePath === '') {
    throw new Error(`${fieldName} entries must point to files or folders inside the plugin root`);
  }
  if (repoRelativePath.startsWith('..') || path.isAbsolute(repoRelativePath)) {
    throw new Error(`${fieldName} entries must stay inside the plugin root. Received: ${trimmed}`);
  }

  return repoRelativePath.split(path.sep).join('/');
}

function ensureExists(relativePath, fieldName) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${fieldName} path not found: ${relativePath}`);
  }

  return absolutePath;
}

function ensureCleanDir(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
  fs.mkdirSync(directoryPath, { recursive: true });
}

function copyRecursive(sourcePath, destinationPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(
        path.join(sourcePath, entry),
        path.join(destinationPath, entry)
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function loadProjectMetadata() {
  const manifest = readJson(path.join(repoRoot, 'manifest.json'), 'manifest.json');

  let packageJson = null;
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    packageJson = readJson(packageJsonPath, 'package.json');
  }

  return {
    manifest,
    packageJson,
  };
}

function validateMarketplaceManifest(manifest, packageJson) {
  if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
    throw new Error('manifest.json must include a non-empty string "id" field');
  }
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error('manifest.json must include a non-empty string "version" field');
  }
  if (typeof manifest.dotxVersion !== 'string' || !manifest.dotxVersion.trim()) {
    throw new Error('manifest.json must include a non-empty string "dotxVersion" field');
  }
  if (typeof manifest.main !== 'string' || !manifest.main.trim()) {
    throw new Error('manifest.json must include a non-empty string "main" field');
  }
  if (!Array.isArray(manifest.permissions)) {
    throw new Error('manifest.json must include a "permissions" array');
  }
  if (manifest.permissions.some((entry) => typeof entry !== 'string')) {
    throw new Error('manifest.json permissions must contain only strings');
  }

  if (packageJson !== null && packageJson.version !== manifest.version) {
    throw new Error(
      `package.json version (${packageJson.version}) must match manifest.json version (${manifest.version})`
    );
  }
}

function getManifestEntryPath(manifest) {
  return normalizeProjectRelativePath(manifest.main, 'manifest.json main');
}

function getExplicitIncludePaths(manifest) {
  const includedPaths = new Set();

  const manifestInclude = manifest.packaging && manifest.packaging.include;
  if (manifestInclude !== undefined) {
    ensureArrayOfNonEmptyStrings(manifestInclude, 'manifest.json packaging.include');
    for (const includePath of manifestInclude) {
      includedPaths.add(
        normalizeProjectRelativePath(includePath, 'manifest.json packaging.include')
      );
    }
  }

  return [...includedPaths];
}

function runPackage() {
  const AdmZip = require('adm-zip');
  const { manifest, packageJson } = loadProjectMetadata();
  validateMarketplaceManifest(manifest, packageJson);
  const entryPath = getManifestEntryPath(manifest);

  const entryAbsolutePath = ensureExists(entryPath, 'manifest.json main');

  const distDir = path.join(repoRoot, 'dist');
  const stageDir = path.join(distDir, 'package');
  const dotxPath = path.join(distDir, `${manifest.id}.dotxplugin`);

  fs.mkdirSync(distDir, { recursive: true });
  ensureCleanDir(stageDir);
  fs.rmSync(dotxPath, { force: true });

  copyRecursive(path.join(repoRoot, 'manifest.json'), path.join(stageDir, 'manifest.json'));
  copyRecursive(entryAbsolutePath, path.join(stageDir, entryPath));

  const includedPaths = getExplicitIncludePaths(manifest);

  for (const defaultPath of defaultIncludePaths) {
    const sourcePath = path.join(repoRoot, defaultPath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    copyRecursive(sourcePath, path.join(stageDir, defaultPath));
  }

  for (const relativePath of includedPaths) {
    const sourcePath = ensureExists(relativePath, 'Included');
    copyRecursive(sourcePath, path.join(stageDir, relativePath));
  }

  const zip = new AdmZip();
  zip.addLocalFolder(stageDir);
  zip.writeZip(dotxPath);

  console.log(`Created ${path.relative(repoRoot, dotxPath)}`);
}

function runVerifyRelease() {
  const { manifest, packageJson } = loadProjectMetadata();
  validateMarketplaceManifest(manifest, packageJson);

  const releaseTag = process.env.RELEASE_TAG || '';
  if (releaseTag) {
    const acceptedTags = new Set([manifest.version, `v${manifest.version}`]);
    if (!acceptedTags.has(releaseTag)) {
      throw new Error(
        `Release tag "${releaseTag}" does not match the version in manifest.json ("${manifest.version}"). ` +
        `Expected tag: "${manifest.version}" or "v${manifest.version}". ` +
        `Update manifest.json (and package.json if present) to match the release tag, or use the correct tag.`
      );
    }
  }

  console.log(`Verified release version ${manifest.version}`);
}

function printUsage() {
  console.log(`Usage: dotx-plugin <command>

Commands:
  package           Build dist/plugin.zip from manifest.json and the file in manifest.main
  verify-release    Validate manifest/package versions and optional RELEASE_TAG
`);
}

function main() {
  const command = process.argv[2];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printUsage();
    return;
  }

  if (command === 'package') {
    runPackage();
    return;
  }

  if (command === 'verify-release') {
    runVerifyRelease();
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  fail(error.message);
}
