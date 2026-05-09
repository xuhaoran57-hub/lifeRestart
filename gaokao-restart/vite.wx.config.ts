import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'wxgame/js',
    emptyOutDir: true,
    target: 'es2018',
    minify: false,
    lib: {
      entry: 'src/wxgame/main.ts',
      formats: ['iife'],
      name: 'GaokaoRestartWxGame',
      fileName: () => 'game.bundle.js',
    },
  },
});
