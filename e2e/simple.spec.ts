import { test, expect } from '@playwright/test';

test('check fallback textarea', async ({ page }) => {
  await page.goto('', { waitUntil: 'domcontentloaded' });

  // Wait for the fallback textarea to appear
  const textarea = page.locator('.fallback-textarea');
  await expect(textarea.first()).toBeVisible({ timeout: 10000 });

  const count = await textarea.count();
  expect(count).toBeGreaterThan(0);
});
