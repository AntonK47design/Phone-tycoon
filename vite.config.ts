import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    manifest: true,
    assetsInlineLimit: 0,
    // One game chunk (~1.1 MB, ~320 KB gzip) is intended; CrazyGames' initial target is 10 MB.
    chunkSizeWarningLimit: 1200,
  },
});
