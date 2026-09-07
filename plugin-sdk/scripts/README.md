# Plugin SDK Documentation Scripts

This directory contains all scripts for generating Plugin SDK documentation with Live Vue component examples.

## Quick Start

Clone `dotmatrixlabs-docs` separately. Pass its checkout root with `--docs-root` or set `DOTX_DOCS_ROOT`. The scripts stop before writing files if the configured directory does not exist.

```bash
# From plugin-sdk root
cd dot-x/plugin-sdk

# Full documentation build (recommended)
npm run docs:build -- --docs-root /path/to/dotmatrixlabs-docs

# Fast build (skip TypeDoc, only sync components)
npm run docs:build:fast -- --docs-root /path/to/dotmatrixlabs-docs

# Or run scripts directly
cd scripts
node build-docs.mjs --docs-root /path/to/dotmatrixlabs-docs
node build-docs.mjs --docs-root /path/to/dotmatrixlabs-docs --skip-typedoc
```

## Scripts Overview

| Script | Purpose | When to Use |
|--------|---------|-------------|
| **build-docs.mjs** | Master script that runs both steps | Always (unless you know what you're doing) |
| **generate-docs.mjs** | Generates markdown from TypeDoc + injects Live Examples | After editing `ui.ts` or component descriptions |
| **sync-components.mjs** | Copies Vue components and generates demo wrappers | After editing Vue components or `metadata.ts` examples |

## Workflow

### 1. Add New Component Examples

```bash
# 1. Edit metadata
vim ../src/components/fields/metadata.ts

# Add new example:
# select: {
#   docs: {
#     examples: {
#       'my-new-example': { label: 'Test', options: [...] }
#     }
#   }
# }

# 2. Build docs (skip TypeDoc for speed)
node build-docs.mjs --docs-root "$DOTX_DOCS_ROOT" --skip-typedoc

# 3. View changes
cd "$DOTX_DOCS_ROOT"
npm run docs:dev
# Visit: http://localhost:5173/plugin-sdk/reference/settingsbuilder-components
```

### 2. Update API Documentation

```bash
# 1. Edit TypeDoc comments in ui.ts
vim ../src/ui.ts

# 2. Regenerate all docs
node build-docs.mjs --docs-root "$DOTX_DOCS_ROOT"

# 3. View changes
cd "$DOTX_DOCS_ROOT"
npm run docs:dev
```

### 3. Modify Vue Component UI

```bash
# 1. Edit component
vim ../../src/components/fields/Input.vue

# 2. Sync components only
node sync-components.mjs --docs-root "$DOTX_DOCS_ROOT"

# 3. Changes will hot-reload if docs:dev is running
```

## Documentation

- **[README-architecture.md](./README-architecture.md)** - Complete architecture overview, data flow, and troubleshooting
- **[README-sync-components.md](./README-sync-components.md)** - Detailed guide for the component sync system
- **[README-generate-docs.md](./README-generate-docs.md)** - TypeDoc generation documentation (existing)

## Key Files

### Source Files (dot-x repo)
```
dot-x/
├── src/components/fields/
│   ├── registry.ts        ← Source of truth for components
│   ├── metadata.ts        ← Edit to add/modify examples
│   └── *.vue             ← Vue component files
└── plugin-sdk/
    ├── src/ui.ts          ← API documentation (TypeDoc)
    └── scripts/           ← You are here
```

### Generated Files (docs repo)
```
dotmatrixlabs-docs/
└── docs/
    ├── .vitepress/components/
    │   ├── fields/        ← Copied from dot-x
    │   └── demos/         ← Auto-generated wrappers
    └── plugin-sdk/reference/
        └── settingsbuilder-components.md  ← Auto-generated!
```

## Important Rules

### ✅ Always Edit

- `metadata.ts` - Component examples
- `ui.ts` - API documentation
- `*.vue` - Component UI/behavior

### ❌ Never Edit

- `settingsbuilder-components.md` - Auto-generated from TypeDoc
- `demos/Demo*.vue` - Auto-generated wrappers
- Any file in `dotmatrixlabs-docs/docs/.vitepress/components/`

## Live Examples System

The Live Examples feature automatically:

1. **Reads** `metadata.ts` for component examples
2. **Injects** Live Examples sections into generated markdown
3. **Copies** Vue components to docs repo
4. **Generates** demo wrapper components with proper props
5. **Renders** interactive components in VitePress

Example metadata entry:
```typescript
select: {
  registryKey: 'select',
  baseProps: {},
  docs: {
    examples: {
      basic: { label: 'Country', options: ['USA', 'UK'] },
      required: { label: 'Region', required: true }
    }
  }
}
```

Generates:
```markdown
### Live Examples

::: details View Examples
<ClientOnly>
  <demo-select-basic />
  <demo-select-required />
</ClientOnly>
:::
```

## NPM Scripts

The `plugin-sdk/package.json` provides convenient npm scripts:

```json
{
  "scripts": {
    "docs:generate": "node ./scripts/generate-docs.mjs",
    "docs:sync": "node ./scripts/sync-components.mjs",
    "docs:build": "node ./scripts/build-docs.mjs",
    "docs:build:fast": "node ./scripts/build-docs.mjs --skip-typedoc"
  }
}
```

Usage:
```bash
cd dot-x/plugin-sdk

# Full build
npm run docs:build -- --docs-root /path/to/dotmatrixlabs-docs

# Fast build (skip TypeDoc)
npm run docs:build:fast -- --docs-root /path/to/dotmatrixlabs-docs

# Individual steps
npm run docs:generate -- --docs-root /path/to/dotmatrixlabs-docs
npm run docs:sync -- --docs-root /path/to/dotmatrixlabs-docs
```

## Troubleshooting

### Components not showing
```bash
# Rebuild everything
node build-docs.mjs --docs-root "$DOTX_DOCS_ROOT"
cd "$DOTX_DOCS_ROOT"
rm -rf docs/.vitepress/cache
npm run docs:dev
```

### Wrong docs root

Pass `--docs-root /path/to/dotmatrixlabs-docs` or set `DOTX_DOCS_ROOT`. The value must name an existing directory. Command-line configuration takes precedence over the environment variable.

### Examples not updating
Make sure you're editing **`metadata.ts`**, not the generated markdown file!

## Need Help?

1. Read the architecture guide: [README-architecture.md](./README-architecture.md)
2. Check the sync guide: [README-sync-components.md](./README-sync-components.md)
3. Review data flow diagrams in architecture guide
4. Verify file locations match your setup

