import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function betaVersion(current, timestamp, attempt) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?$/.exec(current);
  if (!match || !/^\d{14}$/.test(timestamp) || !/^[1-9]\d*$/.test(attempt)) {
    throw new Error('Invalid beta version inputs');
  }
  const [, major, minor, patch, prerelease] = match;
  return `${major}.${minor}.${prerelease ? patch : Number(patch) + 1}-beta.${timestamp}.${attempt}`;
}

export function latestBetaSource(releases) {
  const published = releases.filter(r => !r.draft && r.prerelease &&
    /<!-- dotx-beta-source:[a-f0-9]{40} -->/.test(r.body || ''));
  published.sort((a, b) => b.published_at.localeCompare(a.published_at));
  return published[0]?.body.match(/<!-- dotx-beta-source:([a-f0-9]{40}) -->/)[1] || null;
}

export function mergedPullsInRange(pulls, commits) {
  const included = new Set(commits);
  return pulls.filter(p => p.merged_at && included.has(p.merge_commit_sha));
}

export function setReleaseVersion(root, version) {
  if (!/^\d+\.\d+\.\d+-beta\.\d{14}\.[1-9]\d*$/.test(version)) {
    throw new Error('Expected a managed beta version');
  }
  const configPath = join(root, 'src-tauri/tauri.conf.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.version = version;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  for (const file of ['Cargo.toml', 'Cargo.lock']) {
    const path = join(root, 'src-tauri', file);
    const source = readFileSync(path, 'utf8');
    const pattern = file === 'Cargo.toml'
      ? /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(" ?)/
      : /(\[\[package\]\]\r?\nname = "dot_x"\r?\nversion = ")[^"]+(")/;
    if (!pattern.test(source)) throw new Error(`App version missing from ${file}`);
    writeFileSync(path, source.replace(pattern, (_, before, after) => before + version + after));
  }
}

function prepare() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const apiPages = endpoint => JSON.parse(execFileSync('gh',
    ['api', '--paginate', '--slurp', endpoint], { encoding: 'utf8', maxBuffer: 30_000_000 })).flat();
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !process.env.GITHUB_OUTPUT) throw new Error('Run from GitHub Actions');
  const source = git('rev-parse', 'HEAD');
  const releases = apiPages(`repos/${repo}/releases?per_page=100`);
  const baseline = latestBetaSource(releases);
  if (baseline && process.env.FORCE_BETA !== 'true') {
    git('merge-base', '--is-ancestor', baseline, source);
  }
  const commits = git('rev-list', ...(baseline && process.env.FORCE_BETA !== 'true'
    ? [`${baseline}..${source}`] : [source])).split('\n');
  const pulls = mergedPullsInRange(apiPages(`repos/${repo}/pulls?state=closed&base=main&per_page=100`), commits);
  if (!pulls.length && process.env.FORCE_BETA !== 'true') {
    appendFileSync(process.env.GITHUB_OUTPUT, 'build=false\n');
    console.log('No newly merged PRs since the last published beta.');
    return;
  }
  const current = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const version = betaVersion(current, timestamp, process.env.GITHUB_RUN_ATTEMPT);
  const tag = `v${version}`;
  setReleaseVersion(process.cwd(), version);
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('add', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock');
  git('commit', '-m', `chore: prepare beta ${version}`);
  git('tag', tag);
  // GITHUB_TOKEN tag pushes do not start another tag-triggered workflow.
  git('push', 'origin', `refs/tags/${tag}`);
  appendFileSync(process.env.GITHUB_OUTPUT, `build=true\ntag=${tag}\nsource_sha=${source}\n`);
  console.log(`Prepared ${tag} from ${source}; merged PRs: ${pulls.map(p => '#' + p.number).join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) prepare();
