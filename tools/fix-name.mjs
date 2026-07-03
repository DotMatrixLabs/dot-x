#!/usr/bin/env node

import { readFileSync, readdirSync, renameSync, rmSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

function readTauriVersion(rootDir) {
	const tauriConfPath = path.resolve(rootDir, 'src-tauri', 'tauri.conf.json');
	const text = readFileSync(tauriConfPath, 'utf8');
	const json = JSON.parse(text);
	const version = json && json.version;
	const productName = (json && json.productName) || 'Dot X';
	if (!version) {
		throw new Error(`Could not read version from ${tauriConfPath}`);
	}
	return { version, productName };
}

function computeOldBase(productName, version) {
	// NSIS naming, e.g. "Dot X_2.0.0-1_x64-setup.exe"
	return `${productName}_${version}_x64-setup`;
}

function renameBuildFiles(rootDir) {
	const nsisDir = path.resolve(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
	if (!existsSync(nsisDir) || !statSync(nsisDir).isDirectory()) {
		throw new Error(`Build folder not found: ${nsisDir}`);
	}

	const { version, productName } = readTauriVersion(rootDir);
	const oldBase = computeOldBase(productName, version);
	const newBase = 'dot-x.windows-x86_64';

	const entries = readdirSync(nsisDir, { withFileTypes: true });
	let renamedCount = 0;
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const name = entry.name;
		if (name === oldBase || name.startsWith(oldBase + '.')) {
			const suffix = name.slice(oldBase.length); // includes leading '.' if present
			const srcPath = path.join(nsisDir, name);
			const destName = newBase + suffix;
			const destPath = path.join(nsisDir, destName);

			if (existsSync(destPath)) {
				rmSync(destPath, { force: true });
			}
			renameSync(srcPath, destPath);
			renamedCount += 1;
			console.log(`Renamed: ${name} -> ${destName}`);
		}
	}

	if (renamedCount === 0) {
		console.warn(`No files matched base "${oldBase}" in ${nsisDir}`);
	} else {
		console.log(`Done. Renamed ${renamedCount} file(s).`);
	}

	// Open the build folder in Windows Explorer (only on Windows)
	if (process.platform === 'win32') {
		try {
			const normalized = nsisDir.replace(/\//g, '\\');
			execSync(`cmd /c start "" "${normalized}"`, { stdio: 'ignore', windowsHide: true });
		} catch {
			// Non-fatal if opening fails
		}
	}
}

function main() {
	const rootDir = process.cwd();
	try {
		renameBuildFiles(rootDir);
	} catch (err) {
		console.error(err.message || String(err));
		process.exit(1);
	}
}

main();
