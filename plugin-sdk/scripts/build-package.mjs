import { build } from 'esbuild';

const shared = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  packages: 'external',
  logLevel: 'info',
};

await build({
  ...shared,
  format: 'esm',
  outfile: 'dist/index.mjs',
});

await build({
  ...shared,
  format: 'cjs',
  outfile: 'dist/index.cjs',
});
