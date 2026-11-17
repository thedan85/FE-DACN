import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.NOTIFICATIONS_E2E_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'notifications/**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.TASK16_E2E_JSON ?? 'task-16-browser-results.json' }],
  ],
  outputDir: process.env.TASK16_E2E_OUTPUT ?? 'test-results/notifications',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
