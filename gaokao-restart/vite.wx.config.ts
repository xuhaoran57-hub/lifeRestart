import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'wxgame/js',
    emptyOutDir: true,
    target: 'es2018',
    minify: 'esbuild',
    lib: {
      entry: 'src/wxgame/main.ts',
      formats: ['cjs'],
      fileName: () => 'game.bundle.js',
    },
  },
});
