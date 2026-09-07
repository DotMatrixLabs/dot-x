import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function readDocsRootArgument(args) {
  const argumentIndex = args.indexOf('--docs-root');
  if (argumentIndex === -1) {
    return undefined;
  }

  const value = args[argumentIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--docs-root requires a path.');
  }

  return value;
}

export function resolveDocsRoot({ args = process.argv.slice(2), env = process.env } = {}) {
  const configuredRoot = readDocsRootArgument(args) || env.DOTX_DOCS_ROOT;

  if (!configuredRoot) {
    throw new Error(
      'The DotMatrix Labs docs repository is required. Pass --docs-root <path> or set DOTX_DOCS_ROOT.',
    );
  }

  const docsRoot = resolve(configuredRoot);

  try {
    if (!statSync(docsRoot).isDirectory()) {
      throw new Error('not a directory');
    }
  } catch {
    throw new Error(`The configured docs root does not exist or is not a directory: ${docsRoot}`);
  }

  try {
    const manifest = JSON.parse(readFileSync(join(docsRoot, 'package.json'), 'utf8'));
    if (manifest.name !== 'dotmatrixlabs-docs' || !statSync(join(docsRoot, 'docs')).isDirectory()) {
      throw new Error('wrong repository');
    }
  } catch {
    throw new Error(`The configured docs root is not a dotmatrixlabs-docs checkout: ${docsRoot}`);
  }

  return docsRoot;
}

export function getDocsPaths(docsRoot) {
  return {
    markdown: join(docsRoot, 'docs', 'plugin-sdk', 'reference'),
    components: join(docsRoot, 'docs', '.vitepress', 'components'),
  };
}
