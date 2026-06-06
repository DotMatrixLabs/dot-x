import * as esbuild from '../../node_modules/esbuild/lib/main.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

await esbuild.build({
  entryPoints: [resolve(__dirname, 'main.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: resolve(__dirname, 'dist/main.js'),
  format: 'cjs',
  alias: {
    '@dotmatrixlabs/dotx-plugin-sdk': resolve(__dirname, '../../dist/index.cjs'),
  },
  logLevel: 'info',
});
