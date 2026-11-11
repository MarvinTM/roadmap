import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['shared/**/*.test.js', 'server/**/*.test.js', 'client/**/*.test.js'] },
});
