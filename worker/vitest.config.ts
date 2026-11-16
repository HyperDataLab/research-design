import { defineConfig } from 'vitest/config';

// The worker runs on Cloudflare, not in a browser: its tests use Node's fetch and Web Crypto.
export default defineConfig({
  test: { environment: 'node', include: ['worker/src/**/*.test.ts'] },
});
