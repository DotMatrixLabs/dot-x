import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hasDotXContent, withNotes } from './release-notes.mjs';

const section = text => `<!-- DOT_X_CONTENT_START -->\n${text}\n<!-- DOT_X_CONTENT_END -->\n\n---\nWeb post`;

test('accepts a filled-in DOT_X_CONTENT section', () => {
  assert.equal(hasDotXContent(section('## New Features\n\n### Plugins\nControl more than volume.')), true);
});

test('rejects bodies without a usable DOT_X_CONTENT section', () => {
  assert.equal(hasDotXContent('Automated beta from main commit abc.'), false);
  assert.equal(hasDotXContent(section('')), false);
  assert.equal(hasDotXContent('<!-- DOT_X_CONTENT_END --> before <!-- DOT_X_CONTENT_START -->'), false);
});

test('rejects the unedited release template', () => {
  assert.equal(hasDotXContent(readFileSync(new URL('../.github/RELEASE_TEMPLATE.md', import.meta.url), 'utf8')), false);
  assert.equal(hasDotXContent(section('## New Features\n\n### Feature Name\nBrief description.')), false);
});

test('adds the body as notes and keeps the platforms', () => {
  const manifest = { version: '2.0.0', pub_date: 'd', platforms: { 'windows-x86_64': { url: 'u', signature: 's' } } };
  assert.deepEqual(withNotes(manifest, 'body'), { ...manifest, notes: 'body' });
});
