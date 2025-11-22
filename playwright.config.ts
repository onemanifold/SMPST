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
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    // Must match vite.config.ts base path for GitHub Pages deployment
    baseURL: 'http://localhost:4173/SMPST/',
    trace: 'on-first-retry',
    screenshot: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Launch args to prevent crashes with heavy Monaco Editor
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
          ],
        },
      },
    },
    // Add Firefox and WebKit for full coverage in CI
    ...(process.env.CI ? [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ] : []),
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
