/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devApi } from './scripts/devApi';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  plugins: [react(), devApi()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.{ts,tsx}'],
      thresholds: { 'src/core/**': { lines: 90 } },
    },
  },
});
