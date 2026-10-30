import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function uploadVerified(upload, matches, delay = ms => new Promise(r => setTimeout(r, ms))) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { await upload(); } catch (error) { lastError = error; }
    // GitHub can finish writing the asset before its response fails. Check the
    // actual remote bytes before retrying a clobber/upload operation.
    if (await matches()) return;
    if (attempt < 3) await delay(1000 * 2 ** attempt);
  }
  throw new Error('Release asset could not be uploaded and verified after four attempts', { cause: lastError });
}

function signaturePacket(value) {
  const text = value.includes('untrusted comment:') ? value : Buffer.from(value.trim(), 'base64').toString('utf8');
  const line = text.split(/\r?\n/).find(l => /^[A-Za-z0-9+/=]{40,}$/.test(l));
  if (!line) throw new Error('Invalid updater signature/key format');
  return Buffer.from(line, 'base64');
}

export function verifyUpdaterSignature(bytes, signature, publicKey) {
  const pub = signaturePacket(publicKey), sig = signaturePacket(signature);
  if (pub.length !== 42 || sig.length !== 74 || !pub.subarray(2, 10).equals(sig.subarray(2, 10))) {
    throw new Error('Updater signature does not match the bundled public key');
  }
  const algorithm = sig.subarray(0, 2).toString();
  if (!['Ed', 'ED'].includes(algorithm)) throw new Error('Unsupported updater signature algorithm');
  const key = createPublicKey({ format: 'der', type: 'spki',
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub.subarray(10)]) });
  const message = algorithm === 'ED' ? createHash('blake2b512').update(bytes).digest() : bytes;
  if (!verify(null, message, key, sig.subarray(10))) throw new Error('Updater signature verification failed');
}

export function windowsManifest(repo, tag, signature, date = new Date().toISOString()) {
  const version = tag.slice(1);
  return { version, pub_date: date, platforms: { 'windows-x86_64': {
    signature,
    url: `https://github.com/${repo}/releases/download/${tag}/Dot.X_${version}_x64-setup.nsis.zip`,
  } } };
}

async function main() {
  const repo = process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
  const tag = process.env.RELEASE_TAG;
  if (!repo || !tag?.startsWith('v')) throw new Error('GH_REPO/GITHUB_REPOSITORY and RELEASE_TAG are required');
  const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let release;
  try { release = JSON.parse(gh('release', 'view', tag, '-R', repo, '--json', 'isDraft')); }
  catch {
    const args = ['release', 'create', tag, '-R', repo, '--verify-tag', '--draft', '--title', `Dot X ${tag}`];
    if (tag.includes('-')) args.push('--prerelease');
    try { gh(...args); } catch { /* A failed response may still have created the draft. */ }
    release = JSON.parse(gh('release', 'view', tag, '-R', repo, '--json', 'isDraft'));
  }
  if (!release.isDraft) throw new Error('Refusing to replace assets on a published release');
  const root = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'dotx-release-upload-'));
  let files;
  if (process.argv[2] === 'windows') {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    if (`v${config.version}` !== tag || config.productName !== 'Dot X') throw new Error('Release tag/product mismatch');
    const prefix = `Dot X_${config.version}_x64-setup`;
    const folder = 'src-tauri/target/release/bundle/nsis';
    files = ['.exe', '.exe.sig', '.nsis.zip', '.nsis.zip.sig'].map(ext => join(folder, prefix + ext));
    for (const ext of ['.exe', '.nsis.zip']) {
      verifyUpdaterSignature(readFileSync(join(folder, prefix + ext)),
        readFileSync(join(folder, prefix + ext + '.sig'), 'utf8'), config.plugins.updater.pubkey);
    }
    const signature = readFileSync(join(folder, prefix + '.nsis.zip.sig'), 'utf8').trim();
    const manifest = join(root, 'latest.json');
    writeFileSync(manifest, JSON.stringify(windowsManifest(repo, tag, signature), null, 2) + '\n');
    files.push(manifest);
  } else if (process.argv[2] === 'upload') {
    files = process.argv.slice(3);
    if (!files.length) throw new Error('No release assets supplied');
  } else throw new Error('Expected windows or upload mode');
  for (const file of files) {
    const name = basename(file).replaceAll(' ', '.');
    const staged = join(root, name);
    if (resolve(file) !== resolve(staged)) copyFileSync(file, staged);
    const digest = createHash('sha256').update(readFileSync(staged)).digest('hex');
    await uploadVerified(
      () => gh('release', 'upload', tag, staged, '-R', repo, '--clobber'),
      () => {
        const download = mkdtempSync(join(root, 'verify-'));
        try {
          gh('release', 'download', tag, '-R', repo, '--pattern', name, '--dir', download);
          return createHash('sha256').update(readFileSync(join(download, name))).digest('hex') === digest;
        } catch { return false; }
      });
    console.log(`Uploaded and verified ${name}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
