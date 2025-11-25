import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    // Must match vite.config.ts base path for GitHub Pages deployment
    baseURL: 'http://localhost:4173/SMPST/',
    trace: 'on-first-retry',
    screenshot: 'on',
    // Don't wait for full load - Monaco is heavy (but we use textarea fallback in headless)
    navigationTimeout: 15000,
    actionTimeout: 10000,
  },

  // Increase global timeout for heavy tests
  timeout: 60000,

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Disable sandbox for constrained environments (Docker/CI)
        // See: https://playwright.dev/docs/docker
        launchOptions: {
          chromiumSandbox: false,
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--single-process',
          ],
        },
      },
    },
  ],

  // Run dev server before tests
  webServer: {
    command: 'npm run preview',
    // Must match vite.config.ts base path for GitHub Pages deployment
    url: 'http://localhost:4173/SMPST/',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
