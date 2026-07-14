import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// apps/web unit tests cover pure display/derivation logic (lib/*) — no React rendering, so a
// node environment is enough (component behaviour is tested in packages/ui). The `@/` alias
// mirrors tsconfig's paths so imports resolve the same way as in the app.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
