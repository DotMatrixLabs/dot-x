import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { getDocsPaths, resolveDocsRoot } from './docs-paths.mjs';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createDocsRoot(name) {
  const directory = join(tmpdir(), `dotx-docs-${process.pid}-${name}`);
  mkdirSync(join(directory, 'docs'), { recursive: true });
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ name: 'dotmatrixlabs-docs' }),
  );
  temporaryDirectories.push(directory);
  return directory;
}

test('--docs-root takes precedence over DOTX_DOCS_ROOT', () => {
  const cliRoot = createDocsRoot('cli path with spaces');
  const environmentRoot = createDocsRoot('environment');

  assert.equal(
    resolveDocsRoot({
      args: ['--docs-root', cliRoot],
      env: { DOTX_DOCS_ROOT: environmentRoot },
    }),
    cliRoot,
  );
});

test('DOTX_DOCS_ROOT supplies the docs repository path', () => {
  const environmentRoot = createDocsRoot('environment path with spaces');

  assert.equal(
    resolveDocsRoot({ args: [], env: { DOTX_DOCS_ROOT: environmentRoot } }),
    environmentRoot,
  );
});

test('missing configuration explains how to provide the docs repository', () => {
  assert.throws(
    () => resolveDocsRoot({ args: [], env: {} }),
    /Pass --docs-root <path> or set DOTX_DOCS_ROOT/,
  );
});

test('a configured path must point to an existing directory', () => {
  const missingRoot = join(tmpdir(), `dotx-docs-${process.pid}-missing`);

  assert.throws(
    () => resolveDocsRoot({ args: ['--docs-root', missingRoot], env: {} }),
    /does not exist or is not a directory/,
  );
});

test('an existing directory must be a dotmatrixlabs-docs checkout', () => {
  const wrongRoot = join(tmpdir(), `dotx-docs-${process.pid}-wrong-repository`);
  mkdirSync(wrongRoot, { recursive: true });
  temporaryDirectories.push(wrongRoot);

  assert.throws(
    () => resolveDocsRoot({ args: ['--docs-root', wrongRoot], env: {} }),
    /is not a dotmatrixlabs-docs checkout/,
  );
  assert.deepEqual(readdirSync(wrongRoot), []);
});

test('generated files stay within the configured docs repository', () => {
  const docsRoot = createDocsRoot('outputs');

  assert.deepEqual(getDocsPaths(docsRoot), {
    markdown: join(docsRoot, 'docs', 'plugin-sdk', 'reference'),
    components: join(docsRoot, 'docs', '.vitepress', 'components'),
  });
});

for (const script of ['build-docs.mjs', 'generate-docs.mjs', 'sync-components.mjs']) {
  test(`${script} reports missing configuration without a stack trace`, () => {
    const { DOTX_DOCS_ROOT, ...env } = process.env;
    const result = spawnSync(process.execPath, [join(scriptsDirectory, script)], {
      env,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Pass --docs-root <path> or set DOTX_DOCS_ROOT/);
    assert.doesNotMatch(result.stderr, /^\s+at /m);
  });
}
