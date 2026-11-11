import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaVersion, latestBetaSource, mergedPullsInRange, setReleaseVersion } from './beta-release.mjs';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('betas keep the version on main and count up from its existing beta tags', () => {
  assert.equal(betaVersion('2.0.0', []), '2.0.0-beta.1');
  assert.equal(betaVersion('2.0.0-1', ['v2.0.0-beta.1']), '2.0.0-beta.2');
  assert.equal(betaVersion('2.0.0', [
    'v2.0.0-beta.9', 'v2.0.0-beta.10', 'v2.0.0-beta.20261111092405.1', 'v2.1.0-beta.40', 'v1.3.0',
  ]), '2.0.0-beta.11');
  assert.equal(betaVersion('2.1.0', ['v2.0.0-beta.10']), '2.1.0-beta.1');
  assert.throws(() => betaVersion('invalid', []));
});

test('only a published managed beta advances the baseline', () => {
  const release = (sha, time, extra = {}) => ({ prerelease: true, draft: false,
    body: `<!-- dotx-beta-source:${sha} -->`, published_at: time, ...extra });
  const sha = 'a'.repeat(40);
  assert.equal(latestBetaSource([
    release('b'.repeat(40), '2026-10-30T05:00:00Z', { draft: true }),
    release('c'.repeat(40), '2026-10-30T04:00:00Z', { prerelease: false }),
    release(sha, '2026-10-30T03:00:00Z'),
    release('d'.repeat(40), '2026-10-29T03:00:00Z'),
  ]), sha);
  assert.equal(latestBetaSource([]), null);
});

test('only merged PRs whose merge commits are in the selected source range count', () => {
  const pulls = [
    { number: 1, merged_at: '2026-10-30', merge_commit_sha: 'new' },
    { number: 2, merged_at: null, merge_commit_sha: 'closed' },
    { number: 3, merged_at: '2026-10-29', merge_commit_sha: 'old' },
    { number: 4, merged_at: '2026-10-31', merge_commit_sha: 'future' },
  ];
  assert.deepEqual(mergedPullsInRange(pulls, ['new', 'closed']).map(p => p.number), [1]);
  assert.deepEqual(mergedPullsInRange(pulls, []), []);
});

test('release versions stay aligned without changing dependency versions', () => {
  const root = mkdtempSync(join(tmpdir(), 'dotx-beta-version-'));
  mkdirSync(join(root, 'src-tauri'));
  writeFileSync(join(root, 'src-tauri/tauri.conf.json'), JSON.stringify({ version: '2.0.0-1' }));
  writeFileSync(join(root, 'src-tauri/Cargo.toml'), '[package]\nname = "dot_x"\nversion = "2.0.0-1"\n\n[dependencies]\nserde = "1.0"\n');
  writeFileSync(join(root, 'src-tauri/Cargo.lock'), '[[package]]\nname = "dot_x"\nversion = "2.0.0-1"\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n');
  setReleaseVersion(root, '2.0.0-beta.3');
  assert.throws(() => setReleaseVersion(root, '2.0.0-beta.20261030150000.1'));
  assert.equal(JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'))).version, '2.0.0-beta.3');
  assert.match(readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8'), /version = "2.0.0-beta.3"/);
  assert.match(readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8'), /name = "serde"\nversion = "1.0.0"/);
});
