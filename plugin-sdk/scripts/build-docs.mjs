#!/usr/bin/env node

/**
 * Master documentation build script
 * 
 * This script orchestrates the complete documentation generation process:
 * 1. Generates markdown from TypeDoc (ui.ts -> settingsbuilder-components.md)
 * 2. Syncs Vue components and generates demo wrappers
 * 
 * Usage: node build-docs.mjs [--skip-typedoc]
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const skipTypedoc = args.includes('--skip-typedoc');

console.log('📚 Building Plugin SDK Documentation\n');
console.log('=' .repeat(50));

// Step 1: Generate markdown from TypeDoc
if (!skipTypedoc) {
  console.log('\n📝 Step 1: Generating markdown from TypeDoc...');
  console.log('-'.repeat(50));
  
  try {
    execSync('node generate-docs.mjs', {
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
  execSync('node sync-components.mjs', {
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
console.log('   Markdown: D:\\dotmatrixlabs-docs\\docs\\plugin-sdk\\reference\\');
console.log('   Components: D:\\dotmatrixlabs-docs\\docs\\.vitepress\\components\\');
console.log('\n💡 Next steps:');
console.log('   cd ../../../dotmatrixlabs-docs');
console.log('   npm run docs:dev');
console.log();


