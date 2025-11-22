/**
 * Store barrel file - exports all stores for use in components
 *
 * This is a re-export file that provides a unified API for all stores.
 * Individual stores can also be imported directly from their modules.
 */

// ============================================================================
// App Store (Global application state)
// ============================================================================
export {
  appStore,
  theme,
  resolvedTheme,
  isDarkMode,
  sidebarCollapsed,
  currentRoute,
  isLoading,
  notifications,
  hasNotifications,
  type Theme,
  type ResolvedTheme,
  type AppState,
  type Notification,
} from './app.store';

// ============================================================================
// Editor Store (Protocol editing state)
// ============================================================================
export {
  editorContent,
  selectedExample,
  activeTab,
  libraryOpen,
  visualizerOpen,
  outputPanelCollapsed,
  viewMode,
  editorView,
  generatedCode,
  parseStatus,
  parseError,
  verificationResult,
  projectionData,
  projectionErrors,
  simulationState,
  hasErrors,
  canSimulate,
  hasProjectionErrors,
  setEditorContent,
  loadExample,
  clearEditor,
  parseProtocol,
  mockParse,
  type ViewMode,
  type EditorView,
  type ParseStatus,
  type ParseErrorInfo,
  type VerificationCheckResult,
  type VerificationResult,
  type ProjectionData,
  type ProjectionErrorInfo,
  type SimulationState,
} from './editor';

// ============================================================================
// Simulation Store (Execution state)
// ============================================================================
export {
  executionMode,
  simulationMode,
  playbackSpeed,
  choiceStrategy,
  maxStepsConfig,
  schedulingStrategy,
  deliveryModel,
  cfgExecutionState,
  distributedExecutionState,
  executionState,
  currentCFG,
  currentCFSMs,
  isSimulationActive,
  isPlaying,
  canStep,
  isAtChoice,
  availableChoices,
  currentStepNumber,
  totalStepCount,
  canStepBack,
  canStepForward,
  executionEvents,
  visibleExecutionEvents,
  messageEvents,
  choiceEvents,
  recursionEvents,
  parallelEvents,
  subProtocolEvents,
  stateChangeEvents,
  bisimulationTrace,
  bisimulationResult,
  initializeCFGSimulation,
  initializeDistributedSimulation,
  initializeBisimulation,
  initializeSimulation,
  switchExecutionMode,
  stepSimulation,
  makeChoice,
  startPlaying,
  stopPlaying,
  pauseSimulation,
  stepBack,
  stepForward,
  jumpToStep,
  resetSimulation,
  stopSimulation,
  type ExecutionMode,
  type SimulationMode as SimMode,
  type ChoiceStrategy,
  type SchedulingStrategy,
  type DeliveryModel,
  type SteppedExecutionEvent,
} from './simulation';

// ============================================================================
// Persistence Store (Cross-session state)
// ============================================================================
export {
  persistenceStore,
  protocolDB,
  type PersistedState,
  type PersistedUIState,
  type PersistedSimulationSettings,
  type PersistedEditorState,
  type SavedProtocol,
} from './persistence.store';

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';

// Legacy EditorStore interface (deprecated, use editor.ts stores instead)
interface LegacyEditorState {
  code: string;
  errors: Array<{ message: string }>;
  cfg: CFG | null;
}

function createLegacyEditorStore() {
  const { subscribe, set, update } = writable<LegacyEditorState>({
    code: '',
    errors: [],
    cfg: null,
  });

  return {
    subscribe,
    updateCode: async (code: string) => {
      update(state => ({ ...state, code, errors: [] }));

      try {
        const { parse } = await import('../../core/parser/parser');
        const { buildCFG } = await import('../../core/cfg/builder');

        const ast = parse(code);

        if (!ast || ast.type !== 'Module') {
          update(state => ({
            ...state,
            errors: [{ message: 'Expected module from parser' }],
            cfg: null,
          }));
          return;
        }

        if (!ast.declarations || ast.declarations.length === 0) {
          update(state => ({
            ...state,
            errors: [{ message: 'No protocol declarations found' }],
            cfg: null,
          }));
          return;
        }

        const protocolDecl = ast.declarations.find(
          (d: { type: string }) => d.type === 'GlobalProtocolDeclaration'
        );

        if (!protocolDecl) {
          update(state => ({
            ...state,
            errors: [{ message: 'No global protocol declaration found' }],
            cfg: null,
          }));
          return;
        }

        const cfg = buildCFG(protocolDecl);
        update(state => ({ ...state, cfg, errors: [] }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        update(state => ({
          ...state,
          errors: [{ message }],
          cfg: null,
        }));
      }
    },
    reset: () => {
      set({ code: '', errors: [], cfg: null });
    },
  };
}

/** @deprecated Use stores from editor.ts instead */
export const editorStore = createLegacyEditorStore();

// Legacy SimulationStore interface (deprecated, use simulation.ts stores instead)
interface CallStackFrame {
  name: string;
  nodeId: string;
}

interface LegacySimulationState {
  isRunning: boolean;
  cfgExecutionState: {
    currentNode: string | null;
    completed: boolean;
    stepCount: number;
  } | null;
  canStepBackward: boolean;
  callStack: CallStackFrame[];
}

function createLegacySimulationStore() {
  const { subscribe, set, update } = writable<LegacySimulationState>({
    isRunning: false,
    cfgExecutionState: null,
    canStepBackward: false,
    callStack: [],
  });

  let cfgSimulator: import('../../core/simulation/cfg-simulator').CFGSimulator | null = null;
  let executionHistory: Array<LegacySimulationState['cfgExecutionState']> = [];
  let historyIndex = -1;

  const actions = {
    stepForward: async () => {
      const currentState = get({ subscribe });
      if (!cfgSimulator || currentState.cfgExecutionState?.completed) return;

      if (currentState.cfgExecutionState) {
        executionHistory = executionHistory.slice(0, historyIndex + 1);
        executionHistory.push({ ...currentState.cfgExecutionState });
        historyIndex++;
      }

      const result = cfgSimulator.step();
      if (result.completed || result.state) {
        update(state => ({
          ...state,
          cfgExecutionState: {
            currentNode: result.state?.currentNode ?? null,
            completed: result.completed ?? false,
            stepCount: (state.cfgExecutionState?.stepCount ?? 0) + 1,
          },
          canStepBackward: historyIndex >= 0,
        }));
      }
    },

    stepBackward: () => {
      if (historyIndex < 0) return;

      const previousState = executionHistory[historyIndex];
      historyIndex--;

      update(state => ({
        ...state,
        cfgExecutionState: previousState,
        canStepBackward: historyIndex >= 0,
      }));
    },

    stepInto: async () => {
      await actions.stepForward();
    },

    stepOut: async () => {
      await actions.stepForward();
    },

    stepOver: async () => {
      await actions.stepForward();
    },

    reset: async () => {
      const editorState = get(editorStore);
      cfgSimulator = null;
      executionHistory = [];
      historyIndex = -1;

      if (editorState.cfg) {
        const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');
        cfgSimulator = new CFGSimulator(editorState.cfg);

        update(() => ({
          isRunning: false,
          cfgExecutionState: {
            currentNode: editorState.cfg?.entry ?? null,
            completed: false,
            stepCount: 0,
          },
          canStepBackward: false,
          callStack: [],
        }));
      } else {
        set({
          isRunning: false,
          cfgExecutionState: null,
          canStepBackward: false,
          callStack: [],
        });
      }
    },

    run: () => {
      update(state => ({ ...state, isRunning: true }));

      const runStep = async () => {
        const currentState = get({ subscribe });
        if (!currentState.isRunning || currentState.cfgExecutionState?.completed) {
          update(state => ({ ...state, isRunning: false }));
          return;
        }
        await actions.stepForward();
        setTimeout(runStep, 300);
      };

      runStep();
    },

    pause: () => {
      update(state => ({ ...state, isRunning: false }));
    },
  };

  return {
    subscribe,
    actions,
  };
}

/** @deprecated Use stores from simulation.ts instead */
export const simulationStore = createLegacySimulationStore();

// Legacy UIStore (deprecated, use appStore instead)
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
}

function createLegacyUIStore() {
  const { subscribe, update } = writable<UIState>({
    sidebarOpen: true,
    theme: 'dark',
  });

  return {
    subscribe,
    toggleSidebar: () => {
      update(state => ({ ...state, sidebarOpen: !state.sidebarOpen }));
    },
    setTheme: (theme: 'light' | 'dark') => {
      update(state => ({ ...state, theme }));
    },
  };
}

/** @deprecated Use appStore instead */
export const uiStore = createLegacyUIStore();
