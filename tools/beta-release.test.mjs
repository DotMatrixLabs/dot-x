import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaVersion, latestBetaSource, mergedPullsInRange, setReleaseVersion } from './beta-release.mjs';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('betas target the current prerelease core or the next patch after a stable version', () => {
  assert.equal(betaVersion('2.0.0-1', '20261030150000', '1'), '2.0.0-beta.20261030150000.1');
  assert.equal(betaVersion('2.0.0', '20261030150000', '2'), '2.0.1-beta.20261030150000.2');
  assert.throws(() => betaVersion('invalid', '20261030150000', '1'));
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
  setReleaseVersion(root, '2.0.0-beta.20261030150000.1');
  assert.equal(JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'))).version, '2.0.0-beta.20261030150000.1');
  assert.match(readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8'), /version = "2.0.0-beta.20261030150000.1"/);
  assert.match(readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8'), /name = "serde"\nversion = "1.0.0"/);
});
