import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** Extension host: src/extension.ts → dist/extension.js */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: !isWatch,
};

/** Hooks: hooks/src/index.ts → hooks/dist/index.js */
const hooksConfig = {
  entryPoints: ['hooks/src/index.ts'],
  bundle: true,
  outfile: 'hooks/dist/index.js',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: false,
  minify: !isWatch,
  // No shebang needed - hooks.json uses `node` explicitly
};

async function build() {
  if (isWatch) {
    const extCtx = await esbuild.context(extensionConfig);
    const hookCtx = await esbuild.context(hooksConfig);
    await extCtx.watch();
    await hookCtx.watch();
    console.log('[esbuild] Watching extension + hooks...');
  } else {
    await esbuild.build(extensionConfig);
    await esbuild.build(hooksConfig);
    console.log('[esbuild] Extension + hooks built.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
