# Component Sync & Live Examples Documentation

This document explains how the Live Examples system works for the Plugin SDK documentation.

## Overview

The documentation system consists of three scripts that work together:

```
plugin-sdk/scripts/
├── generate-docs.mjs      # Generates markdown from TypeDoc + injects Live Examples
├── sync-components.mjs    # Copies Vue components and generates demo wrappers
└── build-docs.mjs        # Master script that runs both in sequence
```

## Architecture

### Component Metadata (`src/components/fields/metadata.ts`)

Defines documentation examples for each component type:

```typescript
export const COMPONENT_METADATA = {
  input: {
    registryKey: 'input',     // Points to registry.ts
    baseProps: { type: 'text' }, // Applied to all examples
    category: 'form',
    docs: {
      title: 'Input Field',
      description: 'Single-line text input field',
      examples: {
        basic: { label: 'Username', placeholder: 'Enter username' },
        required: { label: 'Email', required: true }
      }
    }
  }
}
```

### Script Workflow

1. **generate-docs.mjs**
   - Reads `ui.ts` via TypeDoc
   - Loads `metadata.ts` for component examples
   - Generates markdown with Live Examples sections
   - Output: `D:\dotmatrixlabs-docs\docs\plugin-sdk\reference\*.md`

2. **sync-components.mjs**
   - Reads `registry.ts` and `metadata.ts`
   - Copies Vue component files from `src/components/fields/` to docs
   - Generates demo wrapper components with proper props
   - Output: `D:\dotmatrixlabs-docs\docs\.vitepress\components\{fields,demos}\`

3. **build-docs.mjs** (master script)
   - Runs both scripts in sequence
   - Provides summary and next steps

## Usage

### Full Documentation Build

From `dot-x/plugin-sdk/scripts/`:

```bash
node build-docs.mjs
```

This will:
1. Generate markdown from TypeDoc
2. Sync Vue components
3. Generate demo wrappers

### Sync Components Only

If you only changed component examples:

```bash
node sync-components.mjs
```

Or from the docs repo:

```bash
cd dotmatrixlabs-docs
npm run sync-components
```

### Skip TypeDoc Generation

If you only need to sync components (TypeDoc output unchanged):

```bash
node build-docs.mjs --skip-typedoc
```

## Adding New Component Examples

1. **Edit** `src/components/fields/metadata.ts`:

```typescript
select: {
  registryKey: 'select',
  baseProps: {},
  docs: {
    examples: {
      'new-example': {  // Add new example
        label: 'Countries',
        options: ['USA', 'UK', 'Canada']
      }
    }
  }
}
```

2. **Run** the build script:

```bash
node build-docs.mjs
```

3. **View** in VitePress:

```bash
cd ../../../dotmatrixlabs-docs
npm run docs:dev
```

The Live Example will appear automatically at:
`http://localhost:5173/plugin-sdk/reference/settingsbuilder-components`

## How Live Examples Are Injected

The `generate-docs.mjs` script injects Live Examples via the `generateLiveExamplesSection()` function:

```typescript
function generateLiveExamplesSection(item, metadata) {
  // Maps display names to metadata keys
  const nameToKey = {
    'Badge Field': 'badge',
    'Input Field': 'input',
    'Select Field': 'select',
    // ...
  };
  
  // Generates VitePress-compatible markdown:
  // ### Live Examples
  // ::: details View Examples
  // <ClientOnly>
  //   <demo-input-basic />
  //   <demo-input-required />
  // </ClientOnly>
  // :::
}
```

This section is inserted **after the description** and **before the Methods** table for each component.

## File Locations

### Source Files (dot-x repo)
- Component metadata: `src/components/fields/metadata.ts`
- Vue components: `src/components/fields/*.vue`
- Component registry: `src/components/fields/registry.ts`
- TypeDoc source: `plugin-sdk/src/ui.ts`

### Generated Files (docs repo)
- Markdown: `docs/plugin-sdk/reference/settingsbuilder-components.md`
- Vue components: `docs/.vitepress/components/fields/*.vue`
- Demo wrappers: `docs/.vitepress/components/demos/Demo*.vue`

## Important Notes

⚠️ **Do NOT edit generated files manually!**
- `settingsbuilder-components.md` is auto-generated
- Demo wrapper components are auto-generated
- Any manual edits will be overwritten

✅ **Always edit source files:**
- `metadata.ts` for examples
- `ui.ts` for API documentation
- Component `.vue` files for UI changes

## Troubleshooting

### Live Examples not showing

1. Check if sync-components ran:
```bash
ls -la ../../../dotmatrixlabs-docs/docs/.vitepress/components/demos/
```

2. Regenerate everything:
```bash
node build-docs.mjs
```

3. Clear VitePress cache:
```bash
cd ../../../dotmatrixlabs-docs
rm -rf docs/.vitepress/cache
npm run docs:dev
```

### Components not found

Ensure paths are correct in `sync-components.mjs`:
- `DOT_X_FIELDS`: Points to `src/components/fields/`
- `DOCS_ROOT`: Points to `dotmatrixlabs-docs/`

### Wrong metadata key

Check the `nameToKey` mapping in `generate-docs.mjs`:
```typescript
const nameToKey = {
  'Badge Field': 'badge',  // Must match metadata.ts keys
  'Input Field': 'input',
  // ...
};
```

## Integration with VitePress

The docs repo's `package.json` calls these scripts:

```json
{
  "scripts": {
    "sync-components": "node ../dot-x/plugin-sdk/scripts/sync-components.mjs",
    "build-plugin-docs": "node ../dot-x/plugin-sdk/scripts/build-docs.mjs",
    "docs:dev": "npm run sync-components && vitepress dev docs",
    "docs:build": "npm run sync-components && vitepress build docs"
  }
}
```

VitePress automatically imports demo components from `docs/.vitepress/components/demos/`.


