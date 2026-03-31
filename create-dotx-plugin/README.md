# @dotmatrixlabs/create-dotx-plugin

Scaffold a Dot X plugin project.

## Usage

```bash
npx @dotmatrixlabs/create-dotx-plugin --name "My Plugin"
```

Use `npx` as the primary scaffold command for the scoped package.

## Options

- `--deno` (default): Deno + TypeScript template
- `--node`: Node + TypeScript + esbuild template with `plugin.zip` packaging
- `--id <id>`: Override the generated plugin id
- `--force`: Overwrite existing files

## Generated Projects

Node templates depend on `@dotmatrixlabs/dotx-plugin-sdk` from npm and include:

- `npm run build`
- `npm run package`
- `.github/workflows/release-plugin.yml`
- manifest-driven packaging via `manifest.json -> packaging.include`
- no special local SDK path wiring; the generated project consumes the published `@dotmatrixlabs/dotx-plugin-sdk` package directly

Deno templates import `@dotmatrixlabs/dotx-plugin-sdk` through Deno's `npm:` support.

## Typical Node Workflow

```bash
mkdir my-plugin
cd my-plugin
npx @dotmatrixlabs/create-dotx-plugin --node --name "My Plugin"
npm install
npm run build
npm start
```

To create a marketplace package:

```bash
npm run package
```
