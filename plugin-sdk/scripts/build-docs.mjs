#!/usr/bin/env node

/**
 * Master documentation build script
 * 
 * This script orchestrates the complete documentation generation process:
 * 1. Generates markdown from TypeDoc (ui.ts -> settingsbuilder-components.md)
 * 2. Syncs Vue components and generates demo wrappers
 * 
 * Usage: node build-docs.mjs --docs-root <path> [--skip-typedoc]
 */

import { execFileSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { getDocsPaths, resolveDocsRoot } from './docs-paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const skipTypedoc = args.includes('--skip-typedoc');
const docsRoot = resolveDocsRoot({ args });
const docsPaths = getDocsPaths(docsRoot);

console.log('📚 Building Plugin SDK Documentation\n');
console.log('=' .repeat(50));

// Step 1: Generate markdown from TypeDoc
if (!skipTypedoc) {
  console.log('\n📝 Step 1: Generating markdown from TypeDoc...');
  console.log('-'.repeat(50));
  
  try {
    execFileSync(process.execPath, ['generate-docs.mjs', '--docs-root', docsRoot], {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('❌ Failed to generate docs from TypeDoc');
    process.exit(1);
  }
} else {
  console.log('\n⏭️  Step 1: Skipping TypeDoc generation (--skip-typedoc)');
}

// Step 2: Sync Vue components and generate demos
console.log('\n🔄 Step 2: Syncing Vue components and generating demos...');
console.log('-'.repeat(50));

try {
  execFileSync(process.execPath, ['sync-components.mjs', '--docs-root', docsRoot], {
    cwd: __dirname,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('❌ Failed to sync components');
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ Documentation build complete!\n');
console.log('📂 Output locations:');
console.log(`   Markdown: ${docsPaths.markdown}`);
console.log(`   Components: ${docsPaths.components}`);
console.log('\n💡 Next steps:');
console.log(`   cd "${docsRoot}"`);
console.log('   npm run docs:dev');
console.log();


