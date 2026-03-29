#!/usr/bin/env node
// Minimal-deps NPX scaffolder for Dot X plugins
// Usage: npx create-dotx-plugin [--name My Plugin] [--id my-plugin] [--deno|--node] [--force]

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { dotxPluginSdkVersion: SDK_PACKAGE_VERSION } = require('../package.json');

function parseArgs(argv) {
  const args = { deno: true, node: false, force: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deno') args.deno = true, args.node = false;
    else if (a === '--node') args.node = true, args.deno = false;
    else if (a === '--force') args.force = true;
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--id') args.id = argv[++i];
    else if (!args.name && !a.startsWith('--')) args.name = a;
  }
  return args;
}

function toId(name) {
  return (name || 'hello-world')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-\s_]/g, '')
    .replace(/[\s_]+/g, '-');
}

function writeFileSafe(filePath, content, force) {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`File exists: ${path.basename(filePath)} (use --force to overwrite)`);
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
}

function nodeBuildScript() {
  return `const path = require('path');
const esbuild = require('esbuild');

const repoRoot = path.resolve(__dirname, '..');

async function main() {
  await esbuild.build({
    entryPoints: [path.join(repoRoot, 'main.ts')],
    outfile: path.join(repoRoot, 'main.js'),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node16',
    minify: true,
  });

  console.log('Built main.js');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
`;
}

function nodePackageScript() {
  return `const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const stageDir = path.join(distDir, 'package');
const zipPath = path.join(distDir, 'plugin.zip');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(sourcePath, destinationPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(
        path.join(sourcePath, entry),
        path.join(destinationPath, entry)
      );
    }
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function addOptionalPath(relativePath, includedPaths) {
  const sourcePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  includedPaths.add(relativePath);
}

function main() {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const manifestPath = path.join(repoRoot, 'manifest.json');
  const mainJsPath = path.join(repoRoot, 'main.js');

  if (!fs.existsSync(mainJsPath)) {
    throw new Error('main.js not found. Run the build step before packaging.');
  }

  const packageJson = readJson(packageJsonPath);
  const manifest = readJson(manifestPath);
  if (manifest.main !== 'main.js') {
    throw new Error(\`manifest.json must set "main" to "main.js". Found: \${manifest.main}\`);
  }
  if (packageJson.version !== manifest.version) {
    throw new Error(
      \`package.json version (\${packageJson.version}) must match manifest.json version (\${manifest.version})\`
    );
  }

  fs.mkdirSync(distDir, { recursive: true });
  ensureCleanDir(stageDir);
  fs.rmSync(zipPath, { force: true });

  copyRecursive(manifestPath, path.join(stageDir, 'manifest.json'));
  copyRecursive(mainJsPath, path.join(stageDir, 'main.js'));

  const includedPaths = new Set();
  for (const defaultPath of ['assets', 'data', 'bin']) {
    addOptionalPath(defaultPath, includedPaths);
  }

  for (const extraPath of packageJson.dotxPlugin?.include || []) {
    if (typeof extraPath !== 'string' || !extraPath.trim()) {
      throw new Error('package.json dotxPlugin.include entries must be non-empty strings');
    }
    addOptionalPath(extraPath, includedPaths);
  }

  for (const relativePath of includedPaths) {
    copyRecursive(
      path.join(repoRoot, relativePath),
      path.join(stageDir, relativePath)
    );
  }

  const zip = new AdmZip();
  zip.addLocalFolder(stageDir);
  zip.writeZip(zipPath);

  console.log(\`Created \${path.relative(repoRoot, zipPath)}\`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
`;
}

function nodeVerifyReleaseVersionScript() {
  return `const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
  );
}

function main() {
  const packageJson = readJson('package.json');
  const manifest = readJson('manifest.json');
  const releaseTag = process.env.RELEASE_TAG || '';

  if (packageJson.version !== manifest.version) {
    throw new Error(
      \`Version mismatch: package.json=\${packageJson.version}, manifest.json=\${manifest.version}\`
    );
  }

  if (manifest.main !== 'main.js') {
    throw new Error(\`manifest.json must reference main.js. Found: \${manifest.main}\`);
  }

  if (releaseTag) {
    const acceptedTags = new Set([manifest.version, \`v\${manifest.version}\`]);
    if (!acceptedTags.has(releaseTag)) {
      throw new Error(
        \`Release tag \${releaseTag} must match \${manifest.version} or v\${manifest.version}\`
      );
    }
  }

  console.log(\`Verified release version \${manifest.version}\`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
`;
}

function nodeReleaseWorkflow() {
  return `name: Release Plugin

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write
  id-token: write

jobs:
  build-release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm install

      - name: Verify release version
        run: npm run release:verify-version
        env:
          RELEASE_TAG: \${{ github.ref_type == 'tag' && github.ref_name || '' }}

      - name: Build release package
        run: npm run package

      - name: Upload package artifact
        uses: actions/upload-artifact@v4
        with:
          name: plugin-package
          path: dist/plugin.zip
          if-no-files-found: error

      - name: Publish GitHub Release asset
        if: github.ref_type == 'tag'
        uses: softprops/action-gh-release@v2
        with:
          files: dist/plugin.zip
          fail_on_unmatched_files: true
          generate_release_notes: true
`;
}

function denoTemplates(meta) {
  const README = `# ${meta.name}\n\nA minimal plugin for Dot X. This template includes a Deno + TypeScript setup by default.\n\n## Prerequisites\n- Dot X application running (starts the local plugin server)\n- Deno 1.41+ (or Node 16+ if using the Node template)\n\n## Quick start (Deno)\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n deno task start\n\nThis runs \`main.ts\` with all permissions and connects to the Dot X plugin server.\n\n## Development workflow\n- Edit \`main.ts\` and save; restart the task to pick up changes\n- Watch logs in the Dot X app and in \`plugin.log\` (created next to your files)\n- Implement your plugin logic inside the \`onLoad()\` method\n\n### Common tasks\n- Start: \`deno task start\`\n- Lint (optional): \`deno lint\`\n- Format (optional): \`deno fmt\`\n\n## Optional: Node + esbuild\nIf you prefer Node, install deps and build:\n\n\n\n\n\n\n\n\n\n\n\n\n\n npm install\n npm run build\n node main.js\n\nRecommended when you scaffolded with the \`--node\` flag.\n\n## File structure\n\n\n\n\n\n\n\n\n\n\n manifest.json   # Plugin metadata (id, name, entry file)\n main.ts         # Plugin entrypoint (uses runPlugin from the SDK)\n deno.json       # Deno task (start)\n .gitignore      # Useful ignores (node_modules, plugin.log)\n README.md       # This file\n\n## Troubleshooting\n- Ensure the Dot X app is running before starting the plugin\n- If connection fails, the SDK will retry and print detailed hints\n- Check firewall/antivirus if timeouts persist\n\n## Learn more\n- Getting Started: <DOCS_BASE_URL>/plugin-sdk/getting-started/first-plugin\n- Examples: <DOCS_BASE_URL>/plugin-sdk/examples\n- Manifest reference: <DOCS_BASE_URL>/plugin-sdk/manifest\n- SDK Reference: <DOCS_BASE_URL>/plugin-sdk/sdk-reference\n`;

  return {
    'manifest.json': JSON.stringify({
      id: meta.id,
      name: meta.name,
      version: '0.1.0',
      description: 'A minimal Dot X plugin',
      author: '',
      main: 'main.ts'
    }, null, 2) + '\n',
    'main.ts': `import Plugin, { runPlugin } from "npm:dotx-plugin-sdk";

class HelloWorld extends Plugin {
  async onLoad() {
    await this.ui.showToast({ message: "Hello from plugin!", type: "success" });
  }
}

runPlugin(HelloWorld);
`,
    'deno.json': JSON.stringify({ tasks: { start: 'deno run --allow-all main.ts' }, nodeModulesDir: 'auto' }, null, 2) + '\n',
    '.gitignore': `node_modules\nplugin.log\n.DS_Store\n`,
    'README.md': README
  };
}

function nodeTemplates(meta) {
  const pkg = {
    name: meta.id,
    version: '0.1.0',
    private: true,
    type: 'commonjs',
    scripts: {
      build: 'node scripts/build-plugin.js',
      package: 'npm run build && node scripts/package-plugin.js',
      'release:verify-version': 'node scripts/verify-release-version.js',
      'release:build': 'npm run release:verify-version && npm run package',
      start: 'node main.js'
    },
    dependencies: {
      'dotx-plugin-sdk': SDK_PACKAGE_VERSION
    },
    devDependencies: {
      'adm-zip': '^0.5.16',
      'esbuild': '^0.25.6'
    }
  };

  const README = `# ${meta.name}

A minimal plugin for Dot X (Node + esbuild).

## Quick start (Node)

\`\`\`bash
npm install
npm run build
node main.js
\`\`\`

Ensure the Dot X app is running before starting the plugin.

## Marketplace Packaging

\`\`\`bash
npm run package
\`\`\`

This creates \`dist/plugin.zip\` with:

- \`manifest.json\`
- \`main.js\`
- optional \`assets/\`, \`data/\`, and \`bin/\`
- any extra paths listed in \`package.json\` under \`dotxPlugin.include\`

## GitHub Releases

This template includes a GitHub Actions workflow at \`.github/workflows/release-plugin.yml\`.

Push a version tag such as \`v0.1.0\` and GitHub Actions will:

- verify the tag matches \`package.json\` and \`manifest.json\`
- build \`main.js\`
- create \`dist/plugin.zip\`
- upload \`plugin.zip\` to the GitHub Release

See Deno alternative in docs if preferred.
`;

  return {
    'manifest.json': JSON.stringify({
      id: meta.id,
      name: meta.name,
      version: '0.1.0',
      description: 'A minimal Dot X plugin',
      author: '',
      main: 'main.js'
    }, null, 2) + '\n',
    'main.ts': `import Plugin, { runPlugin } from 'dotx-plugin-sdk';

class HelloWorld extends Plugin {
  async onLoad() {
    await this.ui.showToast({ message: 'Hello from plugin!', type: 'success' });
  }
}

runPlugin(HelloWorld);
`,
    'package.json': JSON.stringify(pkg, null, 2) + '\n',
    '.gitignore': `dist/\nnode_modules\nplugin.log\nvendor/\n.DS_Store\n`,
    'README.md': README,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        strict: true,
        esModuleInterop: true
      }
    }, null, 2) + '\n',
    'scripts/build-plugin.js': nodeBuildScript(),
    'scripts/package-plugin.js': nodePackageScript(),
    'scripts/verify-release-version.js': nodeVerifyReleaseVersionScript(),
    '.github/workflows/release-plugin.yml': nodeReleaseWorkflow()
  };
}

function main() {
  const args = parseArgs(process.argv);
  const name = args.name || 'Hello World Plugin';
  const id = toId(args.id || name);
  const cwd = process.cwd();

  const template = args.node ? nodeTemplates({ id, name }) : denoTemplates({ id, name });

  try {
    Object.entries(template).forEach(([file, content]) => {
      writeFileSafe(path.join(cwd, file), content, args.force);
    });
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }

  console.log(`\nScaffolded Dot X plugin in ${cwd}`);
  console.log(`\nNext steps:`);
  if (args.node) {
    console.log(`  1) npm install`);
    console.log(`  2) npm run build`);
    console.log(`  3) node main.js`);
    console.log(`  4) push a tag like v0.1.0 to publish plugin.zip`);
  } else {
    console.log(`  1) deno task start`);
  }
}

main();
