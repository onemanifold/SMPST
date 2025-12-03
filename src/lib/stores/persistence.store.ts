/**
 * Persistence Store - Cross-Session State Management
 *
 * Provides a unified persistence layer for:
 * - localStorage: UI preferences, settings (sync, fast)
 * - IndexedDB: Large data like protocols, history (async, larger capacity)
 *
 * Features:
 * - Automatic state hydration on app init
 * - Debounced auto-save on state changes
 * - Platform-aware (works in browser, SSR-safe)
 */

import { writable, get } from 'svelte/store';
import type { Theme } from './app.store';
import type { ChoiceStrategy } from './simulation';
import { protocolDB, type SavedProtocol } from './protocol-db';

// ============================================================================
// Types
// ============================================================================

export interface PersistedUIState {
  // Theme & Layout
  theme: Theme;
  sidebarCollapsed: boolean;
  sidebarWidth: number;

  // Editor preferences
  editorFontSize: number;
  editorWordWrap: boolean;
  editorMinimap: boolean;

  // Panel states
  outputPanelCollapsed: boolean;
  visualizerPanelSize: number;
}

export interface PersistedSimulationSettings {
  choiceStrategy: ChoiceStrategy;
  playbackSpeed: number;
  maxSteps: number;
}

export interface PersistedEditorState {
  // Last edited content (auto-recovery)
  lastContent: string;
  lastContentTimestamp: number;

  // Recently used examples
  recentExamples: string[];
}

export interface PersistedState {
  ui: PersistedUIState;
  simulation: PersistedSimulationSettings;
  editor: PersistedEditorState;
  version: number; // Schema version for migrations
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'smpst-persisted-state';
const CURRENT_VERSION = 1;
const DEBOUNCE_MS = 500;

// ============================================================================
// Default State
// ============================================================================

const defaultState: PersistedState = {
  ui: {
    theme: 'dark',
    sidebarCollapsed: false,
    sidebarWidth: 280,
    editorFontSize: 13,
    editorWordWrap: false,
    editorMinimap: true,
    outputPanelCollapsed: false,
    visualizerPanelSize: 400,
  },
  simulation: {
    choiceStrategy: 'manual',
    playbackSpeed: 300,
    maxSteps: 1000,
  },
  editor: {
    lastContent: '',
    lastContentTimestamp: 0,
    recentExamples: [],
  },
  version: CURRENT_VERSION,
};

// ============================================================================
// Platform Detection
// ============================================================================

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// ============================================================================
// Storage Helpers
// ============================================================================

function loadFromStorage(): PersistedState {
  if (!isBrowser) return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;

    const parsed = JSON.parse(stored) as PersistedState;

    // Handle version migrations
    if (parsed.version !== CURRENT_VERSION) {
      return migrateState(parsed);
    }

    // Merge with defaults to handle new fields
    return deepMerge(defaultState, parsed);
  } catch (error) {
    console.warn('Failed to load persisted state:', error);
    return defaultState;
  }
}

function saveToStorage(state: PersistedState): void {
  if (!isBrowser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save persisted state:', error);
  }
}

function migrateState(state: PersistedState): PersistedState {
  // Future migrations go here
  // For now, just return merged with defaults
  return { ...deepMerge(defaultState, state), version: CURRENT_VERSION };
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        (result as any)[key] = deepMerge(target[key] as object, source[key] as object);
      } else {
        (result as any)[key] = source[key];
      }
    }
  }

  return result;
}

// ============================================================================
// Store Creation
// ============================================================================

function createPersistenceStore() {
  const { subscribe, set, update } = writable<PersistedState>(loadFromStorage());

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Debounced save
  function scheduleSave(state: PersistedState) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToStorage(state);
      saveTimeout = null;
    }, DEBOUNCE_MS);
  }

  // Subscribe to changes and auto-save
  subscribe(state => {
    scheduleSave(state);
  });

  return {
    subscribe,

    // ========================================
    // UI Persistence
    // ========================================

    updateUI: (changes: Partial<PersistedUIState>) => {
      update(state => ({
        ...state,
        ui: { ...state.ui, ...changes },
      }));
    },

    // ========================================
    // Simulation Settings Persistence
    // ========================================

    updateSimulation: (changes: Partial<PersistedSimulationSettings>) => {
      update(state => ({
        ...state,
        simulation: { ...state.simulation, ...changes },
      }));
    },

    // ========================================
    // Editor Persistence
    // ========================================

    updateEditor: (changes: Partial<PersistedEditorState>) => {
      update(state => ({
        ...state,
        editor: { ...state.editor, ...changes },
      }));
    },

    saveEditorContent: (content: string) => {
      update(state => ({
        ...state,
        editor: {
          ...state.editor,
          lastContent: content,
          lastContentTimestamp: Date.now(),
        },
      }));
    },

    addRecentExample: (exampleId: string) => {
      update(state => {
        const recent = state.editor.recentExamples.filter(id => id !== exampleId);
        return {
          ...state,
          editor: {
            ...state.editor,
            recentExamples: [exampleId, ...recent].slice(0, 10), // Keep last 10
          },
        };
      });
    },

    // ========================================
    // Protocol Persistence (IndexedDB)
    // ========================================

    saveProtocol: async (name: string, code: string): Promise<number> => {
      return await protocolDB.add({
        name,
        code,
        timestamp: Date.now(),
      });
    },

    loadProtocols: async (): Promise<SavedProtocol[]> => {
      return await protocolDB.getAll();
    },

    deleteProtocol: async (id: number): Promise<void> => {
      await protocolDB.delete(id);
    },

    updateProtocol: async (id: number, changes: Partial<SavedProtocol>): Promise<void> => {
      await protocolDB.update(id, changes);
    },

    // ========================================
    // Utility
    // ========================================

    hydrate: () => {
      set(loadFromStorage());
    },

    reset: () => {
      set(defaultState);
      if (isBrowser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    },

    forceSave: () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveToStorage(get({ subscribe }));
    },

    getState: () => get({ subscribe }),
  };
}

// ============================================================================
// Export Singleton
// ============================================================================

export const persistenceStore = createPersistenceStore();

// ============================================================================
// Convenience Exports
// ============================================================================

export { protocolDB, type SavedProtocol } from './protocol-db';
