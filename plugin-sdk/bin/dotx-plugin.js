#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

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

function readJsonIfExists(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return readJson(absolutePath, label);
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
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const manifest = readJson(manifestPath, 'manifest.json');
  const packageJson = readJsonIfExists(packageJsonPath, 'package.json');

  return {
    manifest,
    manifestPath,
    packageJson,
    packageJsonPath,
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

  if (manifest.main !== 'main.js') {
    throw new Error(
      `Marketplace packaging currently requires manifest.json to set "main" to "main.js". Found: ${manifest.main}`
    );
  }

  if (packageJson && packageJson.version !== manifest.version) {
    throw new Error(
      `package.json version (${packageJson.version}) must match manifest.json version (${manifest.version})`
    );
  }
}

function getExplicitIncludePaths(manifest, packageJson) {
  const includedPaths = new Set();
  const warnings = [];

  const manifestInclude = manifest.packaging && manifest.packaging.include;
  if (manifestInclude !== undefined) {
    ensureArrayOfNonEmptyStrings(manifestInclude, 'manifest.json packaging.include');
    for (const includePath of manifestInclude) {
      includedPaths.add(
        normalizeProjectRelativePath(includePath, 'manifest.json packaging.include')
      );
    }
  }

  const legacyInclude = packageJson && packageJson.dotxPlugin && packageJson.dotxPlugin.include;
  if (legacyInclude !== undefined) {
    ensureArrayOfNonEmptyStrings(legacyInclude, 'package.json dotxPlugin.include');
    warnings.push(
      'package.json dotxPlugin.include is deprecated. Move packaging paths to manifest.json -> packaging.include.'
    );
    for (const includePath of legacyInclude) {
      includedPaths.add(
        normalizeProjectRelativePath(includePath, 'package.json dotxPlugin.include')
      );
    }
  }

  return {
    includedPaths: [...includedPaths],
    warnings,
  };
}

function runPackage() {
  const { manifest, packageJson } = loadProjectMetadata();
  validateMarketplaceManifest(manifest, packageJson);

  const mainJsPath = path.join(repoRoot, 'main.js');
  if (!fs.existsSync(mainJsPath)) {
    throw new Error('main.js not found. Run the build step before packaging.');
  }

  const distDir = path.join(repoRoot, 'dist');
  const stageDir = path.join(distDir, 'package');
  const zipPath = path.join(distDir, 'plugin.zip');

  fs.mkdirSync(distDir, { recursive: true });
  ensureCleanDir(stageDir);
  fs.rmSync(zipPath, { force: true });

  copyRecursive(path.join(repoRoot, 'manifest.json'), path.join(stageDir, 'manifest.json'));
  copyRecursive(mainJsPath, path.join(stageDir, 'main.js'));

  const { includedPaths, warnings } = getExplicitIncludePaths(manifest, packageJson);

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
  zip.writeZip(zipPath);

  for (const warning of warnings) {
    console.warn(warning);
  }

  console.log(`Created ${path.relative(repoRoot, zipPath)}`);
}

function runVerifyRelease() {
  const { manifest, packageJson } = loadProjectMetadata();
  validateMarketplaceManifest(manifest, packageJson);

  const releaseTag = process.env.RELEASE_TAG || '';
  if (releaseTag) {
    const acceptedTags = new Set([manifest.version, `v${manifest.version}`]);
    if (!acceptedTags.has(releaseTag)) {
      throw new Error(
        `Release tag ${releaseTag} must match ${manifest.version} or v${manifest.version}`
      );
    }
  }

  console.log(`Verified release version ${manifest.version}`);
}

function printUsage() {
  console.log(`Usage: dotx-plugin <command>

Commands:
  package           Build dist/plugin.zip from manifest.json and main.js
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
