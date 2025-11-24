import { test, expect } from '@playwright/test';

test('check fallback textarea', async ({ page }) => {
  await page.goto('', { waitUntil: 'domcontentloaded' });

  // Wait for the active editor view with fallback textarea
  // With view persistence, need to check within active view
  await page.waitForSelector('.view.editor-view.active', { timeout: 10000 });

  const textarea = page.locator('.view.editor-view.active .fallback-textarea');
  const count = await textarea.count();
  expect(count).toBeGreaterThan(0);
});
