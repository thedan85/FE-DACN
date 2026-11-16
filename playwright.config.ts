import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'example.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.TASK18_E2E_JSON ?? 'task-18-e2e-results.json' }],
  ],
  outputDir: process.env.TASK18_E2E_OUTPUT ?? 'test-results',
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
