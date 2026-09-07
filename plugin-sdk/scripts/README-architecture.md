# Plugin SDK Documentation Architecture

## Quick Reference

### To Update Documentation

```bash
# From plugin-sdk root (recommended)
cd dot-x/plugin-sdk
npm run docs:build -- --docs-root /path/to/dotmatrixlabs-docs
npm run docs:build:fast -- --docs-root /path/to/dotmatrixlabs-docs

# Or from scripts directory
cd dot-x/plugin-sdk/scripts
node build-docs.mjs --docs-root /path/to/dotmatrixlabs-docs
node build-docs.mjs --docs-root /path/to/dotmatrixlabs-docs --skip-typedoc
```

`dotmatrixlabs-docs` remains a separate repository. Pass its checkout root with `--docs-root` or set `DOTX_DOCS_ROOT`. The scripts exit before writing files when that configuration is absent or invalid.

### To Add New Examples

1. Edit `dot-x/src/components/fields/metadata.ts`
2. Run `node build-docs.mjs --docs-root /path/to/dotmatrixlabs-docs --skip-typedoc`
3. View at `http://localhost:5173/plugin-sdk/reference/settingsbuilder-components`

## File Structure

```
dot-x/
├── src/components/fields/
│   ├── registry.ts              # Component registry (source of truth)
│   ├── metadata.ts              # Documentation examples
│   └── *.vue                    # Vue components
│
└── plugin-sdk/
    ├── src/ui.ts                # TypeDoc source (API docs)
    └── scripts/
        ├── generate-docs.mjs    # TypeDoc → Markdown + Live Examples
        ├── sync-components.mjs  # Copy Vue + Generate demos
        └── build-docs.mjs       # Master script (runs both)

dotmatrixlabs-docs/
├── docs/
│   ├── .vitepress/
│   │   ├── config.mts           # VitePress config
│   │   └── components/
│   │       ├── fields/          # Copied Vue components
│   │       └── demos/           # Generated demo wrappers
│   │
│   └── plugin-sdk/reference/
│       └── settingsbuilder-components.md  # Auto-generated!
│
└── package.json                 # Calls plugin-sdk scripts
```

## How It Works

### 1. Component Metadata (`metadata.ts`)

**Purpose:** Define documentation examples with props for each component type

**Structure:**
```typescript
{
  [componentKey]: {
    registryKey: string,      // Points to registry.ts
    baseProps: object,        // Applied to ALL examples
    category: string,
    docs: {
      title: string,
      description: string,
      examples: {
        [exampleName]: object  // Props for this specific demo
      }
    }
  }
}
```

**Example:**
```typescript
input: {
  registryKey: 'input',
  baseProps: { type: 'text' },
  docs: {
    examples: {
      basic: { label: 'Username', placeholder: 'Enter username' },
      required: { label: 'Email', required: true }
    }
  }
}
```

### 2. generate-docs.mjs

**What it does:**
- Reads `ui.ts` via TypeDoc JSON
- Loads `metadata.ts` for component examples
- Generates markdown with injected Live Examples sections

**Key function:** `generateLiveExamplesSection()`

**Output format:**
```markdown
## Input Field

Handle for configuring an input field.

### Live Examples

::: details View Examples
<ClientOnly>
  <demo-input-basic />
  <demo-input-required />
</ClientOnly>
:::

### Methods
...
```

**When to run:**
- After changing `ui.ts` (API docs)
- After adding/removing components
- After changing component descriptions

### 3. sync-components.mjs

**What it does:**
- Reads `registry.ts` to find Vue component files
- Copies Vue components from `src/components/fields/` to docs
- Reads `metadata.ts` to get example configurations
- Generates demo wrapper components with merged props

**Example generated demo:**
```vue
<!-- DemoInputBasic.vue -->
<script setup>
import Input from '../fields/Input.vue';
</script>

<template>
  <div class="demo-wrapper">
    <Input
      type="text"
      label="Username"
      placeholder="Enter username"
      value=""
    />
  </div>
</template>
```

**When to run:**
- After changing component examples in `metadata.ts`
- After changing Vue component files
- Before running VitePress

### 4. build-docs.mjs

**What it does:**
- Orchestrates both scripts in sequence
- Provides progress output
- Handles errors

**Flags:**
- `--skip-typedoc`: Skip TypeDoc generation (faster for Vue-only changes)

## Data Flow

```
┌─────────────┐
│   ui.ts     │ ──┐
│  (TypeDoc)  │   │
└─────────────┘   │
                  ▼
              ┌───────────────────┐
              │ generate-docs.mjs │
              └───────────────────┘
                  │
                  │ Reads
                  ▼
┌─────────────┐   ┌─────────────┐
│ metadata.ts │──▶│ Injects     │
└─────────────┘   │ Live        │
                  │ Examples    │
                  └─────────────┘
                  │
                  ▼
              ┌───────────────────────────────┐
              │ settingsbuilder-components.md │
              └───────────────────────────────┘


┌─────────────┐   ┌─────────────┐
│ registry.ts │──▶│   sync-     │
└─────────────┘   │ components  │
                  │   .mjs      │
┌─────────────┐   │             │
│ metadata.ts │──▶│             │
└─────────────┘   └─────────────┘
                  │
                  ├─ Copies ──▶ ┌────────────────┐
                  │              │ fields/*.vue   │
                  │              └────────────────┘
                  │
                  └─ Generates ▶ ┌────────────────┐
                                 │ demos/Demo*.vue│
                                 └────────────────┘
```

## Common Workflows

### Update API Documentation

```bash
# 1. Edit ui.ts (add/modify TypeDoc comments)
# 2. Regenerate docs
cd dot-x/plugin-sdk/scripts
node build-docs.mjs --docs-root "$DOTX_DOCS_ROOT"

# 3. View changes
cd "$DOTX_DOCS_ROOT"
npm run docs:dev
```

### Add New Component Example

```bash
# 1. Edit metadata.ts (add new example)
# 2. Sync components only (faster)
cd dot-x/plugin-sdk/scripts
node build-docs.mjs --docs-root "$DOTX_DOCS_ROOT" --skip-typedoc

# 3. View changes
cd "$DOTX_DOCS_ROOT"
npm run docs:dev
```

### Modify Vue Component UI

```bash
# 1. Edit Vue component file (e.g., Input.vue)
# 2. Sync components only
cd dot-x/plugin-sdk/scripts
node sync-components.mjs --docs-root "$DOTX_DOCS_ROOT"

# 3. VitePress hot reload will show changes
# (if docs:dev is already running)
```

## Registry as Source of Truth

The `registry.ts` file is the **single source of truth** for component resolution:

```typescript
export const componentRegistry: Record<string, any> = {
  input: Input,           // 'input' → Input.vue
  select: Select,         // 'select' → Select.vue
  password_pin: PasswordInput,  // 'password_pin' → PasswordInput.vue
  // ...
};
```

Both `generate-docs.mjs` and `sync-components.mjs` use these keys to:
- Find the correct Vue component file
- Map SettingsBuilder types to components
- Generate demo components

## Important Rules

### ✅ DO

- Edit `metadata.ts` to add/modify examples
- Edit `ui.ts` to change API documentation
- Edit Vue components to change UI/behavior
- Run `build-docs.mjs` after changes
- Use `--skip-typedoc` for faster Vue-only updates

### ❌ DON'T

- Edit `settingsbuilder-components.md` manually (auto-generated!)
- Edit demo wrapper components (auto-generated!)
- Commit temporary TypeDoc JSON files
- Run only one script when both are needed

## Troubleshooting

### Live Examples not showing

```bash
# Clear caches and rebuild everything
cd dot-x/plugin-sdk/scripts
node build-docs.mjs --docs-root "$DOTX_DOCS_ROOT"

cd "$DOTX_DOCS_ROOT"
rm -rf docs/.vitepress/cache
npm run docs:dev
```

### Wrong docs root

Pass `--docs-root /path/to/dotmatrixlabs-docs` or set `DOTX_DOCS_ROOT`. The command-line option wins when both are present.

### Component not found

Verify the component is:
1. Listed in `registry.ts`
2. Has a corresponding entry in `metadata.ts`
3. Exists as a `.vue` file in `src/components/fields/`

### Demo props not correct

Check in `metadata.ts`:
- `baseProps`: Applied to ALL examples
- `docs.examples[name]`: Specific to each example
- Props are merged: `{ ...baseProps, ...exampleProps }`

