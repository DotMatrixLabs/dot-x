import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  betaNotes, betaVersion, changeTitles, changelogEntry, latestBetaSource, mergedPullsInRange, setReleaseVersion,
} from './beta-release.mjs';
import { hasDotXContent } from './release-notes.mjs';
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

test('conventional commit types pick the changelog section', () => {
  assert.deepEqual(changelogEntry('feat(plugins): start plugins right after install (#263)'),
    { section: 'New Features', text: 'Start plugins right after install (#263)' });
  assert.deepEqual(changelogEntry('fix: upgrade tauri so a second dot x launch always exits'),
    { section: 'Bug Fixes', text: 'Upgrade tauri so a second Dot X launch always exits' });
  assert.equal(changelogEntry('perf(audio): skip idle sessions').section, 'Improvements');
  assert.equal(changelogEntry('Add a tray icon').section, 'Improvements');
  for (const hidden of ['chore: bump vite', 'docs: fix typo', 'fix(build): sign betas', 'feat(ci): cache rust',
    'refactor: split decker.rs', 'Merge pull request #275 from x/y', '']) {
    assert.equal(changelogEntry(hidden), null, hidden);
  }
});

test('merge commits take their PR title', () => {
  const pulls = [{ number: 275, title: 'fix(device): reconnect after sleep', merge_commit_sha: 'm' }];
  assert.deepEqual(changeTitles([{ sha: 'm', subject: 'Merge pull request #275 from x/y' },
    { sha: 'd', subject: 'feat: direct commit' }], pulls), ['fix(device): reconnect after sleep (#275)', 'feat: direct commit']);
});

test('beta notes follow the DOT_X_CONTENT format', () => {
  const notes = betaNotes(['fix: b', 'chore: hidden', 'feat: a', 'fix: c'], 'abc');
  assert.equal(notes, '<!-- DOT_X_CONTENT_START -->\n## New Features\n\n- A\n\n## Bug Fixes\n\n- B\n- C\n' +
    '<!-- DOT_X_CONTENT_END -->\n\n---\n\nAutomated beta from main commit abc.\n');
  assert.equal(hasDotXContent(notes), true);
  assert.equal(hasDotXContent(betaNotes(['chore: only tooling'], 'abc')), true);
});
