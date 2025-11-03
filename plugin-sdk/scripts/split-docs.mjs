#!/usr/bin/env node

/**
 * Post-processing script for TypeDoc-generated documentation.
 * Splits ui.md into separate files per @group with auto-generated summaries.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get output directory from command line or use default
const outputDir = process.argv[2] || resolve(__dirname, '../../dotmatrixlabs-docs/docs/plugin-sdk/reference');
const uiFilePath = resolve(outputDir, 'ui.md');

console.log('📚 Splitting TypeDoc groups...');
console.log(`   Input: ${uiFilePath}`);

if (!existsSync(uiFilePath)) {
  console.error(`❌ Error: ui.md not found at ${uiFilePath}`);
  process.exit(1);
}

// Read the generated ui.md file
const content = readFileSync(uiFilePath, 'utf-8');

// Define the groups we want to split
const groups = [
  { name: 'Settings Page', filename: 'settings-page.md', title: 'Settings Page' },
  { name: 'Action Mapper Modal', filename: 'action-mapper-modal.md', title: 'Action Mapper Modal' }
];

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

// Extract group information from content
function extractGroupContent(content, groupName) {
  const sections = parseMarkdownSections(content);
  const groupSections = [];
  
  for (const section of sections) {
    // Check if this section belongs to the group
    const sectionContent = section.content.join('\n');
    
    // Look for @group annotation in the content or check if it's a known section
    if (sectionContent.includes(`@group ${groupName}`) || section.title === groupName) {
      groupSections.push(section);
    }
  }
  
  return groupSections;
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
      
      components.push({
        title: displayName.replace(/Handle$/, '').trim(),
        description: description,
        // Anchor links to h2 (not h3) after promotion
        anchor: componentName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
      });
    }
  }
  
  if (components.length === 0) {
    return '';
  }
  
  // Build summary markdown
  let summary = `# ${groupTitle}\n\n`;
  summary += `## Overview\n\n`;
  summary += `This section contains all components and utilities for the ${groupTitle}.\n\n`;
  summary += `## Components\n\n`;
  summary += `| Component | Description |\n`;
  summary += `|-----------|-------------|\n`;
  
  for (const comp of components) {
    summary += `| [${comp.title}](#${comp.anchor}) | ${comp.description} |\n`;
  }
  
  summary += `\n---\n\n`;
  
  return summary;
}

// Promote component headings from h3 to h2 for TOC visibility
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
      
      // Promote to h2
      promoted.push(`## ${componentName}`);
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
          
          // Extract parameters and description
          let inParameters = false;
          let foundDescription = false;
          while (i < lines.length) {
            i++;
            const nextLine = lines[i];
            
            // Stop at next method or major heading
            if (nextLine?.match(/^####[#]? .+\(\)$/) || nextLine?.match(/^###[^#]/) || nextLine?.match(/^##[^#]/)) {
              i--; // Step back so outer loop can process this
              break;
            }
            
            // Check for Parameters section (could be ##### after promotion)
            if (nextLine === 'Parameters' || nextLine === '##### Parameters' || nextLine === '#### Parameters') {
              inParameters = true;
              continue;
            }
            
            // Check for Returns section (end of parameters)
            if (nextLine === 'Returns' || nextLine === '##### Returns' || nextLine === '#### Returns') {
              inParameters = false;
              continue;
            }
            
            // Skip Defined in headers
            if (nextLine?.startsWith('Defined in:')) {
              continue;
            }
            
            // Collect parameter names (they appear as ###### or ##### paramName headings)
            if (inParameters && (nextLine?.startsWith('###### ') || nextLine?.startsWith('##### '))) {
              // Extract parameter name from heading
              const paramName = nextLine.replace(/^#{4,6} /, '').trim();
              // Ignore generic headers
              if (paramName !== 'Parameters' && paramName !== 'Returns') {
                parameters.push(paramName);
              }
            }
            
            // Get first meaningful description (after parameters section)
            if (!inParameters && !foundDescription && nextLine?.trim() && nextLine.trim().length > 15 && 
                !nextLine.startsWith('`') && !nextLine.startsWith('>') && !nextLine.startsWith('#') &&
                !nextLine.startsWith('Defined in:') && nextLine !== 'Parameters' && nextLine !== 'Returns') {
              description = nextLine.trim();
              foundDescription = true;
            }
          }
          
          // Format parameters
          let paramDisplay = '-';
          if (parameters.length > 0) {
            paramDisplay = parameters.map(p => `\`${p}\``).join(', ');
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
for (const group of groups) {
  console.log(`\n📄 Processing "${group.name}"...`);
  
  // Find sections for this group
  const lines = content.split('\n');
  const groupContent = [];
  let inGroup = false;
  let groupFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for group marker
    if (line.includes(`## ${group.name}`)) {
      inGroup = true;
      groupFound = true;
      groupContent.push(line);
      continue;
    }
    
    // Check if we've hit another major section (stop)
    if (inGroup && line.match(/^## [A-Z]/)) {
      // Check if it's another group or a different major section
      const isAnotherGroup = groups.some(g => line.includes(`## ${g.name}`));
      if (isAnotherGroup) {
        break;
      }
    }
    
    if (inGroup) {
      groupContent.push(line);
    }
  }
  
  if (!groupFound) {
    console.log(`   ⚠️  Group "${group.name}" not found in ui.md`);
    continue;
  }
  
  // Generate summary from the content
  const contentStr = groupContent.join('\n');
  const summary = generateSummary(contentStr, group.title);
  
  // Combine summary with content (skip the original ## heading)
  const contentWithoutHeading = groupContent.slice(1).join('\n');
  
  // Promote component headings from h3 to h2 for better TOC
  const promotedContent = promoteComponentHeadings(contentWithoutHeading);
  
  // Remove unnecessary sections (Display Name, Constructors)
  const cleanedContent = removeUnnecessarySections(promotedContent);
  
  // Convert methods sections to tables
  const contentWithTables = convertMethodsToTables(cleanedContent);
  
  const fullContent = summary + contentWithTables;
  
  // Count components for logging
  const componentCount = (contentStr.match(/^### [A-Z]/gm) || []).length;
  
  // Write to new file
  const outputPath = resolve(outputDir, group.filename);
  writeFileSync(outputPath, fullContent, 'utf-8');
  
  console.log(`   ✅ Created ${group.filename}`);
  console.log(`      Components found: ${componentCount}`);
}

// Remove the original ui.md file
try {
  unlinkSync(uiFilePath);
  console.log(`\n🗑️  Removed original ui.md`);
} catch (err) {
  console.warn(`   ⚠️  Could not remove ui.md: ${err.message}`);
}

console.log('\n✨ Documentation split complete!\n');

