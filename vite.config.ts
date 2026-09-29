/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Where the app is served from. GitHub Pages serves it under /turkish-draughts/, and
  // pull request previews under /turkish-draughts/pr-preview/pr-<n>/ (see .github/workflows).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tools/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/ai/**', 'src/ui/**'],
      exclude: ['src/ai/worker.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
