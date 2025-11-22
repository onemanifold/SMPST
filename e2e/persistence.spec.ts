import { test, expect, Page } from '@playwright/test';

/**
 * Navigate without waiting for full load (Monaco can crash during load)
 */
async function safeGoto(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * Helper to wait for editor - tries Monaco first, falls back to textarea
 * In constrained headless environments, Monaco may crash
 */
async function waitForEditor(page: Page, timeout = 10000): Promise<'monaco' | 'textarea'> {
  try {
    // Try Monaco first
    await page.waitForSelector('.monaco-editor', { timeout: timeout / 2 });
    return 'monaco';
  } catch {
    // Fall back to any textarea in the editor area
    await page.waitForSelector('.editor-page textarea, .code-tab textarea', { timeout: timeout / 2 });
    return 'textarea';
  }
}

/**
 * Helper to get editor content based on editor type
 */
async function getEditorContent(page: Page, editorType: 'monaco' | 'textarea'): Promise<string> {
  if (editorType === 'monaco') {
    return await page.locator('.monaco-editor .view-lines').textContent() || '';
  }
  return await page.locator('.editor-page textarea, .code-tab textarea').first().inputValue();
}

/**
 * Helper to set editor content based on editor type
 */
async function setEditorContent(page: Page, editorType: 'monaco' | 'textarea', content: string): Promise<void> {
  if (editorType === 'monaco') {
    const editor = page.locator('.monaco-editor textarea');
    await editor.click();
    await editor.fill(content);
  } else {
    const textarea = page.locator('.editor-page textarea, .code-tab textarea').first();
    await textarea.click();
    await textarea.fill(content);
  }
}

test.describe('Editor Content Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    // Use safeGoto to avoid waiting for Monaco which can crash
    await safeGoto(page, '');
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist editor content on page refresh', async ({ page }) => {
    await safeGoto(page, '');

    // Wait for editor (Monaco or fallback textarea)
    const editorType = await waitForEditor(page);

    // Type some content in the editor
    await setEditorContent(page, editorType, 'global protocol TestProtocol { }');

    // Wait for auto-save debounce (2 seconds + buffer)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.reload();

    // Wait for editor to reload
    await waitForEditor(page);

    // Verify content is restored
    const editorContent = await getEditorContent(page, editorType);
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

    await safeGoto(page, '');
    await page.evaluate((state) => {
      localStorage.setItem('smpst-persisted-state', JSON.stringify(state));
    }, oldState);

    // Reload
    await page.reload();
    const editorType = await waitForEditor(page);

    // Editor should be empty (old content not restored)
    const editorContent = await getEditorContent(page, editorType);
    expect(editorContent).not.toContain('OldProtocol');
  });
});

test.describe('Theme Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await safeGoto(page, '');
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist theme preference', async ({ page }) => {
    // Use hash route without leading / to respect baseURL path
    await safeGoto(page, '#/settings');

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
    await safeGoto(page, '#/');

    // Should show editor page (don't require Monaco, just the page container)
    await page.waitForSelector('.editor-page', { timeout: 10000 });
  });

  test('should navigate to simulation route', async ({ page }) => {
    // First load a protocol so simulation is accessible
    await safeGoto(page, '');
    // Wait for editor page to be visible (not Monaco specifically)
    await page.waitForSelector('.editor-page', { timeout: 10000 });

    // Navigate to simulation
    await safeGoto(page, '#/simulation');

    // Should show simulation page (or redirect message if no protocol)
    await page.waitForSelector('.simulation-page, .no-protocol', { timeout: 10000 });
  });

  test('should navigate to settings route', async ({ page }) => {
    await safeGoto(page, '#/settings');

    // Should show settings page
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    // Check for settings sections
    await expect(page.locator('h2:has-text("Appearance")')).toBeVisible();
    await expect(page.locator('h2:has-text("Editor")')).toBeVisible();
    await expect(page.locator('h2:has-text("Simulation")')).toBeVisible();
  });

  test('should redirect from simulation to editor when no protocol loaded', async ({ page }) => {
    // Clear any stored state
    await safeGoto(page, '');
    await page.evaluate(() => localStorage.clear());

    // Try to go to simulation directly
    await safeGoto(page, '#/simulation');

    // Should show "no protocol" message or redirect to editor
    const noProtocol = page.locator('.no-protocol');
    const editor = page.locator('.editor-page').first();

    await expect(noProtocol.or(editor)).toBeVisible({ timeout: 10000 });
  });

  test('should handle back button navigation', async ({ page }) => {
    await safeGoto(page, '#/');
    // Wait for editor page (not Monaco specifically)
    await page.waitForSelector('.editor-page', { timeout: 10000 });

    // Navigate to settings
    await safeGoto(page, '#/settings');
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    // Go back
    await page.goBack();

    // Should be back at editor
    await page.waitForSelector('.editor-page', { timeout: 10000 });
  });
});

test.describe('Tab Navigation', () => {
  test('should switch between CODE and SIMULATION tabs', async ({ page }) => {
    await safeGoto(page, '');
    await page.waitForSelector('.tab-bar', { timeout: 10000 });

    // Click CODE tab
    await page.click('.tab:has-text("CODE")');
    // Wait for editor page (not Monaco specifically)
    await expect(page.locator('.editor-page')).toBeVisible();

    // Click SIMULATION tab
    await page.click('.tab:has-text("SIMULATION")');
    // Should show simulation or no-protocol message
    await expect(page.locator('.simulation-page, .no-protocol').first()).toBeVisible();
  });
});
