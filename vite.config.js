import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3030,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});