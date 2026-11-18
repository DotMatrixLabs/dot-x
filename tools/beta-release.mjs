import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function betaVersion(current, tags) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?$/.exec(current);
  if (!match) throw new Error('Invalid beta version inputs');
  // Nightlies keep main's version: fixes before a release are betas of that release.
  const base = match.slice(1, 4).join('.');
  // Count every pushed tag, not just published releases, so a re-run after a
  // failed build takes the next number instead of colliding with its tag.
  const prefix = `v${base}-beta.`;
  const taken = tags.filter(tag => tag.startsWith(prefix))
    .map(tag => tag.slice(prefix.length)).filter(n => /^[1-9]\d*$/.test(n)).map(Number);
  return `${base}-beta.${Math.max(0, ...taken) + 1}`;
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

// The lines a PR author wrote for users under `## Changelog` in the PR body
// (see .github/PULL_REQUEST_TEMPLATE.md). Empty, missing or "none" means the
// PR stays out of the in-app changelog.
export function changelogLines(body) {
  const section = /^##[ \t]+Changelog[ \t]*$([\s\S]*?)(?=^##[ \t]|(?![\s\S]))/mi.exec((body || '').replace(/\r\n/g, '\n'));
  if (!section) return [];
  const lines = section[1].replace(/<!--[\s\S]*?-->/g, '').split('\n')
    .map(line => line.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean);
  return lines.length === 1 && /^none\.?$/i.test(lines[0]) ? [] : lines;
}

// The PR title's conventional commit type picks the section; any other type
// with changelog lines (a dependency bump that fixes a crash) is an improvement.
const SECTIONS = { feat: 'New Features', perf: 'Improvements', fix: 'Bug Fixes' };

// The release body of a nightly beta, in the DOT_X_CONTENT format of
// .github/RELEASE_TEMPLATE.md. Dot X shows only the changelog lines; the full
// PR list sits below the divider for testers reading the GitHub release.
export function betaNotes(pulls, source) {
  const sections = new Map([...new Set(Object.values(SECTIONS))].map(name => [name, []]));
  for (const pull of pulls) {
    const section = SECTIONS[/^(\w+)/.exec(pull.title)?.[1]] || 'Improvements';
    sections.get(section).push(...changelogLines(pull.body));
  }
  const content = [...sections].filter(([, items]) => items.length)
    .map(([name, items]) => `## ${name}\n\n${items.map(item => `- ${item}`).join('\n')}`).join('\n\n')
    || '## Improvements\n\n- Behind-the-scenes maintenance.';
  const merged = pulls.map(pull => `- ${pull.title} (#${pull.number})`).join('\n');
  return `<!-- DOT_X_CONTENT_START -->\n${content}\n<!-- DOT_X_CONTENT_END -->\n\n---\n\n` +
    `Automated beta from main commit ${source}.\n` + (merged ? `\n### Merged pull requests\n\n${merged}\n` : '');
}

export function setReleaseVersion(root, version) {
  if (!/^\d+\.\d+\.\d+-beta\.[1-9]\d*$/.test(version)) {
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
  const onMain = sha => { try { git('merge-base', '--is-ancestor', sha, source); return true; } catch { return false; } };
  const sinceBaseline = Boolean(baseline) && onMain(baseline);
  if (baseline && !sinceBaseline && process.env.FORCE_BETA !== 'true') {
    throw new Error(`The last beta's source ${baseline} is not an ancestor of main.`);
  }
  const commits = git('rev-list', ...(sinceBaseline && process.env.FORCE_BETA !== 'true'
    ? [`${baseline}..${source}`] : [source])).split('\n');
  const closed = apiPages(`repos/${repo}/pulls?state=closed&base=main&per_page=100`);
  const pulls = mergedPullsInRange(closed, commits);
  if (!pulls.length && process.env.FORCE_BETA !== 'true') {
    appendFileSync(process.env.GITHUB_OUTPUT, 'build=false\n');
    console.log('No newly merged PRs since the last published beta.');
    return;
  }
  const current = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version;
  const tags = git('ls-remote', '--tags', '--refs', 'origin', 'v*-beta.*').split('\n')
    .filter(Boolean).map(line => line.split('refs/tags/')[1]);
  const version = betaVersion(current, tags);
  const tag = `v${version}`;
  setReleaseVersion(process.cwd(), version);
  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('add', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock');
  git('commit', '-m', `chore: prepare beta ${version}`);
  git('tag', tag);
  // GITHUB_TOKEN tag pushes do not start another tag-triggered workflow.
  git('push', 'origin', `refs/tags/${tag}`);
  // Notes cover the PRs since the last beta, even on a forced run. Without a
  // baseline on main there is no previous beta to list changes against.
  const notePulls = sinceBaseline
    ? mergedPullsInRange(closed, git('rev-list', `${baseline}..${source}`).split('\n')) : [];
  notePulls.sort((a, b) => b.merged_at.localeCompare(a.merged_at));
  const notes = betaNotes(notePulls, source);
  const eof = `DOTX_NOTES_${randomUUID()}`;
  appendFileSync(process.env.GITHUB_OUTPUT,
    `build=true\ntag=${tag}\nsource_sha=${source}\nnotes<<${eof}\n${notes}${eof}\n`);
  console.log(notes);
  console.log(`Prepared ${tag} from ${source}; merged PRs: ${pulls.map(p => '#' + p.number).join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) prepare();
