import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    manifest: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
