import { test, expect, Page } from '@playwright/test';

// Navigation options - use 'commit' to not wait at all (let Svelte initialize)
const NAV_OPTIONS = { waitUntil: 'commit' as const };

/**
 * Wait for either Monaco or fallback textarea to be ready
 * With view persistence, we need to wait for the active view first
 */
async function waitForEditor(page: Page, timeout = 15000): Promise<'monaco' | 'textarea'> {
  // Wait for the editor view to be active
  await page.waitForSelector('.view.editor-view.active', { timeout });

  // Now check for editor within the active view
  const monaco = page.locator('.view.editor-view.active .monaco-editor');
  const textarea = page.locator('.view.editor-view.active .fallback-textarea');

  // Wait for either to be present (not checking visibility since parent view handles that)
  await page.waitForSelector('.view.editor-view.active .monaco-editor, .view.editor-view.active .fallback-textarea', { timeout });

  if (await monaco.count() > 0) {
    return 'monaco';
  }
  return 'textarea';
}

/**
 * Get editor content (works with both Monaco and textarea)
 * Scoped to active editor view
 */
async function getEditorContent(page: Page, editorType: 'monaco' | 'textarea'): Promise<string> {
  if (editorType === 'monaco') {
    return await page.locator('.view.editor-view.active .monaco-editor .view-lines').textContent() || '';
  }
  return await page.locator('.view.editor-view.active .fallback-textarea').inputValue();
}

/**
 * Set editor content (works with both Monaco and textarea)
 * Scoped to active editor view
 */
async function setEditorContent(page: Page, editorType: 'monaco' | 'textarea', content: string): Promise<void> {
  if (editorType === 'monaco') {
    const editor = page.locator('.view.editor-view.active .monaco-editor textarea');
    await editor.click();
    await editor.fill(content);
  } else {
    const textarea = page.locator('.view.editor-view.active .fallback-textarea');
    await textarea.click();
    await textarea.fill(content);
  }
}

test.describe('Editor Content Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(1000); // Let Svelte initialize
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist editor content on page refresh', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize

    const editorType = await waitForEditor(page);
    await setEditorContent(page, editorType, 'global protocol TestProtocol { }');

    await page.waitForTimeout(3000);
    await page.reload(NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize after reload

    const newEditorType = await waitForEditor(page);
    const editorContent = await getEditorContent(page, newEditorType);
    expect(editorContent).toContain('TestProtocol');
  });

  test('should not restore content older than 24 hours', async ({ page }) => {
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000);
    const oldState = {
      ui: { theme: 'dark', sidebarCollapsed: false, sidebarWidth: 280, editorFontSize: 13, editorWordWrap: false, editorMinimap: true, outputPanelCollapsed: false, visualizerPanelSize: 400 },
      simulation: { executionMode: 'cfg', choiceStrategy: 'manual', schedulingStrategy: 'manual', deliveryModel: 'FIFO', playbackSpeed: 300, maxSteps: 1000 },
      editor: { lastContent: 'global protocol OldProtocol { }', lastContentTimestamp: oldTimestamp, recentExamples: [] },
      version: 1
    };

    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize
    await page.evaluate((state) => {
      localStorage.setItem('smpst-persisted-state', JSON.stringify(state));
    }, oldState);

    await page.reload(NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize after reload
    const editorType = await waitForEditor(page);

    const editorContent = await getEditorContent(page, editorType);
    expect(editorContent).not.toContain('OldProtocol');
  });
});

test.describe('Theme Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(1000);
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist theme preference', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize

    // Navigate to settings using the settings link
    await page.click('a[href="#/settings"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('.view.settings-view.active', { timeout: 15000 });

    // Click light theme button within active view
    await page.locator('.view.settings-view.active button:has-text("Light")').click();
    await page.waitForTimeout(1000);

    await page.reload(NAV_OPTIONS);
    await page.waitForTimeout(2000);
    // After reload, navigate to settings again
    await page.click('a[href="#/settings"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('.view.settings-view.active', { timeout: 15000 });

    const theme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(theme).toBe('light');
  });
});

test.describe('Routing', () => {
  test('should navigate to editor route', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize
    // Should start on editor view by default
    await page.waitForSelector('.view.editor-view.active', { timeout: 15000 });
  });

  test('should navigate to simulation route', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize
    await page.waitForSelector('.view.editor-view.active', { timeout: 15000 });

    // Click SIMULATION tab
    await page.click('.tab:has-text("SIMULATION")');
    await page.waitForTimeout(500);
    // Will redirect back to editor if no protocol, or show simulation view
    const editorActive = page.locator('.view.editor-view.active');
    const simulationActive = page.locator('.view.simulation-view.active');
    await expect(editorActive.or(simulationActive)).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to settings route', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize

    // Click settings link
    await page.click('a[href="#/settings"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('.view.settings-view.active', { timeout: 15000 });

    // Check content within active view
    await expect(page.locator('.view.settings-view.active h2:has-text("Appearance")')).toBeVisible();
    await expect(page.locator('.view.settings-view.active h2:has-text("Editor")')).toBeVisible();
    await expect(page.locator('.view.settings-view.active h2:has-text("Simulation")')).toBeVisible();
  });

  test('should redirect from simulation to editor when no protocol loaded', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000);
    await page.evaluate(() => localStorage.clear());

    // Try to navigate to simulation
    await page.click('.tab:has-text("SIMULATION")');
    await page.waitForTimeout(500);

    // Should redirect back to editor or show no-protocol message
    // Check if either editor view is active OR simulation view shows no-protocol
    const editorActive = page.locator('.view.editor-view.active');
    const simulationWithNoProtocol = page.locator('.view.simulation-view.active .no-protocol');

    await expect(editorActive.or(simulationWithNoProtocol)).toBeVisible({ timeout: 15000 });
  });

  test('should handle back button navigation', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000);
    await page.waitForSelector('.view.editor-view.active', { timeout: 15000 });

    // Navigate to settings
    await page.click('a[href="#/settings"]');
    await page.waitForTimeout(500);
    await page.waitForSelector('.view.settings-view.active', { timeout: 15000 });

    // Go back
    await page.goBack();
    await page.waitForTimeout(500);
    await page.waitForSelector('.view.editor-view.active', { timeout: 15000 });
  });
});

test.describe('Tab Navigation', () => {
  test('should switch between CODE and SIMULATION tabs', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(2000); // Wait for app to initialize
    await page.waitForSelector('.tab-bar', { timeout: 15000 });

    await page.click('.tab:has-text("CODE")');
    await page.waitForTimeout(500);
    await page.waitForSelector('.view.editor-view.active', { timeout: 15000 });

    await page.click('.tab:has-text("SIMULATION")');
    await page.waitForTimeout(500);

    // When no protocol is loaded, should show editor view or simulation view with no-protocol
    const editorActive = page.locator('.view.editor-view.active');
    const simulationActive = page.locator('.view.simulation-view.active');
    await expect(editorActive.or(simulationActive)).toBeVisible({ timeout: 15000 });
  });
});
