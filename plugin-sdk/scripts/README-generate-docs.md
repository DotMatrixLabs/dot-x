# DotX Plugin SDK Documentation Generator

A powerful documentation generator that automatically creates comprehensive markdown documentation from TypeScript source code with TSDoc comments.

## What It Does

This script:
- Analyzes your TypeScript source code using TypeDoc
- Extracts documented items (classes, functions, interfaces, etc.)
- Groups them by category tags
- Generates structured markdown files with tables, examples, and detailed API documentation
- Outputs documentation ready for your documentation site

## Usage

### Basic Command

```bash
node generate-docs.mjs [output-dir]
```

### Default Output

If no output directory is specified, documentation is generated to:
```
../../dotmatrixlabs-docs/docs/plugin-sdk/reference
```

### Examples

```bash
# Generate to default location
node generate-docs.mjs

# Generate to custom location
node generate-docs.mjs ./docs/api-reference

# Use with npm/yarn scripts
yarn docs:generate
```

## How It Works

The generator runs through 5 distinct phases:

### Phase 1: TypeDoc JSON Generation
- Runs TypeDoc with your `typedoc.json` configuration
- Generates a temporary JSON file with complete type information
- Includes all exports, types, signatures, and comments

### Phase 2: Parsing and Filtering
- Parses the TypeDoc JSON output
- Extracts items with valid TSDoc comments
- Filters for items with `@category` tags
- Processes descriptions, parameters, return types, and examples

### Phase 3: Category Grouping
- Groups items by their `@category` tags
- Sorts items within categories based on `@order` tags
- Respects `categoryOrder` from `typedoc.json`
- Handles items with multiple categories

### Phase 4: Markdown Generation
- Creates one markdown file per category
- Generates frontmatter with metadata
- Creates overview tables
- Writes detailed documentation for each item
- Includes method tables, parameters, examples, and more

### Phase 5: Cleanup
- Removes temporary TypeDoc JSON file
- Deletes outdated documentation files
- Reports generation summary

## Supported TSDoc Tags

The generator recognizes and processes the following TSDoc tags:

### `@category` (Required)

**Purpose:** Groups items into documentation sections. Items without a category are not documented.

**Usage:** Can appear multiple times to include an item in multiple categories.

**Example:**
```typescript
/**
 * Displays a modal for configuring action mappings.
 * @category Action Mapper Modal
 */
export class ActionMapperModal { }

/**
 * Utility function used by multiple components.
 * @category Action Mapper Modal
 * @category Utilities
 */
export function sharedHelper() { }
```

### `@order`

**Purpose:** Controls the position of an item within its category.

**Values:**
- `first` - Item appears at the top of its category
- `last` - Item appears at the bottom of its category
- _(omitted)_ - Item appears in alphabetical order in the middle

**Example:**
```typescript
/**
 * Main entry point for the modal system.
 * @category Action Mapper Modal
 * @order first
 */
export class ActionMapperModal { }

/**
 * Helper function for internal use.
 * @category Action Mapper Modal
 * @order last
 */
export function cleanup() { }

/**
 * Regular function, sorted alphabetically.
 * @category Action Mapper Modal
 */
export function configure() { }
```

### `@displayName`

**Purpose:** Override the display name shown in documentation (useful for symbols with technical names).

**Example:**
```typescript
/**
 * @category UI Components
 * @displayName Action Mapper Modal
 */
export class ActionMapperModalImpl { }
// Will appear as "Action Mapper Modal" in docs instead of "ActionMapperModalImpl"
```

### `@since`

**Purpose:** Indicates which version the item was added in.

**Example:**
```typescript
/**
 * New feature for advanced users.
 * @category Advanced Features
 * @since 1.2.0
 */
export class AdvancedConfig { }
```

### `@related`

**Purpose:** Links to related items. Can appear multiple times.

**Example:**
```typescript
/**
 * @category Action Mapper Modal
 * @related ActionMapperConfig
 * @related ActionRegistry
 */
export class ActionMapperModal { }
```

### `@example`

**Purpose:** Provide code examples. Can appear multiple times for different use cases.

**Example:**
```typescript
/**
 * Opens the action mapper modal.
 * @category Action Mapper Modal
 * @example
 * ```typescript
 * const modal = new ActionMapperModal();
 * await modal.open();
 * ```
 * @example
 * ```typescript
 * // With custom configuration
 * const modal = new ActionMapperModal({ theme: 'dark' });
 * await modal.open();
 * ```
 */
export class ActionMapperModal { }
```

### `@returns`

**Purpose:** Describe what a function or method returns.

**Example:**
```typescript
/**
 * Fetches user preferences from storage.
 * @category Storage
 * @returns A promise that resolves to the user preferences object
 */
export async function getPreferences(): Promise<UserPreferences> {
  // ...
}
```

### `@param`

**Purpose:** Document function/method parameters (standard TSDoc tag).

**Example:**
```typescript
/**
 * Updates a specific preference value.
 * @category Storage
 * @param key - The preference key to update
 * @param value - The new value to set
 * @returns True if the update was successful
 */
export function setPreference(key: string, value: any): boolean {
  // ...
}
```

## Complete TSDoc Examples

### Documenting a Class

```typescript
/**
 * Manages action mappings for the DotX plugin system.
 * 
 * This class provides a complete interface for creating, editing,
 * and deleting action mappings through a modal interface.
 * 
 * @category Action Mapper Modal
 * @since 1.0.0
 * @order first
 * @example
 * ```typescript
 * const mapper = new ActionMapperModal();
 * await mapper.open();
 * const result = await mapper.getResult();
 * ```
 */
export class ActionMapperModal {
  /**
   * The current configuration for this modal.
   */
  public config: ActionMapperConfig;

  /**
   * Opens the action mapper modal.
   * 
   * @returns A promise that resolves when the modal is opened
   * @example
   * ```typescript
   * await modal.open();
   * ```
   */
  async open(): Promise<void> {
    // ...
  }

  /**
   * Closes the modal and returns the selected action mapping.
   * 
   * @param save - Whether to save changes before closing
   * @returns The selected action mapping, or null if cancelled
   */
  async close(save: boolean): Promise<ActionMapping | null> {
    // ...
  }
}
```

### Documenting a Function

```typescript
/**
 * Registers a new action with the DotX action system.
 * 
 * Actions registered through this function become available
 * in the action mapper modal and can be triggered by users.
 * 
 * @category Action Registry
 * @param id - Unique identifier for the action
 * @param config - Configuration object for the action
 * @returns True if registration was successful
 * @since 1.0.0
 * @related ActionMapperModal
 * @example
 * ```typescript
 * registerAction('my-action', {
 *   name: 'My Custom Action',
 *   icon: 'star',
 *   handler: async () => {
 *     console.log('Action executed!');
 *   }
 * });
 * ```
 */
export function registerAction(
  id: string,
  config: ActionConfig
): boolean {
  // ...
}
```

### Documenting an Interface

```typescript
/**
 * Configuration options for the ActionMapperModal.
 * 
 * @category Action Mapper Modal
 * @since 1.0.0
 */
export interface ActionMapperConfig {
  /**
   * The theme to use for the modal.
   */
  theme?: 'light' | 'dark';

  /**
   * Whether to show advanced options.
   */
  showAdvanced?: boolean;

  /**
   * Custom CSS class to apply to the modal.
   */
  customClass?: string;
}
```

### Using Multiple Categories

```typescript
/**
 * Validates an action configuration object.
 * 
 * This utility is used internally by the action system but
 * can also be useful for plugin developers.
 * 
 * @category Action Registry
 * @category Utilities
 * @param config - The configuration to validate
 * @returns True if valid, false otherwise
 */
export function validateActionConfig(config: ActionConfig): boolean {
  // ...
}
```

### Using Order for Priority Placement

```typescript
/**
 * The main UI class - always shown first.
 * @category UI Components
 * @order first
 */
export class DotXUI { }

/**
 * A standard UI helper - alphabetically sorted.
 * @category UI Components
 */
export class ButtonHelper { }

/**
 * Another standard helper - alphabetically sorted.
 * @category UI Components
 */
export class DialogHelper { }

/**
 * Deprecated utility - shown last.
 * @category UI Components
 * @order last
 * @deprecated Use DialogHelper instead
 */
export class LegacyDialog { }
```

## What Gets Documented

The generator only includes items that meet ALL of these criteria:

### 1. Must Have TSDoc Comments
Items without JSDoc/TSDoc comment blocks are ignored.

```typescript
// ❌ Not documented - no comment
export class MyClass { }

// ✅ Documented - has comment
/**
 * My class description
 * @category My Category
 */
export class MyClass { }
```

### 2. Must Have Description Text
The comment must include a description (summary).

```typescript
// ❌ Not documented - no description
/**
 * @category My Category
 */
export class MyClass { }

// ✅ Documented - has description
/**
 * This is a description.
 * @category My Category
 */
export class MyClass { }
```

### 3. Must Have At Least One @category Tag
Items without categories are excluded from documentation.

```typescript
// ❌ Not documented - no category
/**
 * This class has a description but no category.
 */
export class MyClass { }

// ✅ Documented - has category
/**
 * This class has both description and category.
 * @category My Category
 */
export class MyClass { }
```

### 4. Methods Must Have Documented Signatures
For class methods to appear, at least one signature must have a comment.

```typescript
export class MyClass {
  // ❌ Not documented - no comment
  myMethod() { }

  /**
   * This method will appear in docs.
   */
  documentedMethod() { }
}
```

## Output Format

The generator creates markdown files with the following structure:

### Frontmatter

```yaml
---
title: Action Mapper Modal
category: action-mapper-modal
description: Documentation for Action Mapper Modal components and utilities
related: [ActionRegistry, UIComponents]
---
```

### Overview Table

```markdown
# Action Mapper Modal

## Overview

This section contains all components and utilities for Action Mapper Modal.

## Components

| Item | Type | Description |
|------|------|-------------|
| [ActionMapperModal](#actionmappermodal) | Class | Manages action mappings for the DotX plugin system. |
| [ActionMapperConfig](#actionmapperconfig) | Interface | Configuration options for the ActionMapperModal. |
```

### Detailed Documentation

Each item gets its own section with:
- Display name as heading
- Full description
- Since version (if specified)
- Examples (for classes)
- Properties table (for classes/interfaces)
- Methods table (for classes)
- Detailed method documentation
- Parameters and return values (for functions)

### Method Tables

```markdown
### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `open()` | - | Opens the action mapper modal. |
| `close()` | save: boolean | Closes the modal and returns the selected action mapping. |
```

### Method Details

```markdown
#### open()

\`\`\`typescript
open(): Promise<void>
\`\`\`

Opens the action mapper modal.

**Returns:**

Promise<void> - A promise that resolves when the modal is opened

**Example:**

\`\`\`typescript
await modal.open();
\`\`\`
```

## Configuration

The generator reads configuration from `typedoc.json`:

### categoryOrder

Controls the order in which category files are generated:

```json
{
  "categoryOrder": [
    "Core",
    "UI Components",
    "Action Mapper Modal",
    "Storage",
    "Utilities",
    "*"
  ]
}
```

Categories appear in the specified order. The `*` represents all other categories (alphabetically sorted).

### Entry Points

Specify which files to document:

```json
{
  "entryPoints": ["src/index.ts"],
  "entryPointStrategy": "expand"
}
```

### Other Options

See [TypeDoc documentation](https://typedoc.org/options/) for all available options.

## Best Practices

### 1. Write Clear Descriptions

```typescript
// ❌ Vague
/**
 * Does stuff.
 * @category Utilities
 */

// ✅ Clear
/**
 * Validates and sanitizes user input before processing.
 * @category Utilities
 */
```

### 2. Use Appropriate Categories

Group related functionality together. Categories should represent logical sections of your API.

```typescript
// All UI-related classes
/** @category UI Components */

// All storage-related functions
/** @category Storage */

// All utility functions
/** @category Utilities */
```

### 3. Provide Examples for Complex APIs

Always include examples for classes and functions that aren't self-explanatory:

```typescript
/**
 * Complex configuration builder with fluent API.
 * @category Configuration
 * @example
 * ```typescript
 * const config = new ConfigBuilder()
 *   .setTheme('dark')
 *   .enableFeature('advanced-mode')
 *   .build();
 * ```
 */
```

### 4. Use @order Sparingly

Only use `@order` for items that truly need to be first or last. Let most items sort alphabetically.

```typescript
// Good use: Main entry point should be first
/** @order first */
export class MainAPI { }

// Bad use: Micromanaging order
/** @order first */
export class AClass { }
/** @order first */
export class BClass { }  // Can't both be first!
```

### 5. Keep Related Items Together

Use `@related` tags to help users discover connected APIs:

```typescript
/**
 * @category Storage
 * @related getPreference
 * @related clearPreferences
 */
export function setPreference() { }
```

### 6. Document All Public APIs

Every exported class, function, and interface should have documentation. Users rely on this to understand your SDK.

```typescript
// If it's exported, it should be documented
export class PublicAPI {
  // Public methods should be documented
  /**
   * Public method description
   */
  public doSomething() { }

  // Private methods don't need documentation for end users
  private internalHelper() { }
}
```

### 7. Use @since for Version Tracking

Help users know when features were introduced:

```typescript
/**
 * New authentication method added in v2.
 * @category Authentication
 * @since 2.0.0
 */
export function authenticateWithToken() { }
```

### 8. Include Parameter Descriptions

Don't just rely on TypeScript types - explain what parameters mean:

```typescript
/**
 * Updates user settings.
 * @param userId - The unique identifier of the user
 * @param settings - Partial settings object with properties to update
 * @param merge - If true, merges with existing settings; if false, replaces them
 */
export function updateSettings(
  userId: string,
  settings: Partial<Settings>,
  merge: boolean = true
) { }
```

## Troubleshooting

### My item isn't appearing in the docs

Check that it has:
1. A TSDoc comment block (`/** ... */`)
2. A description in the comment
3. At least one `@category` tag
4. Is exported from your entry point

### Categories are in the wrong order

Update the `categoryOrder` array in `typedoc.json`.

### Items within a category are in the wrong order

- Use `@order first` for items that should appear at the top
- Use `@order last` for items that should appear at the bottom
- Let other items sort alphabetically

### Examples aren't rendering correctly

Make sure to use proper markdown code blocks within `@example` tags:

```typescript
* @example
* ```typescript
* // Your code here
* ```
```

### Method documentation is missing

Ensure the method has a TSDoc comment on its signature, not just the method declaration.

## Contributing

When adding new features to the generator:
1. Update the supported tags section if adding new tag support
2. Add examples showing the new feature
3. Update the "What Gets Documented" section if changing filtering rules
4. Test with various TypeScript constructs (classes, functions, generics, etc.)

---

Generated by DotX Plugin SDK Documentation Generator

