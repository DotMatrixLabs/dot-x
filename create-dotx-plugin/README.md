# create-dotx-plugin

Scaffold a Dot X plugin project.

## Usage

```bash
npx create-dotx-plugin --name "My Plugin"
```

Or with npm's create shortcut:

```bash
npm create dotx-plugin -- --name "My Plugin"
```

## Options

- `--deno` (default): Deno + TypeScript template
- `--node`: Node + TypeScript + esbuild template with `plugin.zip` packaging
- `--id <id>`: Override the generated plugin id
- `--force`: Overwrite existing files

## Generated Projects

Node templates depend on `dotx-plugin-sdk` from npm and include:

- `npm run build`
- `npm run package`
- `.github/workflows/release-plugin.yml`
- no special local SDK path wiring; the generated project consumes the published `dotx-plugin-sdk` package directly

Deno templates import `dotx-plugin-sdk` through Deno's `npm:` support.
