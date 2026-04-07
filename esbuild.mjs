import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const sharedOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
};

const extensionBuild = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  external: ['vscode'],
};

const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/index.ts'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
};

function copyAssets() {
  copyFileSync('src/webview/styles.css', 'dist/styles.css');
}

if (isWatch) {
  const [extCtx, webCtx] = await Promise.all([
    esbuild.context(extensionBuild),
    esbuild.context(webviewBuild),
  ]);
  copyAssets();
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(webviewBuild),
  ]);
  copyAssets();
}
