# Hello World

A minimal plugin for Dot X (Node + esbuild).

## Package Overview

This project uses one direct npm dependency:

- `@dotmatrixlabs/dotx-plugin-sdk` for the runtime SDK and the `dotx-plugin` packaging CLI

## Quick start (Node)

```bash
npm install
npm run build
npm start
```

Ensure the Dot X app is running before starting the plugin.

## Marketplace Packaging

```bash
npm run package
```

This creates `dist/plugin.zip` with:

- `manifest.json`
- the file declared by `manifest.main`
- optional `assets/`, `data/`, and `bin/`
- any extra paths listed in `manifest.json` under `packaging.include`

Example:

```json
{
  "packaging": {
    "include": ["locales", "templates/email.html"]
  }
}
```

## GitHub Releases

This template includes a GitHub Actions workflow at `.github/workflows/release-plugin.yml`.

Push a version tag such as `v0.1.0` and GitHub Actions will:

- verify the tag matches `package.json` and `manifest.json`
- validate marketplace-required manifest fields
- build the file referenced by `manifest.main`
- create `dist/plugin.zip`
- upload `plugin.zip` to the GitHub Release

Recommended release flow:

1. update `manifest.json` and `package.json` to the release version
2. commit and push your changes
3. push a tag such as `v0.1.0`
4. let GitHub Actions build and attach `dist/plugin.zip` to the release

See Deno alternative in docs if preferred.
