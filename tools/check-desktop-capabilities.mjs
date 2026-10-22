import { readFileSync } from 'node:fs';

const capabilityPath = new URL('../src-tauri/capabilities/desktop.json', import.meta.url);
const capability = JSON.parse(readFileSync(capabilityPath, 'utf8'));
const permissions = capability.permissions ?? [];
const permissionNames = permissions.filter((permission) => typeof permission === 'string');
const duplicatePermissions = permissionNames.filter(
  (permission, index) => permissionNames.indexOf(permission) !== index,
);
const filesystemScopes = permissions.filter(
  (permission) => typeof permission === 'object' && permission?.identifier === 'fs:scope',
);

if (duplicatePermissions.length > 0) {
  throw new Error(`Duplicate permissions: ${[...new Set(duplicatePermissions)].join(', ')}`);
}

if (filesystemScopes.length !== 1) {
  throw new Error(`Expected one fs:scope permission, found ${filesystemScopes.length}`);
}

if (filesystemScopes[0].allow?.includes('**')) {
  throw new Error('Filesystem scope must not allow the global ** wildcard');
}
