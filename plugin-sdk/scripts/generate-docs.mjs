#!/usr/bin/env node

/**
 * Documentation generator for DotX Plugin SDK
 * 
 * This script:
 * 1. Generates TypeDoc JSON output
 * 2. Parses documented items with TSDoc comments
 * 3. Groups items by @category tags
 * 4. Generates markdown files with frontmatter and tables
 * 
 * Usage: node generate-docs.mjs [output-dir]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const outputDir = process.argv[2] || resolve(__dirname, '../../dotmatrixlabs-docs/docs/plugin-sdk/reference');
const typedocConfigPath = resolve(__dirname, '../typedoc.json');
const tempJsonPath = resolve(__dirname, '../temp-typedoc.json');
const projectRoot = resolve(__dirname, '..');

console.log('📚 Generating DotX Plugin SDK Documentation...');
console.log(`   Output directory: ${outputDir}`);

// Ensure output directory exists
if (!existsSync(outputDir)) {
  console.log('   Creating output directory...');
  mkdirSync(outputDir, { recursive: true });
}

// ============================================================================
// PHASE 1: Generate TypeDoc JSON
// ============================================================================

console.log('\n🔧 Phase 1: Generating TypeDoc JSON...');

try {
  // Generate JSON output using TypeDoc
  execSync(`npx typedoc --json "${tempJsonPath}" --options "${typedocConfigPath}"`, {
    cwd: projectRoot,
    stdio: 'inherit'
  });
  console.log('   ✅ TypeDoc JSON generated');
} catch (error) {
  console.error('   ❌ Failed to generate TypeDoc JSON:', error.message);
  process.exit(1);
}

// ============================================================================
// PHASE 2: Parse and Filter TypeDoc JSON
// ============================================================================

console.log('\n🔍 Phase 2: Parsing TypeDoc JSON...');

const typedocData = JSON.parse(readFileSync(tempJsonPath, 'utf-8'));

/**
 * Extract tag value from comment tags
 */
function getTagValue(comment, tagName) {
  if (!comment?.blockTags) return null;
  const tag = comment.blockTags.find(t => t.tag === `@${tagName}`);
  if (!tag?.content) return null;
  // Extract text from content array
  return tag.content.map(c => c.text || '').join('').trim();
}

/**
 * Extract all tag values (for tags that can appear multiple times)
 */
function getAllTagValues(comment, tagName) {
  if (!comment?.blockTags) return [];
  return comment.blockTags
    .filter(t => t.tag === `@${tagName}`)
    .map(tag => tag.content.map(c => c.text || '').join('').trim())
    .filter(Boolean);
}

/**
 * Get description from comment
 */
function getDescription(comment) {
  if (!comment?.summary) return '';
  return comment.summary.map(part => part.text || '').join('').trim();
}

/**
 * Get code examples from comment
 */
function getExamples(comment) {
  if (!comment?.blockTags) return [];
  return comment.blockTags
    .filter(t => t.tag === '@example')
    .map(tag => {
      return tag.content.map(c => c.text || '').join('').trim();
    });
}

/**
 * Check if item has documentation
 */
function isDocumented(item) {
  if (!item.comment) return false;
  const description = getDescription(item.comment);
  return description.length > 0;
}

/**
 * Parse parameter information
 */
function parseParameters(item) {
  if (!item.signatures) return [];
  
  const params = [];
  for (const sig of item.signatures) {
    if (sig.parameters) {
      for (const param of sig.parameters) {
        params.push({
          name: param.name,
          type: formatType(param.type),
          description: getDescription(param.comment),
          optional: param.flags?.isOptional || false
        });
      }
    }
  }
  return params;
}

/**
 * Format type information
 */
function formatType(type) {
  if (!type) return 'any';
  
  if (type.type === 'intrinsic') {
    return type.name;
  }
  
  if (type.type === 'reference') {
    return type.name;
  }
  
  if (type.type === 'reflection' && type.declaration?.signatures) {
    // Function type
    const sig = type.declaration.signatures[0];
    const params = sig.parameters?.map(p => `${p.name}: ${formatType(p.type)}`).join(', ') || '';
    const returnType = formatType(sig.type);
    return `(${params}) => ${returnType}`;
  }
  
  if (type.type === 'union') {
    return type.types.map(t => formatType(t)).join(' \\| ');
  }
  
  if (type.type === 'array') {
    return `${formatType(type.elementType)}[]`;
  }
  
  if (type.type === 'literal') {
    return JSON.stringify(type.value);
  }
  
  return 'any';
}

/**
 * Extract method information from class
 */
function extractMethods(classItem) {
  if (!classItem.children) return [];
  
  return classItem.children
    .filter(child => {
      // Only methods with signatures
      if (child.kind !== 2048) return false; // 2048 = Method
      if (!child.signatures) return false;
      // Must be documented
      return child.signatures.some(sig => sig.comment);
    })
    .map(method => {
      const sig = method.signatures[0];
      return {
        name: method.name,
        signature: formatMethodSignature(method),
        description: getDescription(sig.comment),
        parameters: parseParameters(method),
        returns: {
          type: formatType(sig.type),
          description: getTagValue(sig.comment, 'returns')
        },
        examples: getExamples(sig.comment)
      };
    });
}

/**
 * Format method signature
 */
function formatMethodSignature(method) {
  if (!method.signatures || !method.signatures[0]) return `${method.name}()`;
  
  const sig = method.signatures[0];
  const params = sig.parameters?.map(p => {
    const optional = p.flags?.isOptional ? '?' : '';
    return `${p.name}${optional}: ${formatType(p.type)}`;
  }).join(', ') || '';
  
  const returnType = formatType(sig.type);
  return `${method.name}(${params}): ${returnType}`;
}

/**
 * Process a TypeDoc item into our format
 */
function processItem(item) {
  if (!isDocumented(item)) return null;
  
  const categories = getAllTagValues(item.comment, 'category');
  if (categories.length === 0) return null; // Skip items without @category
  
  const kindMap = {
    128: 'Class',
    256: 'Interface',
    512: 'Enum',
    64: 'Function',
    32: 'Variable',
    4194304: 'Type Alias'
  };
  
  const processed = {
    id: item.id,
    name: item.name,
    displayName: getTagValue(item.comment, 'displayName') || item.name,
    kind: kindMap[item.kind] || 'Unknown',
    description: getDescription(item.comment),
    categories: categories,
    since: getTagValue(item.comment, 'since'),
    related: getAllTagValues(item.comment, 'related'),
    examples: getExamples(item.comment),
    parameters: [],
    returns: null,
    methods: [],
    properties: []
  };
  
  // Handle different kinds
  if (item.kind === 128) { // Class
    processed.methods = extractMethods(item);
    // Extract properties if needed
    if (item.children) {
      processed.properties = item.children
        .filter(child => child.kind === 1024 && isDocumented(child))
        .map(prop => ({
          name: prop.name,
          type: formatType(prop.type),
          description: getDescription(prop.comment)
        }));
    }
  } else if (item.kind === 64 && item.signatures) { // Function
    const sig = item.signatures[0];
    processed.parameters = parseParameters(item);
    processed.returns = {
      type: formatType(sig.type),
      description: getTagValue(sig.comment, 'returns')
    };
  }
  
  return processed;
}

/**
 * Recursively process all items
 */
function processAllItems(item, results = []) {
  const processed = processItem(item);
  if (processed) {
    results.push(processed);
  }
  
  if (item.children) {
    for (const child of item.children) {
      processAllItems(child, results);
    }
  }
  
  return results;
}

// Process the TypeDoc output
const allItems = processAllItems(typedocData);
console.log(`   Found ${allItems.length} documented items`);

// ============================================================================
// PHASE 3: Group by Category
// ============================================================================

console.log('\n📂 Phase 3: Grouping by category...');

// Read category order from config
const typedocConfig = JSON.parse(readFileSync(typedocConfigPath, 'utf-8'));
const categoryOrder = typedocConfig.categoryOrder.filter(c => c !== '*');

// Group items by category
const categoryMap = new Map();

for (const item of allItems) {
  for (const category of item.categories) {
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category).push(item);
  }
}

console.log(`   Created ${categoryMap.size} category groups:`);
categoryMap.forEach((items, category) => {
  console.log(`      - ${category}: ${items.length} items`);
});

// ============================================================================
// PHASE 4: Generate Markdown Files
// ============================================================================

console.log('\n📝 Phase 4: Generating markdown files...');

/**
 * Convert category name to filename
 */
function categoryToFilename(category) {
  return category
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') + '.md';
}

/**
 * Escape pipe characters in table cells
 */
function escapeTableCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Generate frontmatter
 */
function generateFrontmatter(category, items) {
  const related = [...new Set(items.flatMap(item => item.related))].filter(Boolean);
  
  return [
    '---',
    `title: ${category}`,
    `category: ${categoryToFilename(category).replace('.md', '')}`,
    `description: Documentation for ${category} components and utilities`,
    related.length > 0 ? `related: [${related.join(', ')}]` : null,
    '---',
    ''
  ].filter(Boolean).join('\n');
}

/**
 * Generate overview table
 */
function generateOverviewTable(items) {
  const lines = [
    `# ${items[0].categories[0]}`,
    '',
    '## Overview',
    '',
    `This section contains all components and utilities for ${items[0].categories[0]}.`,
    '',
    '## Components',
    '',
    '| Item | Type | Description |',
    '|------|------|-------------|'
  ];
  
  for (const item of items) {
    const anchor = item.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const shortDesc = item.description.split('.')[0] + (item.description.includes('.') ? '.' : '');
    lines.push(`| [${item.displayName}](#${anchor}) | ${item.kind} | ${escapeTableCell(shortDesc)} |`);
  }
  
  lines.push('', '---', '');
  
  return lines.join('\n');
}

/**
 * Generate method table for a class
 */
function generateMethodTable(methods) {
  if (methods.length === 0) return '';
  
  const lines = [
    '### Methods',
    '',
    '| Method | Parameters | Description |',
    '|--------|------------|-------------|'
  ];
  
  for (const method of methods) {
    const paramList = method.parameters
      .map(p => `${p.name}${p.optional ? '?' : ''}: ${escapeTableCell(p.type)}`)
      .join(', ');
    const params = paramList || '-';
    const desc = escapeTableCell(method.description || 'Method for this component');
    lines.push(`| \`${method.name}()\` | ${params} | ${desc} |`);
  }
  
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate detailed method documentation
 */
function generateMethodDetails(methods) {
  const lines = [];
  
  for (const method of methods) {
    lines.push(`#### ${method.name}()`);
    lines.push('');
    lines.push(`\`\`\`typescript`);
    lines.push(method.signature);
    lines.push(`\`\`\``);
    lines.push('');
    
    if (method.description) {
      lines.push(method.description);
      lines.push('');
    }
    
    if (method.parameters.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      for (const param of method.parameters) {
        lines.push(`- \`${param.name}\` (${param.type})${param.optional ? ' - Optional' : ''}: ${param.description || 'No description'}`);
      }
      lines.push('');
    }
    
    if (method.returns && method.returns.description) {
      lines.push('**Returns:**');
      lines.push('');
      lines.push(`${method.returns.type} - ${method.returns.description}`);
      lines.push('');
    }
    
    if (method.examples.length > 0) {
      lines.push('**Example:**');
      lines.push('');
      for (const example of method.examples) {
        lines.push(example);
        lines.push('');
      }
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate detailed documentation for an item
 */
function generateItemDetails(item) {
  const lines = [];
  
  // Main heading with display name
  lines.push(`## ${item.displayName}`);
  lines.push('');
  
  // Description
  if (item.description) {
    lines.push(item.description);
    lines.push('');
  }
  
  // Since version
  if (item.since) {
    lines.push(`*Since version ${item.since}*`);
    lines.push('');
  }
  
  // Examples (at top level for classes/interfaces)
  if (item.examples.length > 0 && item.kind === 'Class') {
    lines.push('### Example');
    lines.push('');
    for (const example of item.examples) {
      lines.push(example);
      lines.push('');
    }
  }
  
  // Properties (if any)
  if (item.properties.length > 0) {
    lines.push('### Properties');
    lines.push('');
    for (const prop of item.properties) {
      lines.push(`- **${prop.name}** (${prop.type}): ${prop.description || 'No description'}`);
    }
    lines.push('');
  }
  
  // Methods table
  if (item.methods.length > 0) {
    lines.push(generateMethodTable(item.methods));
    lines.push(generateMethodDetails(item.methods));
  }
  
  // For functions, show parameters and returns
  if (item.kind === 'Function' && item.parameters.length > 0) {
    lines.push('### Parameters');
    lines.push('');
    for (const param of item.parameters) {
      lines.push(`- **${param.name}** (${param.type})${param.optional ? ' - Optional' : ''}: ${param.description || 'No description'}`);
    }
    lines.push('');
    
    if (item.returns && item.returns.description) {
      lines.push('### Returns');
      lines.push('');
      lines.push(`${item.returns.type} - ${item.returns.description}`);
      lines.push('');
    }
    
    if (item.examples.length > 0) {
      lines.push('### Example');
      lines.push('');
      for (const example of item.examples) {
        lines.push(example);
        lines.push('');
      }
    }
  }
  
  return lines.join('\n');
}

// Generate a file for each category
const generatedFiles = [];

for (const category of categoryOrder) {
  if (!categoryMap.has(category)) continue;
  
  const items = categoryMap.get(category);
  const filename = categoryToFilename(category);
  const filepath = join(outputDir, filename);
  
  console.log(`   Generating ${filename}...`);
  
  // Build markdown content
  const content = [
    generateFrontmatter(category, items),
    generateOverviewTable(items),
    items.map(item => generateItemDetails(item)).join('\n---\n\n')
  ].join('\n');
  
  writeFileSync(filepath, content, 'utf-8');
  generatedFiles.push(filename);
  console.log(`      ✅ ${items.length} items documented`);
}

// ============================================================================
// PHASE 5: Cleanup
// ============================================================================

console.log('\n🗑️  Phase 5: Cleaning up...');

// Remove temp JSON file
if (existsSync(tempJsonPath)) {
  unlinkSync(tempJsonPath);
  console.log('   ✅ Removed temporary JSON file');
}

// Remove old generated files that are no longer needed
const existingFiles = readdirSync(outputDir).filter(f => f.endsWith('.md') && f !== 'README.md');
const filesToRemove = existingFiles.filter(f => !generatedFiles.includes(f));

for (const file of filesToRemove) {
  const filepath = join(outputDir, file);
  unlinkSync(filepath);
  console.log(`   ✅ Removed old file: ${file}`);
}

console.log('\n✨ Documentation generation complete!');
console.log(`   Files generated: ${generatedFiles.length}`);
console.log(`   Output directory: ${outputDir}`);

