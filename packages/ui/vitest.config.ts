import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Pre-bundle the Phosphor icon barrel — importing its dist/ssr entry unoptimized
    // pulls thousands of modules and can hang collection (cold ~5 min). Optimizing it
    // once keeps the suite fast + reliable in CI.
    server: {
      deps: {
        optimizer: {
          web: { include: ['@phosphor-icons/react'] },
        },
      },
    },
  },
});
