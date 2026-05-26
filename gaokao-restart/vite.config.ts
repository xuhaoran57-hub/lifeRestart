import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('admissions/')) return 'content-admission';
          if (id.includes('content/zh-cn/') && id.endsWith('.json')) return 'content-core';
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
