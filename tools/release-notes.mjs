// Copies a published release's body into the `notes` of its latest.json.
// Dot X shows the DOT_X_CONTENT part of those notes as the update changelog;
// the release body itself never reaches the app. Run by release-notes.yml.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { uploadVerified } from './release-assets.mjs';

const START = '<!-- DOT_X_CONTENT_START -->';
const END = '<!-- DOT_X_CONTENT_END -->';

// Mirrors extractDotXHtml() in src/ts/updater.ts: comment markers inside the
// section are stripped, so a section that only holds the template's commented
// example counts as empty.
export function hasDotXContent(body) {
  const start = body.indexOf(START), end = body.indexOf(END);
  if (start === -1 || end <= start) return false;
  return body.slice(start + START.length, end).replace(/<!--|-->/g, '').trim() !== ''
    && !body.slice(start, end).includes('### Feature Name');
}

export function withNotes(manifest, body) {
  return { ...manifest, notes: body };
}

async function main() {
  const repo = process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
  const tag = process.env.RELEASE_TAG;
  if (!repo || !tag?.startsWith('v')) throw new Error('GH_REPO/GITHUB_REPOSITORY and RELEASE_TAG are required');
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const release = JSON.parse(gh('release', 'view', tag, '-R', repo, '--json', 'body,isDraft,isPrerelease'));
  if (release.isDraft) return console.log(`${tag} is a draft; notes are copied when it is published.`);
  const body = release.body ?? '';
  if (!release.isPrerelease && !hasDotXContent(body)) {
    throw new Error(`${tag} has no filled-in DOT_X_CONTENT section, so Dot X would show no changelog. ` +
      'Fill it in from .github/RELEASE_TEMPLATE.md and save the release; this workflow runs again on edit.');
  }
  const root = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'dotx-release-notes-'));
  gh('release', 'download', tag, '-R', repo, '--pattern', 'latest.json', '--dir', root);
  const file = join(root, 'latest.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.notes === body) return console.log(`latest.json for ${tag} already has these notes.`);
  writeFileSync(file, JSON.stringify(withNotes(manifest, body), null, 2) + '\n');
  const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
  await uploadVerified(
    () => gh('release', 'upload', tag, file, '-R', repo, '--clobber'),
    () => {
      const download = mkdtempSync(join(root, 'verify-'));
      try {
        gh('release', 'download', tag, '-R', repo, '--pattern', 'latest.json', '--dir', download);
        return createHash('sha256').update(readFileSync(join(download, 'latest.json'))).digest('hex') === digest;
      } catch { return false; }
    });
  console.log(`Copied the ${tag} release notes into latest.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
