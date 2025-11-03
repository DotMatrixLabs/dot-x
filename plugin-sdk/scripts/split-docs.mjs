#!/usr/bin/env node

/**
 * Post-processing script for TypeDoc-generated documentation.
 * Dynamically discovers groups from all .md files and splits them into separate files.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get output directory from command line or use default
const outputDir = process.argv[2] || resolve(__dirname, '../../dotmatrixlabs-docs/docs/plugin-sdk/reference');
const typedocConfigPath = resolve(__dirname, '../typedoc.json');

console.log('📚 Splitting TypeDoc groups...');
console.log(`   Output directory: ${outputDir}`);

if (!existsSync(outputDir)) {
  console.error(`❌ Error: Output directory not found at ${outputDir}`);
  process.exit(1);
}

/**
 * Discover all .md files in the output directory, excluding README.md
 */
function discoverSourceFiles(dir) {
  const files = readdirSync(dir)
    .filter(file => file.endsWith('.md') && file !== 'README.md')
    .map(file => join(dir, file));
  
  console.log(`\n📁 Found ${files.length} source files:`);
  files.forEach(file => console.log(`   - ${file.split(/[\\/]/).pop()}`));
  
  return files;
}

/**
 * Read and parse typedoc.json to get the groupOrder/categoryOrder array
 */
function readTypedocConfig(configPath) {
  if (!existsSync(configPath)) {
    console.warn(`⚠️  typedoc.json not found at ${configPath}, using default groups`);
    return [
      'Plugin Lifecycle',
      'Settings Page',
      'Action Mapper Modal',
      'Global UI',
      'Storing Data',
      'Advanced/Internal',
      'Storing Data',
      '*'
    ];
  }
  
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  // Support both groupOrder and categoryOrder
  const groupOrder = config.categoryOrder || config.groupOrder || [];
  
  // Filter out wildcard entries
  const validGroups = groupOrder.filter(g => g !== '*');
  
  console.log(`\n📋 Valid groups from typedoc.json: ${validGroups.join(', ')}`);
  
  return validGroups;
}

/**
 * Convert group name to kebab-case filename
 */
function groupNameToFilename(groupName) {
  return groupName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') + '.md';
}

/**
 * Scan all source .md files for ##, ###, and #### headings and match against groupOrder
 */
function discoverGroups(sourceFiles, validGroups) {
  const groupsMap = new Map();
  
  sourceFiles.forEach(filePath => {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach(line => {
      // Check h2 (##), h3 (###), and h4 (####) headings
      const h2Match = line.match(/^## (.+)$/);
      const h3Match = line.match(/^### (.+)$/);
      const h4Match = line.match(/^#### (.+)$/);
      
      const groupName = h2Match ? h2Match[1] : (h3Match ? h3Match[1] : (h4Match ? h4Match[1] : null));
      
      if (groupName) {
        // Check if this group name is in our valid groups list
        if (validGroups.includes(groupName)) {
          if (!groupsMap.has(groupName)) {
            groupsMap.set(groupName, {
              name: groupName,
              filename: groupNameToFilename(groupName),
              title: groupName,
              sourceFiles: []
            });
          }
          
          // Track which files contain this group
          const group = groupsMap.get(groupName);
          if (!group.sourceFiles.includes(filePath)) {
            group.sourceFiles.push(filePath);
          }
        }
      }
    });
  });
  
  console.log(`\n🔍 Discovered ${groupsMap.size} groups:`);
  groupsMap.forEach((group, name) => {
    console.log(`   - ${name} (found in ${group.sourceFiles.length} file(s))`);
  });
  
  return Array.from(groupsMap.values());
}

// Discover source files
const sourceFiles = discoverSourceFiles(outputDir);

if (sourceFiles.length === 0) {
  console.error(`❌ Error: No .md files found in ${outputDir}`);
  process.exit(1);
}

// Read typedoc config to get valid groups
const validGroups = readTypedocConfig(typedocConfigPath);

// Discover groups from all source files
const groups = discoverGroups(sourceFiles, validGroups);

// Parse source TypeScript files to find items with multiple categories
console.log(`\n🔍 Parsing source files for multiple categories...`);
const sourceCategoryMap = parseSourceCategories();
if (sourceCategoryMap.size > 0) {
  const multiCategoryItems = Array.from(sourceCategoryMap.entries())
    .filter(([_, cats]) => cats.size > 1);
  console.log(`   Found ${multiCategoryItems.length} items with multiple categories`);
}

// Split content by headings (##)
function parseMarkdownSections(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match level 2 or 3 headings
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    
    if (h2Match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        level: 2,
        title: h2Match[1],
        content: [line],
        children: []
      };
    } else if (h3Match && currentSection) {
      currentSection.children.push({
        level: 3,
        title: h3Match[1],
        content: [line]
      });
    } else if (currentSection) {
      if (currentSection.children.length > 0) {
        currentSection.children[currentSection.children.length - 1].content.push(line);
      } else {
        currentSection.content.push(line);
      }
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Extract group content from a single file
 */
function extractGroupContentFromFile(filePath, groupName) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const groupContent = [];
  let inGroup = false;
  let groupLevel = 0; // Track whether we're in h2 (2), h3 (3), or h4 (4) section
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for group marker at h2, h3, or h4 level
    if (line === `## ${groupName}`) {
      inGroup = true;
      groupLevel = 2;
      // Skip the heading itself (we'll add our own later)
      continue;
    } else if (line === `### ${groupName}`) {
      inGroup = true;
      groupLevel = 3;
      // Skip the heading itself (we'll add our own later)
      continue;
    } else if (line === `#### ${groupName}`) {
      inGroup = true;
      groupLevel = 4;
      // Skip the heading itself (we'll add our own later)
      continue;
    }
    
    // Check if we've hit another heading at the same or higher level (stop)
    if (inGroup) {
      if (groupLevel === 2 && line.match(/^## /)) {
        break; // Hit another h2
      } else if (groupLevel === 3 && (line.match(/^## /) || line.match(/^### /))) {
        break; // Hit h2 or h3
      } else if (groupLevel === 4 && (line.match(/^## /) || line.match(/^### /) || line.match(/^#### /))) {
        break; // Hit h2, h3, or h4
      }
    }
    
    if (inGroup) {
      groupContent.push(line);
    }
  }
  
  return groupContent.join('\n');
}

/**
 * Parse content into component sections
 * Looks for h3 headings first, then h4, then h5 if needed
 */
function parseComponentSections(content) {
  const lines = content.split('\n');
  let sections = [];
  let currentSection = null;
  
  // First pass: try to find h3 headings
  let hasH3 = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      hasH3 = true;
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        name: h3Match[1],
        lines: [line]
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }
  
  if (currentSection) {
    sections.push(currentSection);
  }
  
  // If no h3 headings found, try h4 headings
  if (!hasH3 && content.trim()) {
    sections = [];
    currentSection = null;
    let hasH4 = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const h4Match = line.match(/^#### (.+)$/);
      if (h4Match) {
        hasH4 = true;
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          name: h4Match[1],
          lines: [line]
        };
      } else if (currentSection) {
        currentSection.lines.push(line);
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // If no h4 headings found either, try h5 headings (for deeply nested categories)
    if (!hasH4 && content.trim()) {
      sections = [];
      currentSection = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const h5Match = line.match(/^##### (.+)$/);
        if (h5Match) {
          if (currentSection) {
            sections.push(currentSection);
          }
          currentSection = {
            name: h5Match[1],
            lines: [line]
          };
        } else if (currentSection) {
          currentSection.lines.push(line);
        }
      }
      
      if (currentSection) {
        sections.push(currentSection);
      }
    }
  }
  
  return sections;
}

/**
 * Determine if a section is a re-export stub
 */
function isReExportStub(section) {
  // Check if section has "Re-exports [X]" pattern
  const content = section.lines.join('\n');
  return content.includes('Re-exports [');
}

/**
 * Determine if a section is a Handle class (has methods and Display Name)
 */
function isHandleClass(section) {
  const content = section.lines.join('\n');
  // Handle classes have both Display Name and Methods sections
  return content.includes('#### Display Name') && content.includes('#### Methods');
}

/**
 * Determine if a section is a config interface (just properties, no methods)
 */
function isConfigInterface(section) {
  const content = section.lines.join('\n');
  // Config interfaces have Properties but no Display Name or Methods
  return content.includes('### Properties') && 
         !content.includes('#### Display Name') && 
         !content.includes('#### Methods');
}

/**
 * Get the base name for a component (normalize for deduplication)
 */
function getComponentBaseName(section) {
  const content = section.lines.join('\n');
  const lines = section.lines;
  
  // Look for Display Name section - this is the canonical name
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '#### Display Name' && i + 2 < lines.length) {
      // Remove "Field" suffix and normalize to lowercase for comparison
      return lines[i + 2].trim().replace(/\s+Field$/i, '').toLowerCase().replace(/\s+/g, '');
    }
  }
  
  // Otherwise normalize the heading name for comparison
  // Remove Handle and Field suffixes, normalize spacing
  let baseName = section.name
    .replace(/Handle$/, '')
    .replace(/Field$/, '')
    .toLowerCase()
    .replace(/\s+/g, '');
  return baseName;
}

/**
 * Parse TypeScript source files to find items with multiple @category tags
 * Returns a Map of item names to their associated categories
 */
function parseSourceCategories() {
  const srcDir = resolve(__dirname, '../src');
  const categoryMap = new Map(); // itemName -> Set of categories
  
  try {
    const tsFiles = readdirSync(srcDir).filter(f => f.endsWith('.ts'));
    
    for (const file of tsFiles) {
      const content = readFileSync(join(srcDir, file), 'utf-8');
      const lines = content.split('\n');
      
      let currentCategories = [];
      let currentItem = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Collect @category tags
        if (line.includes('@category')) {
          const match = line.match(/@category\s+(.+)/);
          if (match) {
            currentCategories.push(match[1].trim());
          }
        }
        
        // Find export class/function/interface declarations
        if (line.match(/^export\s+(class|interface|function|const)\s+(\w+)/)) {
          const match = line.match(/^export\s+(?:class|interface|function|const)\s+(\w+)/);
          if (match && currentCategories.length > 0) {
            currentItem = match[1];
            
            if (!categoryMap.has(currentItem)) {
              categoryMap.set(currentItem, new Set());
            }
            
            currentCategories.forEach(cat => {
              categoryMap.get(currentItem).add(cat);
            });
          }
          
          // Reset for next item
          currentCategories = [];
        }
        
        // Reset categories if we hit another doc comment start
        if (line === '/**') {
          currentCategories = [];
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️  Could not parse source categories: ${err.message}`);
  }
  
  return categoryMap;
}

/**
 * Aggregate group content from all source files with deduplication
 */
function aggregateGroupContent(group, sourceCategoryMap, allSourceFiles) {
  const allSections = [];
  
  // Collect all sections from all files
  group.sourceFiles.forEach(filePath => {
    const content = extractGroupContentFromFile(filePath, group.name);
    if (content.trim()) {
      const sections = parseComponentSections(content);
      allSections.push(...sections);
    }
  });
  
  // For items with category tags matching this group, ensure they're included
  // This handles moving items to all their tagged categories, not just where they appear
  if (sourceCategoryMap && sourceCategoryMap.size > 0) {
    // Find ALL items that should be in this category based on their @category tags
    const itemsForThisCategory = Array.from(sourceCategoryMap.entries())
      .filter(([_, cats]) => cats.has(group.name));
    
    for (const [itemName, categories] of itemsForThisCategory) {
      // Check if we already have this item from the initial collection
      const alreadyHave = allSections.some(s => 
        s.name === itemName || s.name === `${itemName}Handle`
      );
      
      if (!alreadyHave) {
        // Search ALL categories (including this one) in all source files to find this item
        // This is needed because an item might be physically in a different category's section
        // but should appear here based on its @category tag
        let foundItem = false;
        
        for (const categoryToSearch of categories) {
          if (foundItem) break;
          
          // Search all source files for this category
          for (const sourceFile of allSourceFiles) {
            const content = extractGroupContentFromFile(sourceFile, categoryToSearch);
            if (content.trim()) {
              const sections = parseComponentSections(content);
              const found = sections.find(s => 
                s.name === itemName || s.name === `${itemName}Handle`
              );
              
              if (found) {
                allSections.push(found);
                foundItem = true;
                break; // Found it, stop searching this category
              }
            }
          }
        }
      }
    }
  }
  
  // Deduplicate: prefer Handle classes > Config interfaces > Re-export stubs
  const sectionMap = new Map();
  
  for (const section of allSections) {
    const baseName = getComponentBaseName(section);
    const isStub = isReExportStub(section);
    const isHandle = isHandleClass(section);
    const isConfig = isConfigInterface(section);
    
    if (!sectionMap.has(baseName)) {
      // First occurrence, add it
      sectionMap.set(baseName, section);
    } else {
      // Already have this component - decide which to keep
      const existing = sectionMap.get(baseName);
      const existingIsStub = isReExportStub(existing);
      const existingIsHandle = isHandleClass(existing);
      const existingIsConfig = isConfigInterface(existing);
      
      // Priority: Handle > Config > Re-export
      let shouldReplace = false;
      
      if (isHandle && !existingIsHandle) {
        // Current is Handle, existing is not - always replace
        shouldReplace = true;
      } else if (isConfig && existingIsStub && !existingIsHandle) {
        // Current is Config, existing is stub (and not Handle) - replace
        shouldReplace = true;
      } else if (!isStub && existingIsStub && !existingIsHandle && !existingIsConfig) {
        // Current is full implementation, existing is stub - replace
        shouldReplace = true;
      }
      
      if (shouldReplace) {
        sectionMap.set(baseName, section);
      }
    }
  }
  
  // Reconstruct content from deduplicated sections
  const deduplicatedContent = Array.from(sectionMap.values())
    .map(section => section.lines.join('\n'))
    .join('\n\n');
  
  return deduplicatedContent;
}

// Generate a summary from sections
function generateSummary(content, groupTitle) {
  const components = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for ### component headings (level 3)
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      const componentName = h3Match[1];
      
      // Skip if it's a subsection (methods, constructors, etc)
      if (componentName.includes('Methods') || componentName.includes('Constructors') || 
          componentName.includes('Properties') || componentName.includes('Constructor')) {
        continue;
      }
      
      // Only include classes (Handle, Builder, Mapper) and skip type aliases and functions
      const isClass = componentName.includes('Handle') || componentName.includes('Builder') || 
                      componentName.includes('Mapper') || componentName === 'ActionMapper';
      const isFunction = componentName.includes('()');
      const isType = lines[i + 2] && lines[i + 2].startsWith('> **');
      
      if (isFunction || isType) {
        continue;
      }
      
      // Get description (first non-empty line after "Defined in:")
      let description = '';
      let displayName = componentName;
      let foundDefinedIn = false;
      
      for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
        const nextLine = lines[j].trim();
        
        // Check for Display Name section
        if (lines[j] === '#### Display Name' && j + 2 < lines.length) {
          displayName = lines[j + 2].trim();
          continue;
        }
        
        // Mark when we find "Defined in"
        if (nextLine.startsWith('Defined in:')) {
          foundDefinedIn = true;
          continue;
        }
        
        // Stop at next heading or example section
        if (nextLine.startsWith('####') || nextLine.startsWith('```')) {
          break;
        }
        
        // Get first meaningful description line after "Defined in"
        if (foundDefinedIn && !description && nextLine.length > 15 && !nextLine.startsWith('#')) {
          description = nextLine;
          break;
        }
      }
      
      if (!description) {
        description = 'UI component for building plugin interfaces';
      }
      
      // Limit description length
      if (description.length > 100) {
        description = description.substring(0, 97) + '...';
      }
      
      // Extract Display Name if available
      let actualDisplayName = displayName.replace(/Handle$/, '').trim();
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j] === '#### Display Name' && j + 2 < lines.length) {
          actualDisplayName = lines[j + 2].trim();
          break;
        }
        if (lines[j].startsWith('###')) break;
      }
      
      components.push({
        title: actualDisplayName,
        description: description,
        // Anchor based on actual Display Name used in heading
        anchor: actualDisplayName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      });
    }
  }
  
  if (components.length === 0) {
    return '';
  }
  
  // Deduplicate components by anchor (unique identifier)
  const uniqueComponents = [];
  const seenAnchors = new Set();
  
  for (const comp of components) {
    if (!seenAnchors.has(comp.anchor)) {
      seenAnchors.add(comp.anchor);
      uniqueComponents.push(comp);
    }
  }
  
  // Build summary markdown
  let summary = `# ${groupTitle}\n\n`;
  summary += `## Overview\n\n`;
  summary += `This section contains all components and utilities for the ${groupTitle}.\n\n`;
  summary += `## Components\n\n`;
  summary += `| Component | Description |\n`;
  summary += `|-----------|-------------|\n`;
  
  for (const comp of uniqueComponents) {
    summary += `| [${comp.title}](#${comp.anchor}) | ${comp.description} |\n`;
  }
  
  summary += `\n---\n\n`;
  
  return summary;
}

// Promote component headings from h3 to h2 for TOC visibility and use Display Names
function promoteComponentHeadings(content) {
  const lines = content.split('\n');
  const promoted = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a component heading (### ComponentName)
    const h3Match = line.match(/^### (.+)$/);
    if (h3Match) {
      const componentName = h3Match[1];
      
      // Skip subsections (Methods, Constructors, Properties)
      if (componentName.includes('Methods') || componentName.includes('Constructors') || 
          componentName.includes('Properties') || componentName.includes('Example')) {
        promoted.push(line);
        continue;
      }
      
      // Look ahead for Display Name section
      let displayName = componentName;
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        if (lines[j] === '#### Display Name' && j + 2 < lines.length) {
          displayName = lines[j + 2].trim();
          break;
        }
        // Stop looking if we hit another major section
        if (lines[j].startsWith('###')) {
          break;
        }
      }
      
      // Promote to h2 with Display Name
      promoted.push(`## ${displayName}`);
      continue;
    }
    
    // Adjust h4 to h3 for proper nesting under promoted h2
    const h4Match = line.match(/^#### (.+)$/);
    if (h4Match) {
      promoted.push(`### ${h4Match[1]}`);
      continue;
    }
    
    // Adjust h5 to h4
    const h5Match = line.match(/^##### (.+)$/);
    if (h5Match) {
      promoted.push(`#### ${h5Match[1]}`);
      continue;
    }
    
    // Adjust h6 to h5, but NOT for Parameters headings (keep them as h6 for parsing)
    const h6Match = line.match(/^###### (.+)$/);
    if (h6Match) {
      // Keep h6 headings under Methods/Parameters sections so the table generator can find them
      promoted.push(line);
      continue;
    }
    
    promoted.push(line);
  }
  
  return promoted.join('\n');
}

// Convert Methods sections to tables
function convertMethodsToTables(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if we're at a Methods heading
    if (line === '### Methods' || line === '#### Methods') {
      result.push(line);
      result.push('');
      result.push('| Method | Parameters | Description |');
      result.push('|--------|------------|-------------|');
      i++;
      
      // Parse methods until next major heading
      while (i < lines.length) {
        const currentLine = lines[i];
        
        // Stop at next major heading (h3/h4)
        if (currentLine.match(/^###[^#]/) || currentLine.match(/^##[^#]/)) {
          break;
        }
        
        // Look for method headings (##### methodName() or #### methodName())
        const methodMatch = currentLine.match(/^####[#]? (.+\(\))$/);
        if (methodMatch) {
          const methodName = methodMatch[1];
          let signature = '';
          let description = '';
          const parameters = [];
          
          // Get signature (next line with > **methodName**) and extract parameters from it
          i++;
          // Skip empty lines to find the signature
          while (i < lines.length && lines[i].trim() === '') {
            i++;
          }
          if (i < lines.length && lines[i].startsWith('> **')) {
            // Remove the markdown formatting: > **methodName**(...) becomes methodName(...)
            signature = lines[i].replace(/^> \*\*/, '').replace(/\*\*/, '');
            
            // Extract parameters from signature: methodName(`param1`, `param2`): returnType
            const sigMatch = signature.match(/\(([^)]*)\)/);
            if (sigMatch && sigMatch[1].trim()) {
              // Parse parameter list
              const paramStr = sigMatch[1];
              // Extract parameter names (they're in backticks)
              const paramMatches = paramStr.matchAll(/`([^`]+)`/g);
              for (const match of paramMatches) {
                const paramName = match[1];
                // Skip optional indicators and types
                const cleanParam = paramName.replace(/\?$/, '').split(':')[0].trim();
                if (cleanParam && cleanParam !== 'void') {
                  parameters.push(cleanParam);
                }
              }
            }
          }
          
          // Extract parameter types and description from Parameters section
          const paramTypes = {}; // Store param name -> type mapping
          let inParameters = false;
          let foundDescription = false;
          let currentParam = null;
          
          while (i < lines.length) {
            i++;
            const nextLine = lines[i];
            
            // Stop at next method or major heading
            if (nextLine?.match(/^####[#]? .+\(\)$/) || nextLine?.match(/^###[^#]/) || nextLine?.match(/^##[^#]/)) {
              i--; // Step back so outer loop can process this
              break;
            }
            
            // Check for Parameters section (still h6 after promotion since we kept h6)
            if (nextLine === 'Parameters' || nextLine === '###### Parameters' || nextLine === '##### Parameters' || nextLine === '#### Parameters') {
              inParameters = true;
              continue;
            }
            
            // Check for Returns section (end of parameters)
            if (nextLine === 'Returns' || nextLine === '###### Returns' || nextLine === '##### Returns' || nextLine === '#### Returns') {
              inParameters = false;
              currentParam = null;
              continue;
            }
            
            // Skip Defined in headers
            if (nextLine?.startsWith('Defined in:')) {
              continue;
            }
            
            // When in Parameters section, collect parameter names and types
            if (inParameters) {
              // Parameter name appears as ###### or ##### heading
              if (nextLine?.startsWith('###### ') || nextLine?.startsWith('##### ')) {
                const paramName = nextLine.replace(/^#{4,6} /, '').trim();
                // Ignore generic headers
                if (paramName !== 'Parameters' && paramName !== 'Returns') {
                  currentParam = paramName;
                }
                continue;
              }
              
              // Type appears as line with backticks (after we've found a param name)
              if (currentParam && nextLine) {
                const trimmed = nextLine.trim();
                if (trimmed.startsWith('`') && trimmed.endsWith('`') && !trimmed.includes('[')) {
                  // Remove backticks to get the type
                  let type = trimmed.replace(/^`/, '').replace(/`$/, '');
                  // Escape pipes in union types for markdown tables
                  type = type.replace(/\|/g, '\\|');
                  paramTypes[currentParam] = type;
                  currentParam = null;
                  continue;
                }
              }
              // Don't continue here - we need to check other conditions too
            }
            
            // Get first meaningful description (after parameters section)
            if (!inParameters && !foundDescription && nextLine?.trim() && nextLine.trim().length > 15 && 
                !nextLine.startsWith('`') && !nextLine.startsWith('>') && !nextLine.startsWith('#') &&
                !nextLine.startsWith('Defined in:') && nextLine !== 'Parameters' && nextLine !== 'Returns') {
              description = nextLine.trim();
              foundDescription = true;
            }
          }
          
          // Enhance parameters array with types
          const enhancedParams = parameters.map(p => {
            const type = paramTypes[p];
            return type ? `${p}: ${type}` : p;
          });
          
          // Format parameters with types
          let paramDisplay = '-';
          if (enhancedParams.length > 0) {
            paramDisplay = enhancedParams.map(p => `\`${p}\``).join(', ');
          }
          
          // Add to table
          const methodDisplay = `\`${methodName}\``;
          const desc = description || 'Method for this component';
          result.push(`| ${methodDisplay} | ${paramDisplay} | ${desc} |`);
          continue;
        }
        
        i++;
      }
      
      result.push('');
      continue;
    }
    
    result.push(line);
    i++;
  }
  
  return result.join('\n');
}

// Remove unnecessary sections (Display Name, Constructors, etc)
function removeUnnecessarySections(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;
  let skipUntilNextHeading = false;
  let skipLevel = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for sections to skip (Display Name and Constructors ONLY)
    if (line === '### Display Name' || line === '### Constructors' || line === '#### Constructor' || line === '### Constructors') {
      skipUntilNextHeading = true;
      // Determine the level to skip to
      if (line.startsWith('###')) {
        skipLevel = 3;
      } else if (line.startsWith('####')) {
        skipLevel = 4;
      }
      i++;
      continue;
    }
    
    // If we're skipping, check if we've reached a heading at the same or higher level
    if (skipUntilNextHeading) {
      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s/);
      if (headingMatch) {
        const currentLevel = headingMatch[1].length;
        // Stop skipping if we hit a heading at same or higher level (lower number)
        // BUT always preserve Methods sections
        if (currentLevel <= skipLevel || line.includes('Methods')) {
          skipUntilNextHeading = false;
          skipLevel = 0;
          // Don't skip this line, process it normally
          result.push(line);
          i++;
          continue;
        }
      }
      // Still skipping
      i++;
      continue;
    }
    
    result.push(line);
    i++;
  }
  
  return result.join('\n');
}

// Process each group
console.log(`\n🔧 Processing ${groups.length} group(s)...\n`);

for (const group of groups) {
  console.log(`📄 Processing "${group.name}"...`);
  console.log(`   Sources: ${group.sourceFiles.map(f => f.split(/[\\/]/).pop()).join(', ')}`);
  
  // Aggregate content from all source files for this group
  const aggregatedContent = aggregateGroupContent(group, sourceCategoryMap, sourceFiles);
  
  if (!aggregatedContent.trim()) {
    console.log(`   ⚠️  No content found for group "${group.name}"`);
    continue;
  }
  
  // Generate summary from the aggregated content
  const summary = generateSummary(aggregatedContent, group.title);
  
  // Promote component headings from h3 to h2 for better TOC
  const promotedContent = promoteComponentHeadings(aggregatedContent);
  
  // Remove unnecessary sections (Display Name, Constructors)
  const cleanedContent = removeUnnecessarySections(promotedContent);
  
  // Convert methods sections to tables
  const contentWithTables = convertMethodsToTables(cleanedContent);
  
  const fullContent = summary + contentWithTables;
  
  // Count components for logging
  const componentCount = (aggregatedContent.match(/^### [A-Z]/gm) || []).length;
  
  // Write to new file
  const outputPath = resolve(outputDir, group.filename);
  writeFileSync(outputPath, fullContent, 'utf-8');
  
  console.log(`   ✅ Created ${group.filename}`);
  console.log(`      Components found: ${componentCount}`);
}

// Remove all source files (excluding README.md and newly generated group files)
console.log(`\n🗑️  Cleaning up source files...`);
const generatedFilenames = groups.map(g => g.filename);
let removedCount = 0;

for (const sourceFile of sourceFiles) {
  const filename = sourceFile.split(/[\\/]/).pop();
  
  // Skip README.md and newly generated group files
  if (filename === 'README.md' || generatedFilenames.includes(filename)) {
    continue;
  }
  
  try {
    unlinkSync(sourceFile);
    console.log(`   ✓ Removed ${filename}`);
    removedCount++;
  } catch (err) {
    console.warn(`   ⚠️  Could not remove ${filename}: ${err.message}`);
  }
}

console.log(`\n✨ Documentation split complete!`);
console.log(`   Groups created: ${groups.length}`);
console.log(`   Files removed: ${removedCount}\n`);


