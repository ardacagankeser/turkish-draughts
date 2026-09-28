/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Served from https://<user>.github.io/turkish-draughts/ on GitHub Pages.
  base: process.env.GITHUB_PAGES === 'true' ? '/turkish-draughts/' : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/ai/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
