import { defineConfig } from 'vitest/config';

// The timeouts of the framework test preset: 60 s for a test, 120 s for a hook.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.mts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
