import { defineConfig, devices } from '@playwright/test';

/**
 * Root Playwright config for SUPER-MESHINE E2E tests.
 *
 * Round 7a: config only — no real tests yet (zero tests is acceptable for `pnpm e2e`).
 * Round 7b+: real flows will land in `e2e/`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
