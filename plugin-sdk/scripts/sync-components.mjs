#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDocsPaths, resolveDocsRootOrExit } from './docs-paths.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DOT_X_FIELDS = path.resolve(__dirname, '../../src/components/fields');
const DOCS_ROOT = resolveDocsRootOrExit();
const DOCS_VITEPRESS = path.join(DOCS_ROOT, 'docs/.vitepress');
const DOCS_COMPONENTS = getDocsPaths(DOCS_ROOT).components;
const DOCS_COMPONENTS_FIELDS = path.join(DOCS_COMPONENTS, 'fields');
const DOCS_COMPONENTS_DEMOS = path.join(DOCS_COMPONENTS, 'demos');

console.log('🔄 Syncing Vue components from dot-x to docs...\n');

// Ensure output directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
}

ensureDir(DOCS_COMPONENTS_FIELDS);
ensureDir(DOCS_COMPONENTS_DEMOS);

// Read and parse the registry to get component mappings
function parseRegistry() {
  const registryPath = path.join(DOT_X_FIELDS, 'registry.ts');
  const registryContent = fs.readFileSync(registryPath, 'utf-8');
  
  // Extract component imports
  const importRegex = /import\s+(\w+)\s+from\s+['"]\.\/(\w+\.vue)['"]/g;
  const componentFiles = new Map();
  let match;
  
  while ((match = importRegex.exec(registryContent)) !== null) {
    const [, componentName, fileName] = match;
    componentFiles.set(componentName, fileName);
  }
  
  // Extract registry mappings
  const registryRegex = /(\w+):\s*(\w+),?/g;
  const registry = {};
  const registryMatch = registryContent.match(/export const componentRegistry[^{]*\{([^}]+)\}/s);
  
  if (registryMatch) {
    const registryBody = registryMatch[1];
    let keyMatch;
    while ((keyMatch = registryRegex.exec(registryBody)) !== null) {
      const [, key, componentName] = keyMatch;
      if (componentFiles.has(componentName)) {
        registry[key] = {
          componentName,
          fileName: componentFiles.get(componentName)
        };
      }
    }
  }
  
  return { registry, componentFiles };
}

// Read and parse metadata - convert TypeScript to JavaScript and import it
async function parseMetadata() {
  const metadataPath = path.join(DOT_X_FIELDS, 'metadata.ts');
  const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
  
  // Convert TypeScript to JavaScript by removing type annotations and export statement
  const jsContent = metadataContent
    .replace(/export const/g, 'const')
    .replace(/export type[^;]+;/g, '');
  
  // Write temporary .mjs file
  const tempPath = path.join(__dirname, '../temp-metadata-sync.mjs');
  fs.writeFileSync(tempPath, jsContent + '\nexport { COMPONENT_METADATA };');
  
  try {
    // Dynamic import of the temporary module
    const metadataModule = await import(`file://${tempPath}`);
    
    // Clean up temp file
    fs.unlinkSync(tempPath);
    
    return metadataModule.COMPONENT_METADATA;
  } catch (e) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error('Error importing metadata:', e.message);
    throw e;
  }
}

// Copy Vue component files and their dependencies
function copyComponentFiles(componentFiles) {
  const copiedFiles = new Set();
  const filesToCopy = new Set(componentFiles.values());
  
  // Also find all imported .vue files from components
  for (const fileName of Array.from(filesToCopy)) {
    const sourcePath = path.join(DOT_X_FIELDS, fileName);
    if (fs.existsSync(sourcePath)) {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      // Find all .vue imports
      const importRegex = /import\s+\w+\s+from\s+['"]\.\/(\w+\.vue)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        filesToCopy.add(match[1]);
      }
    }
  }
  
  // Copy all files
  for (const fileName of filesToCopy) {
    const sourcePath = path.join(DOT_X_FIELDS, fileName);
    const destPath = path.join(DOCS_COMPONENTS_FIELDS, fileName);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      copiedFiles.add(fileName);
      console.log(`📄 Copied: ${fileName}`);
    } else {
      console.warn(`⚠️  Warning: ${fileName} not found`);
    }
  }
  
  return copiedFiles;
}

// Generate props string for Vue template
function generatePropsString(props) {
  const lines = [];
  
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    
    if (typeof value === 'string') {
      lines.push(`    ${key}="${value}"`);
    } else if (typeof value === 'boolean') {
      if (value) {
        lines.push(`    :${key}="true"`);
      }
    } else if (typeof value === 'number') {
      lines.push(`    :${key}="${value}"`);
    } else if (Array.isArray(value)) {
      const jsonValue = JSON.stringify(value).replace(/"/g, "'");
      lines.push(`    :${key}="${jsonValue}"`);
    } else if (typeof value === 'object') {
      const jsonValue = JSON.stringify(value).replace(/"/g, "'");
      lines.push(`    :${key}="${jsonValue}"`);
    }
  }
  
  return lines.join('\n');
}

// Generate demo wrapper components
function generateDemoComponents(metadata, registry) {
  let demoCount = 0;
  
  for (const [metadataKey, metadataEntry] of Object.entries(metadata)) {
    const { registryKey, baseProps = {}, docs } = metadataEntry;
    
    if (!docs || !docs.examples) continue;
    
    const registryEntry = registry[registryKey];
    if (!registryEntry) {
      console.warn(`⚠️  Warning: Registry key "${registryKey}" not found for metadata "${metadataKey}"`);
      continue;
    }
    
    const componentFileName = registryEntry.fileName.replace('.vue', '');
    
    for (const [exampleName, exampleProps] of Object.entries(docs.examples)) {
      // Merge baseProps with example props
      const mergedProps = { ...baseProps, ...exampleProps };
      
      // Generate kebab-case component name
      const demoComponentName = `${metadataKey.replace(/_/g, '-')}-${exampleName.replace(/_/g, '-')}`;
      const demoFileName = `Demo${metadataKey.charAt(0).toUpperCase() + metadataKey.slice(1).replace(/_(.)/g, (_, c) => c.toUpperCase())}${exampleName.charAt(0).toUpperCase() + exampleName.slice(1).replace(/-(.)/g, (_, c) => c.toUpperCase())}.vue`;
      
      const propsString = generatePropsString(mergedProps);
      
      const demoContent = `<script setup>
import ${componentFileName} from '../fields/${registryEntry.fileName}';
</script>

<template>
  <div class="demo-wrapper">
    <${componentFileName}
${propsString}
    />
  </div>
</template>

<style scoped>
.demo-wrapper {
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  margin: 0.5rem 0;
}
</style>
`;
      
      const demoPath = path.join(DOCS_COMPONENTS_DEMOS, demoFileName);
      fs.writeFileSync(demoPath, demoContent);
      demoCount++;
      console.log(`✨ Generated demo: ${demoFileName} (${demoComponentName})`);
    }
  }
  
  return demoCount;
}

// Generate VitePress theme file with component registrations
function generateThemeFile(metadata, registry) {
  const imports = [];
  const registrations = [];
  
  for (const [metadataKey, metadataEntry] of Object.entries(metadata)) {
    const { registryKey, docs } = metadataEntry;
    
    if (!docs || !docs.examples) continue;
    
    const registryEntry = registry[registryKey];
    if (!registryEntry) continue;
    
    for (const exampleName of Object.keys(docs.examples)) {
      // PascalCase component name
      const componentName = `Demo${metadataKey.charAt(0).toUpperCase() + metadataKey.slice(1).replace(/_(.)/g, (_, c) => c.toUpperCase())}${exampleName.charAt(0).toUpperCase() + exampleName.slice(1).replace(/-(.)/g, (_, c) => c.toUpperCase())}`;
      
      // kebab-case tag name
      const tagName = `demo-${metadataKey.replace(/_/g, '-')}-${exampleName.replace(/_/g, '-')}`;
      
      imports.push(`import ${componentName} from '../components/demos/${componentName}.vue'`);
      registrations.push(`    app.component('${tagName}', ${componentName})`);
    }
  }
  
  const themeContent = `// .vitepress/theme/index.ts
// Auto-generated by sync-components.mjs - DO NOT EDIT MANUALLY
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style.css'

// Import all demo components
${imports.join('\n')}

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  enhanceApp({ app, router, siteData }) {
    // Register demo components globally
${registrations.join('\n')}
  }
} satisfies Theme
`;
  
  const themePath = path.join(DOCS_VITEPRESS, 'theme/index.ts');
  ensureDir(path.dirname(themePath));
  fs.writeFileSync(themePath, themeContent);
  console.log(`📝 Generated theme file with ${registrations.length} components`);
}

// Main execution (async)
(async () => {
  try {
    console.log('📖 Parsing registry.ts...');
    const { registry, componentFiles } = parseRegistry();
    console.log(`   Found ${componentFiles.size} component files\n`);
    
    console.log('📖 Parsing metadata.ts...');
    const metadata = await parseMetadata();
    console.log(`   Found ${Object.keys(metadata).length} metadata entries\n`);
    
    console.log('📋 Copying component files...');
    const copiedFiles = copyComponentFiles(componentFiles);
    console.log(`   Copied ${copiedFiles.size} files\n`);
    
    console.log('✨ Generating demo components...');
    const demoCount = generateDemoComponents(metadata, registry);
    console.log(`   Generated ${demoCount} demo components\n`);
    
    console.log('🎨 Generating VitePress theme...');
    generateThemeFile(metadata, registry);
    console.log();
    
    console.log('✅ Sync complete!\n');
  } catch (error) {
    console.error('❌ Error during sync:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

