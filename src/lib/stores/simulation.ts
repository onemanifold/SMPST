/**
 * Simulation State Management - Dual-Execution Architecture
 *
 * SINGLE SOURCE OF TRUTH PATTERN:
 * - Debugger instances (cfgDebugger, distributedDebugger) OWN all execution state
 * - ALL state access goes through derived stores that read from debuggers
 * - NO state mirrors (prevents desync bugs)
 * - State updates trigger via stateVersion increment
 *
 * Architecture Layers:
 *
 * Layer 4 (Frontend/UI):
 * - Execution mode switching: CFG | Distributed | Bisimulation
 * - UI state (idle/stepping/playing, playback speed)
 * - Reactivity via derived stores
 *
 * Layer 3 (Debugging):
 * - CFGDebugger (wraps CFGSimulator)
 * - DistributedDebugger (wraps DistributedSimulator)
 * - BisimulationValidator (coordinates both)
 *
 * Layer 2 (Execution):
 * - CFGSimulator (global orchestration VM)
 * - DistributedSimulator (choreography VM)
 */

import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';
import type { CFSM } from '../../core/cfsm/types';
import type { CFGExecutionState } from '../../core/simulation/types';
import type { DistributedExecutionState } from '../../core/simulation/cfsm-simulator-types';
import type { CFGDebugger } from '../../core/simulation/cfg-debugger';
import type { DistributedDebugger } from '../../core/simulation/distributed-debugger';
import type { BisimulationValidator } from '../../core/simulation/bisimulation-validator';
import type { DebugEvent } from '../../core/simulation/cfg-debugger';
import type { DistributedDebugEvent } from '../../core/simulation/distributed-debugger';
import { handleDebugStepResult, handleDistributedDebugStepResult } from './contracts/backend-contract';

// Re-export types for backward compatibility
export type SteppedExecutionEvent = DebugEvent;

/**
 * Execution mode - which VM/debugger is active
 */
export type ExecutionMode = 'cfg' | 'distributed' | 'bisimulation';

/**
 * Playback mode - UI state
 */
export type SimulationMode = 'idle' | 'stepping' | 'playing';

// ============================================================================
// Layer 4: Frontend State
// ============================================================================

// Execution mode selector
export const executionMode = writable<ExecutionMode>('cfg');

// Playback mode
export const simulationMode = writable<SimulationMode>('idle');

// Playback speed (UI preference)
export const playbackSpeed = writable<number>(300);

// Choice strategy (CFG mode only)
export type ChoiceStrategy = 'manual' | 'random' | 'first' | 'explore-all';
export const choiceStrategy = writable<ChoiceStrategy>('manual');

// Advanced configuration
export const maxStepsConfig = writable<number>(1000);

// Distributed mode configuration
export type SchedulingStrategy = 'manual' | 'round-robin' | 'fair' | 'random';
export type DeliveryModel = 'FIFO' | 'unordered' | 'lossy';
export const schedulingStrategy = writable<SchedulingStrategy>('manual');
export const deliveryModel = writable<DeliveryModel>('FIFO');

// Reactivity trigger - increment when debugger state changes
const stateVersion = writable(0);

// ============================================================================
// Layer 3: Debugger Instances (own Layer 2 VM runtimes)
// ============================================================================

let cfgDebugger: CFGDebugger | null = null;
let distributedDebugger: DistributedDebugger | null = null;
let bisimulationValidator: BisimulationValidator | null = null;

// ============================================================================
// Current State (derived from debuggers - NO MIRRORS)
// ============================================================================

// CFG execution state - reads directly from debugger
export const cfgExecutionState = derived(
  stateVersion,
  () => cfgDebugger?.getState() ?? null
);

// Distributed execution state - reads directly from debugger
export const distributedExecutionState = derived(
  stateVersion,
  () => distributedDebugger?.getState() ?? null
);

// Legacy: points to active execution state based on mode
export const executionState = derived(
  [executionMode, cfgExecutionState, distributedExecutionState],
  ([$mode, $cfg, $dist]) => {
    if ($mode === 'cfg' || $mode === 'bisimulation') return $cfg;
    return null; // Distributed state is different structure
  }
);

// ============================================================================
// Error State (contract enforcement)
// ============================================================================

// Last error from debugger operations - exposed to UI
export const lastError = writable<any>(null);

// Last event from debugger operations
export const lastEvent = writable<DebugEvent | DistributedDebugEvent | null>(null);

// Current CFG/CFSMs
export const currentCFG = writable<CFG | null>(null);
export const currentCFSMs = writable<Map<string, CFSM> | null>(null);

// Play mode interval
let playInterval: ReturnType<typeof setInterval> | null = null;

// Subscribe to playback speed changes
playbackSpeed.subscribe(speed => {
  const mode = get(simulationMode);
  if (mode === 'playing' && playInterval) {
    clearInterval(playInterval);
    playInterval = setInterval(() => {
      stepSimulation();
    }, speed);
  }
});

// ============================================================================
// Initialization Functions
// ============================================================================

/**
 * Initialize CFG debugger (orchestration view)
 */
export async function initializeCFGSimulation(cfg: CFG) {
  stopSimulation();

  const { CFGDebugger } = await import('../../core/simulation/cfg-debugger');
  const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');

  // Get CFSMs if available (for CFSM state tracking)
  const cfsms = get(currentCFSMs);

  cfgDebugger = new CFGDebugger(cfg, CFGSimulator, {
    choiceStrategy: get(choiceStrategy),
    maxSteps: get(maxStepsConfig),
    cfsms: cfsms || undefined,
  });

  currentCFG.set(cfg);
  executionMode.set('cfg');
  simulationMode.set('idle');
  stateVersion.update(v => v + 1); // Triggers cfgExecutionState to update
}

/**
 * Initialize Distributed debugger (choreography view)
 */
export async function initializeDistributedSimulation(cfsms: Map<string, CFSM>) {
  stopSimulation();

  const { DistributedDebugger } = await import('../../core/simulation/distributed-debugger');
  const { DistributedSimulator } = await import('../../core/simulation/distributed-simulator');

  distributedDebugger = new DistributedDebugger(cfsms, DistributedSimulator, {
    schedulingStrategy: get(schedulingStrategy),
    deliveryModel: get(deliveryModel),
    maxSteps: get(maxStepsConfig),
  });

  currentCFSMs.set(cfsms);
  executionMode.set('distributed');
  simulationMode.set('idle');
  stateVersion.update(v => v + 1); // Triggers distributedExecutionState to update
}

/**
 * Initialize Bisimulation mode (both debuggers running in parallel)
 */
export async function initializeBisimulation(cfg: CFG, cfsms: Map<string, CFSM>) {
  stopSimulation();

  const { CFGDebugger } = await import('../../core/simulation/cfg-debugger');
  const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');
  const { DistributedDebugger } = await import('../../core/simulation/distributed-debugger');
  const { DistributedSimulator } = await import('../../core/simulation/distributed-simulator');
  const { BisimulationValidator } = await import('../../core/simulation/bisimulation-validator');

  cfgDebugger = new CFGDebugger(cfg, CFGSimulator, {
    choiceStrategy: get(choiceStrategy),
    maxSteps: get(maxStepsConfig),
    cfsms: cfsms,
  });

  distributedDebugger = new DistributedDebugger(cfsms, DistributedSimulator, {
    schedulingStrategy: get(schedulingStrategy),
    deliveryModel: get(deliveryModel),
    maxSteps: get(maxStepsConfig),
  });

  bisimulationValidator = new BisimulationValidator(cfgDebugger, distributedDebugger);

  currentCFG.set(cfg);
  currentCFSMs.set(cfsms);
  executionMode.set('bisimulation');
  simulationMode.set('idle');
  stateVersion.update(v => v + 1); // Triggers both execution states to update
}

/**
 * Legacy: Initialize simulation (defaults to CFG mode)
 */
export async function initializeSimulation(cfg: CFG) {
  return initializeCFGSimulation(cfg);
}

/**
 * Switch execution mode (requires both CFG and CFSMs to be available)
 */
export async function switchExecutionMode(mode: ExecutionMode) {
  const cfg = get(currentCFG);
  const cfsms = get(currentCFSMs);

  if (!cfg && !cfsms) {
    console.warn('Cannot switch mode: no protocol loaded');
    return;
  }

  switch (mode) {
    case 'cfg':
      if (!cfg) {
        console.warn('Cannot switch to CFG mode: no CFG available');
        return;
      }
      await initializeCFGSimulation(cfg);
      break;

    case 'distributed':
      if (!cfsms) {
        console.warn('Cannot switch to distributed mode: no CFSMs available');
        return;
      }
      await initializeDistributedSimulation(cfsms);
      break;

    case 'bisimulation':
      if (!cfg || !cfsms) {
        console.warn('Cannot switch to bisimulation mode: need both CFG and CFSMs');
        return;
      }
      await initializeBisimulation(cfg, cfsms);
      break;
  }
}

// ============================================================================
// Step/Control Functions
// ============================================================================

/**
 * Step forward one execution step (mode-aware)
 * ✅ CONTRACT ENFORCED: All result properties must be handled
 */
export async function stepSimulation() {
  const mode = get(executionMode);

  if (mode === 'cfg' && cfgDebugger) {
    const result = cfgDebugger.stepForward();

    // ✅ Contract enforcement: MUST handle both success and error cases
    handleDebugStepResult(result, {
      onSuccess: (state, event) => {
        stateVersion.update(v => v + 1); // Triggers cfgExecutionState to update
        lastError.set(null); // Clear any previous error
        lastEvent.set(event ?? null);
        if (state.completed) simulationMode.set('idle');
      },
      onError: (error, state) => {
        stateVersion.update(v => v + 1); // Update state even on error
        lastError.set(error);
        lastEvent.set(null);
        console.error('[CFG Debugger] Step error:', error);
        simulationMode.set('idle'); // Stop on error
      }
    });
  } else if (mode === 'distributed' && distributedDebugger) {
    const result = await distributedDebugger.stepForward();

    // ✅ Contract enforcement: MUST handle both success and error cases
    handleDistributedDebugStepResult(result, {
      onSuccess: (state, event) => {
        stateVersion.update(v => v + 1); // Triggers distributedExecutionState to update
        lastError.set(null);
        lastEvent.set(event ?? null);
        if (state.allCompleted) simulationMode.set('idle');
      },
      onError: (error, state) => {
        stateVersion.update(v => v + 1);
        lastError.set(error);
        lastEvent.set(null);
        console.error('[Distributed Debugger] Step error:', error);
        simulationMode.set('idle');
      }
    });
  } else if (mode === 'bisimulation' && bisimulationValidator) {
    await bisimulationValidator.stepBoth();
    stateVersion.update(v => v + 1); // Triggers both execution states to update
    lastError.set(null); // Bisimulation validator handles errors internally
  }
}

/**
 * Make a choice at a choice point (CFG mode only)
 * ✅ CONTRACT ENFORCED: All result properties must be handled
 */
export function makeChoice(choiceIndex: number) {
  if (!cfgDebugger) return;

  cfgDebugger.choose(choiceIndex);
  const result = cfgDebugger.stepForward();

  // ✅ Contract enforcement
  handleDebugStepResult(result, {
    onSuccess: (state, event) => {
      stateVersion.update(v => v + 1);
      lastError.set(null);
      lastEvent.set(event ?? null);
      if (state.completed) simulationMode.set('idle');
    },
    onError: (error, state) => {
      stateVersion.update(v => v + 1);
      lastError.set(error);
      lastEvent.set(null);
      console.error('[CFG Debugger] Choice error:', error);
      simulationMode.set('idle');
    }
  });
}

/**
 * Start playing (auto-stepping)
 */
export function startPlaying() {
  const mode = get(executionMode);
  const dbg = mode === 'cfg' ? cfgDebugger : distributedDebugger;
  if (!dbg || get(simulationMode) === 'playing') return;

  simulationMode.set('playing');

  const speed = get(playbackSpeed);
  playInterval = setInterval(() => {
    // Handle async stepSimulation - fire and forget in auto-play mode
    stepSimulation().catch(err => {
      console.error('Step error in auto-play:', err);
      stopPlaying();
    });
  }, speed);
}

/**
 * Stop playing
 */
export function stopPlaying() {
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }

  const mode = get(simulationMode);
  if (mode === 'playing') {
    simulationMode.set('idle');
  }
}

/**
 * Pause playing
 */
export function pauseSimulation() {
  stopPlaying();
  simulationMode.set('stepping');
}

// ============================================================================
// Time-Travel Functions
// ============================================================================

/**
 * Step backward (mode-aware)
 * ✅ CONTRACT ENFORCED: All result properties must be handled
 */
export async function stepBack() {
  const mode = get(executionMode);

  if (mode === 'cfg' && cfgDebugger) {
    const result = cfgDebugger.stepBackward();

    // ✅ Contract enforcement
    handleDebugStepResult(result, {
      onSuccess: (state, event) => {
        stateVersion.update(v => v + 1);
        lastError.set(null);
        lastEvent.set(event ?? null);
      },
      onError: (error, state) => {
        lastError.set(error);
        console.error('[CFG Debugger] Step back error:', error);
      }
    });
  } else if (mode === 'distributed' && distributedDebugger) {
    const result = await distributedDebugger.stepBackward();

    // ✅ Contract enforcement
    handleDistributedDebugStepResult(result, {
      onSuccess: (state, event) => {
        stateVersion.update(v => v + 1);
        lastError.set(null);
        lastEvent.set(event ?? null);
      },
      onError: (error, state) => {
        lastError.set(error);
        console.error('[Distributed Debugger] Step back error:', error);
      }
    });
  } else if (mode === 'bisimulation' && bisimulationValidator) {
    await bisimulationValidator.stepBackBoth();
    stateVersion.update(v => v + 1);
    lastError.set(null);
  }
}

/**
 * Step forward (redo)
 */
export function stepForward() {
  stepSimulation();
}

/**
 * Jump to a specific step
 * ✅ CONTRACT ENFORCED: All result properties must be handled
 */
export async function jumpToStep(stepNumber: number) {
  const mode = get(executionMode);

  if (mode === 'cfg' && cfgDebugger) {
    const result = cfgDebugger.jumpToStep(stepNumber);

    // ✅ Contract enforcement
    handleDebugStepResult(result, {
      onSuccess: (state, event) => {
        stateVersion.update(v => v + 1);
        lastError.set(null);
        lastEvent.set(event ?? null);
      },
      onError: (error, state) => {
        lastError.set(error);
        console.error('[CFG Debugger] Jump to step error:', error);
      }
    });
  } else if (mode === 'distributed' && distributedDebugger) {
    const result = await distributedDebugger.jumpToStep(stepNumber);

    // ✅ Contract enforcement
    handleDistributedDebugStepResult(result, {
      onSuccess: (state, event) => {
        stateVersion.update(v => v + 1);
        lastError.set(null);
        lastEvent.set(event ?? null);
      },
      onError: (error, state) => {
        lastError.set(error);
        console.error('[Distributed Debugger] Jump to step error:', error);
      }
    });
  }
}

/**
 * Reset simulation
 */
export function resetSimulation() {
  const mode = get(executionMode);

  stopPlaying();

  if (mode === 'cfg' && cfgDebugger) {
    cfgDebugger.reset();
  } else if (mode === 'distributed' && distributedDebugger) {
    distributedDebugger.reset();
  } else if (mode === 'bisimulation' && bisimulationValidator) {
    bisimulationValidator.resetBoth();
  }

  simulationMode.set('idle');
  stateVersion.update(v => v + 1); // Triggers execution states to update
}

/**
 * Stop and clean up
 */
export function stopSimulation() {
  stopPlaying();
  cfgDebugger = null;
  distributedDebugger = null;
  bisimulationValidator = null;
  currentCFG.set(null);
  currentCFSMs.set(null);
  simulationMode.set('idle');
  stateVersion.set(0); // Reset version; execution states will derive null
}

// ============================================================================
// Derived Stores - NO State Duplication
// ============================================================================

export const isSimulationActive = derived(
  [currentCFG, currentCFSMs],
  ([$cfg, $cfsms]) => $cfg !== null || $cfsms !== null
);

export const isPlaying = derived(
  simulationMode,
  $mode => $mode === 'playing'
);

export const canStep = derived(
  [executionState, simulationMode],
  ([$state, $mode]) =>
    $state !== null && !$state.completed && $mode !== 'playing'
);

export const isAtChoice = derived(
  executionState,
  $state => $state?.atChoice ?? false
);

export const availableChoices = derived(
  executionState,
  $state => $state?.availableChoices ?? []
);

// ============================================================================
// History State - From Active Debugger (Mode-Aware)
// ============================================================================

export const currentStepNumber = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'cfg') return cfgDebugger?.getCurrentPosition() ?? 0;
    if ($mode === 'distributed') return distributedDebugger?.getCurrentPosition() ?? 0;
    if ($mode === 'bisimulation') return cfgDebugger?.getCurrentPosition() ?? 0;
    return 0;
  }
);

export const totalStepCount = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'cfg') return cfgDebugger?.getTotalSteps() ?? 0;
    if ($mode === 'distributed') return distributedDebugger?.getTotalSteps() ?? 0;
    if ($mode === 'bisimulation') return cfgDebugger?.getTotalSteps() ?? 0;
    return 0;
  }
);

export const canStepBack = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'cfg') return cfgDebugger?.canStepBack() ?? false;
    if ($mode === 'distributed') return distributedDebugger?.canStepBack() ?? false;
    if ($mode === 'bisimulation') return bisimulationValidator?.canStepBack() ?? false;
    return false;
  }
);

export const canStepForward = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'cfg') return cfgDebugger?.canStepForward() ?? false;
    if ($mode === 'distributed') return distributedDebugger?.canStepForward() ?? false;
    if ($mode === 'bisimulation') return bisimulationValidator?.canStepForward() ?? false;
    return false;
  }
);

// ============================================================================
// Event Stores - From Active Debugger (Mode-Aware)
// ============================================================================

/**
 * All events from active debugger
 */
export const executionEvents = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'cfg') return cfgDebugger?.getAllEvents() ?? [];
    if ($mode === 'distributed') return distributedDebugger?.getAllEvents() ?? [];
    if ($mode === 'bisimulation') return cfgDebugger?.getAllEvents() ?? [];
    return [];
  }
);

/**
 * Visible events (time-travel filtered)
 */
export const visibleExecutionEvents = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'cfg') return cfgDebugger?.getVisibleEvents() ?? [];
    if ($mode === 'distributed') return distributedDebugger?.getVisibleEvents() ?? [];
    if ($mode === 'bisimulation') return cfgDebugger?.getVisibleEvents() ?? [];
    return [];
  }
);

// Event type filters (CFG mode only)
export const messageEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter((e: any) => e.type === 'message')
);

export const choiceEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter((e: any) => e.type === 'choice')
);

export const recursionEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter((e: any) => e.type === 'recursion')
);

export const parallelEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter((e: any) => e.type === 'parallel')
);

export const subProtocolEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter((e: any) => e.type === 'subprotocol')
);

export const stateChangeEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter((e: any) => e.type === 'state-change')
);

// ============================================================================
// Bisimulation-Specific Stores
// ============================================================================

export const bisimulationTrace = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'bisimulation' && bisimulationValidator) {
      return bisimulationValidator.getTrace();
    }
    return null;
  }
);

export const bisimulationResult = derived(
  [executionMode, stateVersion],
  ([$mode]) => {
    if ($mode === 'bisimulation' && bisimulationValidator) {
      return bisimulationValidator.checkEquivalence();
    }
    return null;
  }
);
