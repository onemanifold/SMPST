/**
 * Persistence Integration
 *
 * Wires up stores with the persistence layer for automatic
 * save/restore of state across sessions.
 */

import { get } from 'svelte/store';
import { editorContent, parseProtocol, parseStatus } from './editor';
import { appStore } from './app.store';
import { persistenceStore } from './persistence.store';
import {
  playbackSpeed,
  maxStepsConfig,
  choiceStrategy,
  schedulingStrategy,
  deliveryModel,
  executionMode,
} from './simulation';

// Debounce timer for content auto-save
let contentSaveTimeout: ReturnType<typeof setTimeout> | null = null;
const CONTENT_SAVE_DEBOUNCE = 2000; // 2 seconds

// Track if we're currently hydrating to avoid save loops
let isHydrating = false;

/**
 * Initialize persistence - call once on app startup
 *
 * This function:
 * 1. Loads persisted state
 * 2. Applies it to stores
 * 3. Sets up auto-save subscriptions
 */
export async function initializePersistence(): Promise<void> {
  isHydrating = true;

  try {
    // Load persisted state
    const state = persistenceStore.getState();

    // Apply UI state
    appStore.setTheme(state.ui.theme);
    appStore.setSidebarCollapsed(state.ui.sidebarCollapsed);

    // Apply simulation settings
    playbackSpeed.set(state.simulation.playbackSpeed);
    maxStepsConfig.set(state.simulation.maxSteps);
    choiceStrategy.set(state.simulation.choiceStrategy);
    schedulingStrategy.set(state.simulation.schedulingStrategy);
    deliveryModel.set(state.simulation.deliveryModel);
    executionMode.set(state.simulation.executionMode);

    // Restore last editor content if it exists and is recent (within 24 hours)
    const lastContentAge = Date.now() - state.editor.lastContentTimestamp;
    const MAX_CONTENT_AGE = 24 * 60 * 60 * 1000; // 24 hours

    if (state.editor.lastContent && lastContentAge < MAX_CONTENT_AGE) {
      editorContent.set(state.editor.lastContent);

      // Auto-parse if content exists
      if (state.editor.lastContent.trim()) {
        // Delay parsing slightly to let UI settle
        setTimeout(() => {
          parseProtocol(state.editor.lastContent);
        }, 100);
      }
    }

    // Set up auto-save subscriptions
    setupAutoSave();

  } finally {
    isHydrating = false;
  }
}

/**
 * Set up auto-save subscriptions for stores
 */
function setupAutoSave(): void {
  // Auto-save editor content (debounced)
  editorContent.subscribe((content) => {
    if (isHydrating) return;

    // Clear existing timeout
    if (contentSaveTimeout) {
      clearTimeout(contentSaveTimeout);
    }

    // Debounce save
    contentSaveTimeout = setTimeout(() => {
      persistenceStore.saveEditorContent(content);
    }, CONTENT_SAVE_DEBOUNCE);
  });

  // Auto-save app state (immediate - these are small values)
  appStore.subscribe((state) => {
    if (isHydrating) return;

    persistenceStore.updateUI({
      theme: state.theme,
      sidebarCollapsed: state.sidebarCollapsed,
    });
  });

  // Auto-save simulation settings
  playbackSpeed.subscribe((speed) => {
    if (isHydrating) return;
    persistenceStore.updateSimulation({ playbackSpeed: speed });
  });

  maxStepsConfig.subscribe((maxSteps) => {
    if (isHydrating) return;
    persistenceStore.updateSimulation({ maxSteps });
  });

  choiceStrategy.subscribe((strategy) => {
    if (isHydrating) return;
    persistenceStore.updateSimulation({ choiceStrategy: strategy });
  });

  schedulingStrategy.subscribe((strategy) => {
    if (isHydrating) return;
    persistenceStore.updateSimulation({ schedulingStrategy: strategy });
  });

  deliveryModel.subscribe((model) => {
    if (isHydrating) return;
    persistenceStore.updateSimulation({ deliveryModel: model });
  });

  executionMode.subscribe((mode) => {
    if (isHydrating) return;
    persistenceStore.updateSimulation({ executionMode: mode });
  });
}

/**
 * Check if there's unsaved content that can be recovered
 */
export function hasRecoverableContent(): boolean {
  const state = persistenceStore.getState();
  const lastContentAge = Date.now() - state.editor.lastContentTimestamp;
  const MAX_CONTENT_AGE = 24 * 60 * 60 * 1000;

  return !!(
    state.editor.lastContent &&
    state.editor.lastContent.trim() &&
    lastContentAge < MAX_CONTENT_AGE
  );
}

/**
 * Get recoverable content info
 */
export function getRecoverableContentInfo(): { content: string; timestamp: number } | null {
  const state = persistenceStore.getState();

  if (!hasRecoverableContent()) {
    return null;
  }

  return {
    content: state.editor.lastContent,
    timestamp: state.editor.lastContentTimestamp,
  };
}

/**
 * Clear saved editor content (e.g., after user explicitly clears editor)
 */
export function clearSavedContent(): void {
  persistenceStore.updateEditor({
    lastContent: '',
    lastContentTimestamp: 0,
  });
}

/**
 * Force save all state immediately
 */
export function forceSaveAll(): void {
  // Save current editor content immediately
  const content = get(editorContent);
  persistenceStore.saveEditorContent(content);

  // Force persistence store to write to localStorage
  persistenceStore.forceSave();
}
