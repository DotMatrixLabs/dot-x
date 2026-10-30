import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { uploadVerified, verifyUpdaterSignature, windowsManifest } from './release-assets.mjs';

test('recovers when GitHub stores an asset but returns an upload error', async () => {
  let uploads = 0;
  await uploadVerified(async () => { uploads++; throw Error('Error updating policy'); }, async () => true, async () => {});
  assert.equal(uploads, 1);
});

test('retries the entire replace/upload when the remote bytes do not match', async () => {
  let uploads = 0;
  await uploadVerified(async () => { uploads++; if (uploads < 2) throw Error('server error'); },
    async () => uploads === 2, async () => {});
  assert.equal(uploads, 2);
});

test('fails rather than accepting missing or mismatched release assets', async () => {
  let uploads = 0;
  await assert.rejects(uploadVerified(async () => { uploads++; }, async () => false, async () => {}));
  assert.equal(uploads, 4);
});

test('validates updater signatures and rejects tampered installer bytes', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keyId = randomBytes(8);
  const rawPublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const message = Buffer.from('installer bytes');
  const packet = Buffer.concat([Buffer.from('Ed'), keyId, sign(null, message, privateKey)]);
  const publicPacket = Buffer.concat([Buffer.from('Ed'), keyId, rawPublic]);
  const text = p => Buffer.from(`untrusted comment: test\n${p.toString('base64')}\n`).toString('base64');
  verifyUpdaterSignature(message, text(packet), text(publicPacket));
  assert.throws(() => verifyUpdaterSignature(Buffer.from('tampered'), text(packet), text(publicPacket)));
});

test('Windows updater metadata uses the exact versioned release and signed zip', () => {
  const m = windowsManifest('DotMatrixLabs/dot-x', 'v2.0.0-beta.1', 'signature', '2026-10-30T00:00:00Z');
  assert.equal(m.version, '2.0.0-beta.1');
  assert.equal(m.platforms['windows-x86_64'].signature, 'signature');
  assert.equal(m.platforms['windows-x86_64'].url,
    'https://github.com/DotMatrixLabs/dot-x/releases/download/v2.0.0-beta.1/Dot.X_2.0.0-beta.1_x64-setup.nsis.zip');
});

test('accepts the prehashed minisign format used by updater tooling', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keyId = randomBytes(8);
  const rawPublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const message = Buffer.from('updater zip bytes');
  const digest = createHash('blake2b512').update(message).digest();
  const packet = Buffer.concat([Buffer.from('ED'), keyId, sign(null, digest, privateKey)]);
  const pub = Buffer.concat([Buffer.from('Ed'), keyId, rawPublic]);
  const text = p => Buffer.from(`untrusted comment: test\n${p.toString('base64')}\n`).toString('base64');
  verifyUpdaterSignature(message, text(packet), text(pub));
});
