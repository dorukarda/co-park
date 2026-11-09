import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { loadChangelog } from './scripts/changelog.mjs';

// Sürüm numarasının tek kaynağı package.json'dır.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// changelog.html içine CHANGELOG.md'nin HTML hâlini ve sürüm numarasını yerleştirir.
const changelogPage = () => ({
  name: 'co-park-changelog',
  transformIndexHtml(html) {
    return html
      .replace('<!--CHANGELOG-->', loadChangelog(new URL('./CHANGELOG.md', import.meta.url)))
      .replaceAll('__APP_VERSION__', pkg.version);
  },
});

// `npm run build` → dist/ (GitHub Pages: oyun + changelog sayfası)
// `npm run build:single` → dist-single/index.html (tek dosya, çift tıklayıp açılabilir)
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [changelogPage(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: mode === 'single' ? {} : { input: { main: 'index.html', changelog: 'changelog.html' } },
  },
  server: { open: true },
}));
