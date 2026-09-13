import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/helpers/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    // Run test files sequentially (not in parallel workers) - they share one
    // real Postgres database and each test cleans/reseeds between runs, so
    // parallel workers would stomp on each other's data.
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
