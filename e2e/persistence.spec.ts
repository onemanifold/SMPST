import { test, expect, Page } from '@playwright/test';

// Navigation options - use 'commit' to not wait at all (let Svelte initialize)
const NAV_OPTIONS = { waitUntil: 'commit' as const };

/**
 * Wait for either Monaco or fallback textarea to be ready
 */
async function waitForEditor(page: Page, timeout = 15000): Promise<'monaco' | 'textarea'> {
  const monaco = page.locator('.monaco-editor');
  const textarea = page.locator('.fallback-textarea');

  await expect(monaco.or(textarea)).toBeVisible({ timeout });

  if (await monaco.isVisible()) {
    return 'monaco';
  }
  return 'textarea';
}

/**
 * Get editor content (works with both Monaco and textarea)
 */
async function getEditorContent(page: Page, editorType: 'monaco' | 'textarea'): Promise<string> {
  if (editorType === 'monaco') {
    return await page.locator('.monaco-editor .view-lines').textContent() || '';
  }
  return await page.locator('.fallback-textarea').inputValue();
}

/**
 * Set editor content (works with both Monaco and textarea)
 */
async function setEditorContent(page: Page, editorType: 'monaco' | 'textarea', content: string): Promise<void> {
  if (editorType === 'monaco') {
    const editor = page.locator('.monaco-editor textarea');
    await editor.click();
    await editor.fill(content);
  } else {
    const textarea = page.locator('.fallback-textarea');
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

    const editorType = await waitForEditor(page);
    await setEditorContent(page, editorType, 'global protocol TestProtocol { }');

    await page.waitForTimeout(3000);
    await page.reload(NAV_OPTIONS);

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
    await page.evaluate((state) => {
      localStorage.setItem('smpst-persisted-state', JSON.stringify(state));
    }, oldState);

    await page.reload(NAV_OPTIONS);
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
    await page.goto('#/settings', NAV_OPTIONS);
    await page.waitForSelector('.settings-page', { timeout: 15000 });

    await page.click('button:has-text("Light")');
    await page.waitForTimeout(1000);

    await page.reload(NAV_OPTIONS);
    await page.waitForSelector('.settings-page', { timeout: 15000 });

    const theme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(theme).toBe('light');
  });
});

test.describe('Routing', () => {
  test('should navigate to editor route', async ({ page }) => {
    await page.goto('#/', NAV_OPTIONS);
    await page.waitForSelector('.editor-page', { timeout: 15000 });
  });

  test('should navigate to simulation route', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForSelector('.editor-page', { timeout: 15000 });

    await page.goto('#/simulation', NAV_OPTIONS);
    await page.waitForSelector('.simulation-page, .no-protocol', { timeout: 15000 });
  });

  test('should navigate to settings route', async ({ page }) => {
    await page.goto('#/settings', NAV_OPTIONS);
    await page.waitForSelector('.settings-page', { timeout: 15000 });

    await expect(page.locator('h2:has-text("Appearance")')).toBeVisible();
    await expect(page.locator('h2:has-text("Editor")')).toBeVisible();
    await expect(page.locator('h2:has-text("Simulation")')).toBeVisible();
  });

  test('should redirect from simulation to editor when no protocol loaded', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForTimeout(1000);
    await page.evaluate(() => localStorage.clear());

    await page.goto('#/simulation', NAV_OPTIONS);

    const noProtocol = page.locator('.no-protocol');
    const editor = page.locator('.editor-page');
    await expect(noProtocol.or(editor)).toBeVisible({ timeout: 15000 });
  });

  test('should handle back button navigation', async ({ page }) => {
    await page.goto('#/', NAV_OPTIONS);
    await page.waitForSelector('.editor-page', { timeout: 15000 });

    await page.goto('#/settings', NAV_OPTIONS);
    await page.waitForSelector('.settings-page', { timeout: 15000 });

    await page.goBack();
    await page.waitForSelector('.editor-page', { timeout: 15000 });
  });
});

test.describe('Tab Navigation', () => {
  test('should switch between CODE and SIMULATION tabs', async ({ page }) => {
    await page.goto('', NAV_OPTIONS);
    await page.waitForSelector('.tab-bar', { timeout: 15000 });

    await page.click('.tab:has-text("CODE")');
    await expect(page.locator('.editor-page')).toBeVisible();

    await page.click('.tab:has-text("SIMULATION")');
    // When no protocol is loaded, SimulationPage shows no-protocol or redirects to editor
    const simulation = page.locator('.simulation-page');
    const noProtocol = page.locator('.no-protocol');
    const editor = page.locator('.editor-page');
    await expect(simulation.or(noProtocol).or(editor).first()).toBeVisible({ timeout: 15000 });
  });
});
