import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = process.env.ROADMAP_E2E_DIR ||= mkdtempSync(join(tmpdir(), 'airoadmap-e2e-'));

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  use: { baseURL: 'http://127.0.0.1:4177', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  globalTeardown: './tests/cleanup.js',
  webServer: [
    {
      command: 'node server/src/index.js', url: 'http://127.0.0.1:3107/api/health',
      env: { PORT: '3107', ROADMAP_DATA_FILE: join(directory, 'roadmap.json') },
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    {
      command: 'npm run dev -w client -- --port 4177 --strictPort', url: 'http://127.0.0.1:4177',
      env: { API_PORT: '3107' }, reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
  ],
});
