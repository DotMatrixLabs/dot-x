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
 * 
 * Supported TSDoc tags:
 * - @category: Groups items into documentation sections
 * - @order: Controls item position within a category
 *   - 'first': Item appears at the top of its category
 *   - 'last': Item appears at the bottom of its category
 *   - (no tag): Item appears in alphabetical order in the middle
 * 
 * Example:
 * ```typescript
 * /**
 *  * @category Action Mapper Modal
 *  * @order first
 *  *\/
 * export class ImportantClass { }
 * ```
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const outputDir = process.argv[2] || resolve(__dirname, '../../../dotmatrixlabs-docs/docs/plugin-sdk/reference');
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
 * Extract nested @param tags from blockTags
 * Looks for @param tags with names like "params.message"
 */
function extractNestedParams(comment, parentParamName) {
  if (!comment?.blockTags) return [];
  
  const nestedParams = [];
  const prefix = `${parentParamName}.`;
  
  for (const tag of comment.blockTags) {
    if (tag.tag === '@param' && tag.name) {
      // Check if this is a nested param using the name field (e.g., "params.message")
      if (tag.name.startsWith(prefix)) {
        const nestedName = tag.name.substring(prefix.length);
        const description = tag.content ? tag.content.map(c => c.text || '').join('').trim() : '';
        
        nestedParams.push({
          name: nestedName,
          description: description
        });
      }
    }
  }
  
  return nestedParams;
}

/**
 * Extract parameter types from markdown table in the full comment text
 * This is a fallback to get type information when available
 */
function extractTypesFromTable(comment) {
  if (!comment?.summary) return {};
  
  const fullText = comment.summary.map(part => part.text || '').join('');
  const types = {};
  
  // Look for markdown table with Parameter and Type columns
  const lines = fullText.split('\n');
  let inTable = false;
  let headerSeen = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('Parameter') && trimmed.includes('Type')) {
        inTable = true;
        continue;
      }
      
      if (trimmed.includes('---')) {
        headerSeen = true;
        continue;
      }
      
      if (inTable && headerSeen) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        
        if (cells.length >= 2) {
          const paramName = cells[0].replace(/`/g, '').trim();
          const paramType = cells[1].replace(/`/g, '').replace(/\\\|/g, '|').trim();
          
          if (paramName && paramType) {
            types[paramName] = paramType;
          }
        }
      }
    } else if (inTable && headerSeen) {
      break;
    }
  }
  
  return types;
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
        examples: getExamples(sig.comment),
        see: getAllTagValues(sig.comment, 'see')
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
    4194304: 'Type Alias',
    1024: 'Property'
  };
  
  // Check if this property is actually a method signature
  const isMethodProperty = item.kind === 1024 && item.type?.type === 'reflection' && item.type.declaration?.signatures;
  
  const processed = {
    id: item.id,
    name: item.name,
    displayName: getTagValue(item.comment, 'displayName') || item.name,
    kind: isMethodProperty ? 'Method' : (kindMap[item.kind] || 'Unknown'),
    description: getDescription(item.comment),
    categories: categories,
    since: getTagValue(item.comment, 'since'),
    related: getAllTagValues(item.comment, 'related'),
    examples: getExamples(item.comment),
    order: getTagValue(item.comment, 'order'),
    see: getAllTagValues(item.comment, 'see'),
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
  } else if (item.kind === 256 && item.children) { // Interface
    // Extract properties from interface (treat method properties as methods)
    for (const child of item.children) {
      if (child.kind === 1024) { // Property
        // Check if it's a function property (method signature)
        if (child.type?.type === 'reflection' && child.type.declaration?.signatures) {
          // Treat as a method
          const sig = child.type.declaration.signatures[0];
          const comment = child.comment || sig.comment;
          
          // Build parameters array
          let parameters = [];
          
          if (sig.parameters) {
            // Extract type information from markdown table if available
            const typeMap = extractTypesFromTable(comment);
            
            for (const p of sig.parameters) {
              // Check for nested @param tags (e.g., @param params.message)
              const nestedParams = extractNestedParams(comment, p.name);
              
              if (nestedParams.length > 0) {
                // Has nested parameters - expand them with types from table
                for (const nested of nestedParams) {
                  parameters.push({
                    name: nested.name,
                    type: typeMap[nested.name] || 'any',
                    description: nested.description,
                    optional: false
                  });
                }
              } else if (p.type?.type === 'reference' && p.type.name) {
                // Parameter is a reference type - try to look it up and expand its properties
                const typeDef = findTypeDefinition(p.type.name);
                
                if (typeDef && typeDef.children) {
                  // Found the type definition - extract its properties
                  for (const prop of typeDef.children) {
                    if (prop.kind === 1024) { // Property
                      const propType = formatType(prop.type);
                      const propDesc = getDescription(prop.comment);
                      const isOptional = prop.flags?.isOptional || false;
                      
                      parameters.push({
                        name: prop.name,
                        type: typeMap[prop.name] || propType,
                        description: propDesc,
                        optional: isOptional
                      });
                    }
                  }
                } else {
                  // Couldn't expand - use the parameter as-is
                  parameters.push({
                    name: p.name,
                    type: formatType(p.type),
                    description: getDescription(p.comment),
                    optional: p.flags?.isOptional || false
                  });
                }
              } else {
                // No nested parameters and not a reference type - use the parameter as-is
                parameters.push({
                  name: p.name,
                  type: formatType(p.type),
                  description: getDescription(p.comment),
                  optional: p.flags?.isOptional || false
                });
              }
            }
          }
          
          const method = {
            name: child.name,
            signature: formatMethodSignature({
              name: child.name,
              signatures: [sig]
            }),
            description: getDescription(comment),
            parameters: parameters,
            returns: {
              type: formatType(sig.type),
              description: getTagValue(comment, 'returns')
            },
            examples: getExamples(comment),
            see: getAllTagValues(comment, 'see')
          };
          processed.methods.push(method);
        } else if (isDocumented(child)) {
          // Regular property
          processed.properties.push({
            name: child.name,
            type: formatType(child.type),
            description: getDescription(child.comment)
          });
        }
      }
    }
  } else if (item.kind === 64 && item.signatures) { // Function
    const sig = item.signatures[0];
    processed.parameters = parseParameters(item);
    processed.returns = {
      type: formatType(sig.type),
      description: getTagValue(sig.comment, 'returns')
    };
  } else if (isMethodProperty) { // Method property from interface
    const sig = item.type.declaration.signatures[0];
    const comment = item.comment || sig.comment;
    
    // Build parameters array using the same logic as interface method extraction
    let parameters = [];
    
    if (sig.parameters) {
      const typeMap = extractTypesFromTable(comment);
      
      for (const p of sig.parameters) {
        const nestedParams = extractNestedParams(comment, p.name);
        
        if (nestedParams.length > 0) {
          for (const nested of nestedParams) {
            parameters.push({
              name: nested.name,
              type: typeMap[nested.name] || 'any',
              description: nested.description,
              optional: false
            });
          }
        } else if (p.type?.type === 'reference' && p.type.name) {
          const typeDef = findTypeDefinition(p.type.name);
          
          if (typeDef && typeDef.children) {
            for (const prop of typeDef.children) {
              if (prop.kind === 1024) {
                const propType = formatType(prop.type);
                const propDesc = getDescription(prop.comment);
                const isOptional = prop.flags?.isOptional || false;
                
                parameters.push({
                  name: prop.name,
                  type: typeMap[prop.name] || propType,
                  description: propDesc,
                  optional: isOptional
                });
              }
            }
          } else {
            parameters.push({
              name: p.name,
              type: formatType(p.type),
              description: getDescription(p.comment),
              optional: p.flags?.isOptional || false
            });
          }
        } else {
          parameters.push({
            name: p.name,
            type: formatType(p.type),
            description: getDescription(p.comment),
            optional: p.flags?.isOptional || false
          });
        }
      }
    }
    
    processed.parameters = parameters;
    processed.returns = {
      type: formatType(sig.type),
      description: getTagValue(comment, 'returns')
    };
  }
  
  return processed;
}

/**
 * Recursively process all items
 */
function processAllItems(item, results = [], parentKind = null) {
  const processed = processItem(item);
  if (processed) {
    results.push(processed);
  }
  
  if (item.children) {
    for (const child of item.children) {
      processAllItems(child, results, item.kind);
    }
  }
  
  return results;
}

// Store the full typedoc data for type lookups
let typedocDataGlobal = typedocData;

/**
 * Find a type definition in the TypeDoc JSON
 */
function findTypeDefinition(typeName) {
  function search(item) {
    if (item.name === typeName && (item.kind === 256 || item.kind === 4194304)) {
      return item;
    }
    if (item.children) {
      for (const child of item.children) {
        const result = search(child);
        if (result) return result;
      }
    }
    return null;
  }
  return search(typedocDataGlobal);
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

// Read docs configuration for outline and ordering
const docsConfigPath = resolve(__dirname, '../docs-config.json');
let docsConfig = { outlineEnabled: [], fileOrder: {} };
if (existsSync(docsConfigPath)) {
  docsConfig = JSON.parse(readFileSync(docsConfigPath, 'utf-8'));
  console.log('   ✅ Loaded docs-config.json');
} else {
  console.log('   ℹ️  No docs-config.json found (using defaults)');
}

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

// Sort items within each category based on @order tag
categoryMap.forEach((items, category) => {
  items.sort((a, b) => {
    // Determine priority based on @order tag
    const getPriority = (item) => {
      if (item.order === 'first') return 0;
      if (item.order === 'last') return 2;
      return 1; // default/middle
    };
    
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    
    // Sort by priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Within same priority, sort alphabetically by displayName
    return a.displayName.localeCompare(b.displayName);
  });
});

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
  
  const frontmatterLines = [
    '---',
    `title: ${category}`,
    `category: ${categoryToFilename(category).replace('.md', '')}`,
    `description: Documentation for ${category} components and utilities`,
    related.length > 0 ? `related: [${related.join(', ')}]` : null
  ];
  
  // Add outline: deep if this category is in the outlineEnabled list
  if (docsConfig.outlineEnabled.includes(category)) {
    frontmatterLines.push('outline: deep');
  }
  
  // Add order if specified in fileOrder
  if (docsConfig.fileOrder[category] !== undefined) {
    frontmatterLines.push(`order: ${docsConfig.fileOrder[category]}`);
  }
  
  frontmatterLines.push('---', '');
  
  return frontmatterLines.filter(Boolean).join('\n');
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
    // Extract only the first sentence for the table to avoid breaking table layout
    const fullDesc = method.description || 'Method for this component';
    const firstSentence = fullDesc.split(/[.!?]\s/)[0] + (fullDesc.includes('.') ? '.' : '');
    const desc = escapeTableCell(firstSentence);
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
    
    // See also references for methods
    if (method.see && method.see.length > 0) {
      lines.push('**See also:**');
      lines.push('');
      for (const seeRef of method.see) {
        // Convert category references to links
        if (seeRef.includes('SettingsBuilder Components')) {
          lines.push(`- [SettingsBuilder Components](settingsbuilder-components.md) - For all available UI components`);
        } else {
          lines.push(`- ${seeRef}`);
        }
      }
      lines.push('');
    }
    
    if (method.parameters.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      lines.push('| Name | Type | Required | Description |');
      lines.push('|------|------|----------|-------------|');
      for (const param of method.parameters) {
        const paramName = escapeTableCell(param.name);
        const paramType = escapeTableCell(param.type);
        const required = param.optional ? 'No' : 'Yes';
        const desc = escapeTableCell(param.description || 'No description');
        lines.push(`| \`${paramName}\` | \`${paramType}\` | ${required} | ${desc} |`);
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
 * Load component metadata for live examples
 */
function loadComponentMetadata() {
  try {
    // Path from plugin-sdk/scripts/ to src/components/fields/metadata.ts
    const metadataPath = resolve(__dirname, '../../src/components/fields/metadata.ts');
    if (!existsSync(metadataPath)) {
      console.warn(`   ⚠️  Metadata file not found at: ${metadataPath}`);
      return null;
    }
    const metadataContent = readFileSync(metadataPath, 'utf-8');
    
    // Extract the COMPONENT_METADATA object and convert to JS
    const jsContent = metadataContent
      .replace(/export const/g, 'const')
      .replace(/export type[^;]+;/g, '');
    
    const tempPath = resolve(__dirname, '../temp-metadata-docs.mjs');
    writeFileSync(tempPath, jsContent + '\nexport { COMPONENT_METADATA };');
    
    // Use dynamic import (we're in an ES module)
    return tempPath;
  } catch (e) {
    console.warn('⚠️  Could not load component metadata:', e.message);
    return null;
  }
}

/**
 * Generate Live Examples section based on component metadata
 */
function generateLiveExamplesSection(item, metadata) {
  if (!metadata) {
    return '';
  }
  
  // Map display names to metadata keys
  const nameToKey = {
    'Badge Field': 'badge',
    'Button Field': 'button',
    'Input Field': 'input',
    'Select Field': 'select',
    'Switch Field': 'switch',
    'Text Field': 'text_display'
  };
  
  const metadataKey = nameToKey[item.displayName];
  
  if (!metadataKey || !metadata[metadataKey]) {
    return '';
  }
  
  const componentMeta = metadata[metadataKey];
  if (!componentMeta.docs || !componentMeta.docs.examples) {
    return '';
  }
  
  const examples = Object.keys(componentMeta.docs.examples);
  if (examples.length === 0) {
    return '';
  }
  
  const lines = [
    '### Live Examples',
    '',
    '::: details View Examples',
    '<ClientOnly>'
  ];
  
  for (const exampleName of examples) {
    const kebabName = exampleName.replace(/_/g, '-');
    const componentName = `demo-${metadataKey.replace(/_/g, '-')}-${kebabName}`;
    lines.push(`  <${componentName} />`);
  }
  
  lines.push('</ClientOnly>');
  lines.push(':::');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate detailed documentation for an item
 */
function generateItemDetails(item, componentMetadata = null) {
  const lines = [];
  
  // Main heading with display name
  lines.push(`## ${item.displayName}`);
  lines.push('');
  
  // Description
  if (item.description) {
    lines.push(item.description);
    lines.push('');
  }
  
  // Live Examples (inject after description for SettingsBuilder Components)
  if (item.categories.includes('SettingsBuilder Components')) {
    const liveExamplesSection = generateLiveExamplesSection(item, componentMetadata);
    if (liveExamplesSection) {
      // Split the section string and push each line individually
      lines.push(...liveExamplesSection.split('\n'));
    }
  }
  
  // See also references
  if (item.see && item.see.length > 0) {
    lines.push('**See also:**');
    lines.push('');
    for (const seeRef of item.see) {
      // Convert category references to links
      if (seeRef.includes('SettingsBuilder Components')) {
        lines.push(`- [SettingsBuilder Components](settingsbuilder-components.md) - For all available UI components`);
      } else {
        lines.push(`- ${seeRef}`);
      }
    }
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
  
  // Methods table and details (only for Classes, not Interfaces)
  // Interface methods are documented as separate top-level items for TOC visibility
  if (item.methods.length > 0 && item.kind === 'Class') {
    lines.push(generateMethodTable(item.methods));
    lines.push(generateMethodDetails(item.methods));
  }
  
  // For functions and methods, show parameters and returns
  if ((item.kind === 'Function' || item.kind === 'Method') && item.parameters.length > 0) {
    lines.push('### Parameters');
    lines.push('');
    lines.push('| Name | Type | Required | Description |');
    lines.push('|------|------|----------|-------------|');
    for (const param of item.parameters) {
      const paramName = escapeTableCell(param.name);
      const paramType = escapeTableCell(param.type);
      const required = param.optional ? 'No' : 'Yes';
      const desc = escapeTableCell(param.description || 'No description');
      lines.push(`| \`${paramName}\` | \`${paramType}\` | ${required} | ${desc} |`);
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

// Load component metadata for live examples
console.log('\n📦 Loading component metadata...');
const metadataPath = loadComponentMetadata();
let componentMetadata = null;

if (metadataPath) {
  try {
    const metadataModule = await import(`file://${metadataPath}`);
    componentMetadata = metadataModule.COMPONENT_METADATA;
    console.log('   ✅ Component metadata loaded');
    
    // Clean up temp file
    if (existsSync(metadataPath)) {
      unlinkSync(metadataPath);
    }
  } catch (e) {
    console.warn('   ⚠️  Could not import metadata:', e.message);
  }
} else {
  console.log('   ℹ️  No component metadata found (live examples will be skipped)');
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
    items.map(item => generateItemDetails(item, componentMetadata)).join('\n---\n\n')
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

