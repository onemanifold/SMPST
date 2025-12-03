/**
 * Persistence Integration Tests
 *
 * Tests for auto-save/restore functionality across sessions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => Math.random().toString(36).substring(2) }
});

// Mock matchMedia
Object.defineProperty(global, 'matchMedia', {
  value: vi.fn().mockImplementation(query => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('Persistence Integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Editor Content Persistence', () => {
    it('should save editor content to localStorage', async () => {
      const { persistenceStore } = await import('../persistence.store');

      // Save content
      persistenceStore.saveEditorContent('global protocol Test {}');

      // Force save (bypass debounce)
      persistenceStore.forceSave();

      // Check localStorage
      const stored = localStorageMock.getItem('smpst-persisted-state');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.editor.lastContent).toBe('global protocol Test {}');
      expect(parsed.editor.lastContentTimestamp).toBeGreaterThan(0);
    });

    it('should restore editor content on hydration', async () => {
      // Pre-populate localStorage
      const savedState = {
        ui: { theme: 'dark', sidebarCollapsed: false, sidebarWidth: 280, editorFontSize: 13, editorWordWrap: false, editorMinimap: true, outputPanelCollapsed: false, visualizerPanelSize: 400 },
        simulation: { choiceStrategy: 'manual', playbackSpeed: 300, maxSteps: 1000 },
        editor: { lastContent: 'global protocol Restored {}', lastContentTimestamp: Date.now(), recentExamples: [] },
        version: 1
      };
      localStorageMock.setItem('smpst-persisted-state', JSON.stringify(savedState));

      // Import and hydrate
      const { persistenceStore } = await import('../persistence.store');
      persistenceStore.hydrate();

      const state = persistenceStore.getState();
      expect(state.editor.lastContent).toBe('global protocol Restored {}');
    });

    it('should not restore content older than 24 hours', async () => {
      // Pre-populate with old content
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const savedState = {
        ui: { theme: 'dark', sidebarCollapsed: false, sidebarWidth: 280, editorFontSize: 13, editorWordWrap: false, editorMinimap: true, outputPanelCollapsed: false, visualizerPanelSize: 400 },
        simulation: { choiceStrategy: 'manual', playbackSpeed: 300, maxSteps: 1000 },
        editor: { lastContent: 'global protocol Old {}', lastContentTimestamp: oldTimestamp, recentExamples: [] },
        version: 1
      };
      localStorageMock.setItem('smpst-persisted-state', JSON.stringify(savedState));

      const { hasRecoverableContent } = await import('../persistence.integration');

      expect(hasRecoverableContent()).toBe(false);
    });

    it('should recover content within 24 hours', async () => {
      // Pre-populate with recent content
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      const savedState = {
        ui: { theme: 'dark', sidebarCollapsed: false, sidebarWidth: 280, editorFontSize: 13, editorWordWrap: false, editorMinimap: true, outputPanelCollapsed: false, visualizerPanelSize: 400 },
        simulation: { choiceStrategy: 'manual', playbackSpeed: 300, maxSteps: 1000 },
        editor: { lastContent: 'global protocol Recent {}', lastContentTimestamp: recentTimestamp, recentExamples: [] },
        version: 1
      };
      localStorageMock.setItem('smpst-persisted-state', JSON.stringify(savedState));

      const { hasRecoverableContent, getRecoverableContentInfo } = await import('../persistence.integration');

      expect(hasRecoverableContent()).toBe(true);
      const info = getRecoverableContentInfo();
      expect(info?.content).toBe('global protocol Recent {}');
    });
  });

  describe('Theme Preference Persistence', () => {
    it('should save theme preference', async () => {
      const { persistenceStore } = await import('../persistence.store');

      persistenceStore.updateUI({ theme: 'light' });
      persistenceStore.forceSave();

      const stored = localStorageMock.getItem('smpst-persisted-state');
      const parsed = JSON.parse(stored!);
      expect(parsed.ui.theme).toBe('light');
    });

    it('should restore theme preference on hydration', async () => {
      // Pre-populate with light theme
      const savedState = {
        ui: { theme: 'light', sidebarCollapsed: true, sidebarWidth: 300, editorFontSize: 14, editorWordWrap: true, editorMinimap: false, outputPanelCollapsed: true, visualizerPanelSize: 500 },
        simulation: { choiceStrategy: 'random', playbackSpeed: 500, maxSteps: 2000 },
        editor: { lastContent: '', lastContentTimestamp: 0, recentExamples: ['example1'] },
        version: 1
      };
      localStorageMock.setItem('smpst-persisted-state', JSON.stringify(savedState));

      const { persistenceStore } = await import('../persistence.store');
      persistenceStore.hydrate();

      const state = persistenceStore.getState();
      expect(state.ui.theme).toBe('light');
      expect(state.ui.sidebarCollapsed).toBe(true);
      expect(state.ui.editorFontSize).toBe(14);
    });
  });

  describe('Simulation Settings Persistence', () => {
    it('should save simulation settings', async () => {
      const { persistenceStore } = await import('../persistence.store');

      persistenceStore.updateSimulation({
        playbackSpeed: 500,
        maxSteps: 2000,
        choiceStrategy: 'random'
      });
      persistenceStore.forceSave();

      const stored = localStorageMock.getItem('smpst-persisted-state');
      const parsed = JSON.parse(stored!);
      expect(parsed.simulation.playbackSpeed).toBe(500);
      expect(parsed.simulation.maxSteps).toBe(2000);
      expect(parsed.simulation.choiceStrategy).toBe('random');
    });

    it('should restore simulation settings on hydration', async () => {
      const savedState = {
        ui: { theme: 'dark', sidebarCollapsed: false, sidebarWidth: 280, editorFontSize: 13, editorWordWrap: false, editorMinimap: true, outputPanelCollapsed: false, visualizerPanelSize: 400 },
        simulation: { choiceStrategy: 'first', playbackSpeed: 100, maxSteps: 500 },
        editor: { lastContent: '', lastContentTimestamp: 0, recentExamples: [] },
        version: 1
      };
      localStorageMock.setItem('smpst-persisted-state', JSON.stringify(savedState));

      const { persistenceStore } = await import('../persistence.store');
      persistenceStore.hydrate();

      const state = persistenceStore.getState();
      expect(state.simulation.choiceStrategy).toBe('first');
      expect(state.simulation.playbackSpeed).toBe(100);
    });
  });

  describe('State Reset', () => {
    it('should clear all persisted state on reset', async () => {
      // First save some state
      const { persistenceStore } = await import('../persistence.store');
      persistenceStore.saveEditorContent('some content');
      persistenceStore.updateUI({ theme: 'light' });
      persistenceStore.forceSave();

      // Verify it was saved
      expect(localStorageMock.getItem('smpst-persisted-state')).toBeTruthy();

      // Reset
      persistenceStore.reset();

      // Verify state is back to defaults
      const state = persistenceStore.getState();
      expect(state.editor.lastContent).toBe('');
      expect(state.ui.theme).toBe('dark');
    });
  });

  describe('Version Migration', () => {
    it('should handle missing fields gracefully', async () => {
      // Old state with missing fields
      const oldState = {
        ui: { theme: 'dark' }, // Missing most fields
        version: 1
      };
      localStorageMock.setItem('smpst-persisted-state', JSON.stringify(oldState));

      const { persistenceStore } = await import('../persistence.store');
      persistenceStore.hydrate();

      // Should have defaults for missing fields
      const state = persistenceStore.getState();
      expect(state.ui.sidebarCollapsed).toBe(false); // Default
      expect(state.simulation.playbackSpeed).toBe(300); // Default
      expect(state.editor.recentExamples).toEqual([]); // Default
    });
  });
});
