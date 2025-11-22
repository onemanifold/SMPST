/**
 * Store barrel file - exports combined stores for use in components
 */

import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';

// ============================================================================
// Editor Store
// ============================================================================

interface EditorState {
  code: string;
  errors: Array<{ message: string }>;
  cfg: CFG | null;
}

function createEditorStore() {
  const { subscribe, set, update } = writable<EditorState>({
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

export const editorStore = createEditorStore();

// ============================================================================
// Simulation Store
// ============================================================================

interface CallStackFrame {
  name: string;
  nodeId: string;
}

interface SimulationState {
  isRunning: boolean;
  cfgExecutionState: {
    currentNode: string | null;
    completed: boolean;
    stepCount: number;
  } | null;
  canStepBackward: boolean;
  callStack: CallStackFrame[];
}

function createSimulationStore() {
  const { subscribe, set, update } = writable<SimulationState>({
    isRunning: false,
    cfgExecutionState: null,
    canStepBackward: false,
    callStack: [],
  });

  // Import simulation functions dynamically
  let cfgSimulator: import('../../core/simulation/cfg-simulator').CFGSimulator | null = null;
  let executionHistory: Array<SimulationState['cfgExecutionState']> = [];
  let historyIndex = -1;

  const actions = {
    stepForward: async () => {
      const currentState = get({ subscribe });
      if (!cfgSimulator || currentState.cfgExecutionState?.completed) return;

      // Save current state to history
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
      // For now, same as stepForward
      await actions.stepForward();
    },

    stepOut: async () => {
      // Step until we leave the current scope
      await actions.stepForward();
    },

    stepOver: async () => {
      // Step over the current node
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

export const simulationStore = createSimulationStore();

// ============================================================================
// UI Store
// ============================================================================

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
}

function createUIStore() {
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

export const uiStore = createUIStore();
