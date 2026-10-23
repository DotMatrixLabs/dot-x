#!/usr/bin/env node
// Writes src-tauri/licenses/js_licenses.json from the installed node_modules.
// npm-license-crawler can't do this: the "**/license-checker" resolution swaps its
// bundled license-checker fork for the upstream package, whose callback signature
// it doesn't understand, so it silently wrote an empty list.
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import checker from 'license-checker';

const outFile = 'src-tauri/licenses/js_licenses.json';

checker.init({ start: process.cwd(), excludePrivatePackages: true }, (error, packages) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }

  // Only license metadata ships; license-checker's path fields point into the build machine.
  const result = {};
  for (const key of Object.keys(packages).sort()) {
    const { licenses, repository, licenseFile } = packages[key];
    result[key] = { licenses };
    if (repository) {
      result[key].repository = repository;
      if (licenseFile) result[key].licenseUrl = `${repository}/raw/master/${basename(licenseFile)}`;
    }
  }

  const count = Object.keys(result).length;
  if (count === 0) {
    console.error('No JS packages found; refusing to write an empty license list.');
    process.exit(1);
  }
  writeFileSync(outFile, `${JSON.stringify(result, null, 4)}\n`);
  console.log(`Wrote ${count} JS package licenses to ${outFile}`);
});
