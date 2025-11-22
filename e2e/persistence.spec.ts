import { test, expect } from '@playwright/test';

test.describe('Editor Content Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    // Use empty string to respect baseURL path (/SMPST/)
    await page.goto('');
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist editor content on page refresh', async ({ page }) => {
    await page.goto('');

    // Wait for editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Type some content in the editor
    const editor = page.locator('.monaco-editor textarea');
    await editor.click();
    await editor.fill('global protocol TestProtocol { }');

    // Wait for auto-save debounce (2 seconds + buffer)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.reload();

    // Wait for editor to reload
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Verify content is restored
    const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
    expect(editorContent).toContain('TestProtocol');
  });

  test('should not restore content older than 24 hours', async ({ page }) => {
    // Set old content in localStorage
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    const oldState = {
      ui: { theme: 'dark', sidebarCollapsed: false, sidebarWidth: 280, editorFontSize: 13, editorWordWrap: false, editorMinimap: true, outputPanelCollapsed: false, visualizerPanelSize: 400 },
      simulation: { executionMode: 'cfg', choiceStrategy: 'manual', schedulingStrategy: 'manual', deliveryModel: 'FIFO', playbackSpeed: 300, maxSteps: 1000 },
      editor: { lastContent: 'global protocol OldProtocol { }', lastContentTimestamp: oldTimestamp, recentExamples: [] },
      version: 1
    };

    await page.goto('');
    await page.evaluate((state) => {
      localStorage.setItem('smpst-persisted-state', JSON.stringify(state));
    }, oldState);

    // Reload
    await page.reload();
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Editor should be empty (old content not restored)
    const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
    expect(editorContent).not.toContain('OldProtocol');
  });
});

test.describe('Theme Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('');
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist theme preference', async ({ page }) => {
    // Use hash route without leading / to respect baseURL path
    await page.goto('#/settings');

    // Wait for settings page
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    // Click light theme button
    await page.click('button:has-text("Light")');

    // Wait for save
    await page.waitForTimeout(1000);

    // Reload and check theme is preserved
    await page.reload();
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    // Check that html has light theme
    const theme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(theme).toBe('light');
  });
});

test.describe('Routing', () => {
  test('should navigate to editor route', async ({ page }) => {
    // Use hash route without leading / to respect baseURL path (/SMPST/)
    await page.goto('#/');

    // Should show editor page
    await page.waitForSelector('.editor-page, .code-tab', { timeout: 10000 });
  });

  test('should navigate to simulation route', async ({ page }) => {
    // First load a protocol so simulation is accessible
    await page.goto('');
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Navigate to simulation
    await page.goto('#/simulation');

    // Should show simulation page (or redirect message if no protocol)
    await page.waitForSelector('.simulation-page, .no-protocol', { timeout: 10000 });
  });

  test('should navigate to settings route', async ({ page }) => {
    await page.goto('#/settings');

    // Should show settings page
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    // Check for settings sections
    await expect(page.locator('h2:has-text("Appearance")')).toBeVisible();
    await expect(page.locator('h2:has-text("Editor")')).toBeVisible();
    await expect(page.locator('h2:has-text("Simulation")')).toBeVisible();
  });

  test('should redirect from simulation to editor when no protocol loaded', async ({ page }) => {
    // Clear any stored state
    await page.goto('');
    await page.evaluate(() => localStorage.clear());

    // Try to go to simulation directly
    await page.goto('#/simulation');

    // Should show "no protocol" message or redirect to editor
    // Use .first() because both .editor-page and .code-tab may exist as nested elements
    const noProtocol = page.locator('.no-protocol');
    const editor = page.locator('.editor-page').first();

    await expect(noProtocol.or(editor)).toBeVisible({ timeout: 10000 });
  });

  test('should handle back button navigation', async ({ page }) => {
    await page.goto('#/');
    // Use .editor-page only to avoid ambiguity (both .editor-page and .code-tab exist as nested elements)
    await page.waitForSelector('.editor-page', { timeout: 10000 });

    // Navigate to settings
    await page.goto('#/settings');
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    // Go back
    await page.goBack();

    // Should be back at editor
    await page.waitForSelector('.editor-page', { timeout: 10000 });
  });
});

test.describe('Tab Navigation', () => {
  test('should switch between CODE and SIMULATION tabs', async ({ page }) => {
    await page.goto('');
    await page.waitForSelector('.tab-bar', { timeout: 10000 });

    // Click CODE tab
    await page.click('.tab:has-text("CODE")');
    // Use .editor-page only to avoid ambiguity (both .editor-page and .code-tab exist as nested elements)
    await expect(page.locator('.editor-page')).toBeVisible();

    // Click SIMULATION tab
    await page.click('.tab:has-text("SIMULATION")');
    // Should show simulation or no-protocol message
    await expect(page.locator('.simulation-page, .no-protocol').first()).toBeVisible();
  });
});
