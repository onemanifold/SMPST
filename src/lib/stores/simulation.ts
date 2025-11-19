/**
 * Simulation State Management - Dual-Execution Architecture
 *
 * Layer 4 (Frontend/UI):
 * - Execution mode switching: CFG | Distributed | Bisimulation
 * - UI state (idle/stepping/playing, playback speed)
 * - Reactivity via derived stores
 * - NO state duplication - debuggers are source of truth
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

// Reactivity trigger - increment when debugger state changes
const stateVersion = writable(0);

// ============================================================================
// Layer 3: Debugger Instances (own Layer 2 VM runtimes)
// ============================================================================

let cfgDebugger: CFGDebugger | null = null;
let distributedDebugger: DistributedDebugger | null = null;
let bisimulationValidator: BisimulationValidator | null = null;

// ============================================================================
// Current State (mirrored for reactivity)
// ============================================================================

// CFG execution state
export const cfgExecutionState = writable<CFGExecutionState | null>(null);

// Distributed execution state
export const distributedExecutionState = writable<DistributedExecutionState | null>(null);

// Legacy: points to active execution state based on mode
export const executionState = derived(
  [executionMode, cfgExecutionState, distributedExecutionState],
  ([$mode, $cfg, $dist]) => {
    if ($mode === 'cfg' || $mode === 'bisimulation') return $cfg;
    return null; // Distributed state is different structure
  }
);

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

  cfgDebugger = new CFGDebugger(cfg, CFGSimulator, {
    choiceStrategy: 'manual',
    maxSteps: 1000,
  });

  currentCFG.set(cfg);
  cfgExecutionState.set(cfgDebugger.getState());
  executionMode.set('cfg');
  simulationMode.set('idle');
  stateVersion.update(v => v + 1);
}

/**
 * Initialize Distributed debugger (choreography view)
 */
export async function initializeDistributedSimulation(cfsms: Map<string, CFSM>) {
  stopSimulation();

  const { DistributedDebugger } = await import('../../core/simulation/distributed-debugger');
  const { DistributedSimulator } = await import('../../core/simulation/distributed-simulator');

  distributedDebugger = new DistributedDebugger(cfsms, DistributedSimulator, {
    schedulingStrategy: 'manual',
    maxSteps: 1000,
  });

  currentCFSMs.set(cfsms);
  distributedExecutionState.set(distributedDebugger.getState());
  executionMode.set('distributed');
  simulationMode.set('idle');
  stateVersion.update(v => v + 1);
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
    choiceStrategy: 'manual',
    maxSteps: 1000,
  });

  distributedDebugger = new DistributedDebugger(cfsms, DistributedSimulator, {
    schedulingStrategy: 'manual',
    maxSteps: 1000,
  });

  bisimulationValidator = new BisimulationValidator(cfgDebugger, distributedDebugger);

  currentCFG.set(cfg);
  currentCFSMs.set(cfsms);
  cfgExecutionState.set(cfgDebugger.getState());
  distributedExecutionState.set(distributedDebugger.getState());
  executionMode.set('bisimulation');
  simulationMode.set('idle');
  stateVersion.update(v => v + 1);
}

/**
 * Legacy: Initialize simulation (defaults to CFG mode)
 */
export async function initializeSimulation(cfg: CFG) {
  return initializeCFGSimulation(cfg);
}

// ============================================================================
// Step/Control Functions
// ============================================================================

/**
 * Step forward one execution step (mode-aware)
 */
export function stepSimulation() {
  const mode = get(executionMode);

  if (mode === 'cfg' && cfgDebugger) {
    const result = cfgDebugger.stepForward();
    cfgExecutionState.set(result.state);
    stateVersion.update(v => v + 1);
    if (result.state.completed) simulationMode.set('idle');
  } else if (mode === 'distributed' && distributedDebugger) {
    const result = distributedDebugger.stepForward();
    distributedExecutionState.set(result.state);
    stateVersion.update(v => v + 1);
    if (result.state.allCompleted) simulationMode.set('idle');
  } else if (mode === 'bisimulation' && bisimulationValidator) {
    const result = bisimulationValidator.stepBoth();
    if (cfgDebugger) cfgExecutionState.set(cfgDebugger.getState());
    if (distributedDebugger) distributedExecutionState.set(distributedDebugger.getState());
    stateVersion.update(v => v + 1);
  }
}

/**
 * Make a choice at a choice point (CFG mode only)
 */
export function makeChoice(choiceIndex: number) {
  if (!cfgDebugger) return;

  cfgDebugger.choose(choiceIndex);
  const result = cfgDebugger.stepForward();
  cfgExecutionState.set(result.state);
  stateVersion.update(v => v + 1);

  if (result.state.completed) {
    simulationMode.set('idle');
  }
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
    stepSimulation();
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
 */
export function stepBack() {
  const mode = get(executionMode);

  if (mode === 'cfg' && cfgDebugger) {
    const result = cfgDebugger.stepBackward();
    if (result.success) {
      cfgExecutionState.set(result.state);
      stateVersion.update(v => v + 1);
    }
  } else if (mode === 'distributed' && distributedDebugger) {
    const result = distributedDebugger.stepBackward();
    if (result.success) {
      distributedExecutionState.set(result.state);
      stateVersion.update(v => v + 1);
    }
  } else if (mode === 'bisimulation' && bisimulationValidator) {
    bisimulationValidator.stepBackBoth();
    if (cfgDebugger) cfgExecutionState.set(cfgDebugger.getState());
    if (distributedDebugger) distributedExecutionState.set(distributedDebugger.getState());
    stateVersion.update(v => v + 1);
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
 */
export function jumpToStep(stepNumber: number) {
  const mode = get(executionMode);

  if (mode === 'cfg' && cfgDebugger) {
    const result = cfgDebugger.jumpToStep(stepNumber);
    if (result.success) {
      cfgExecutionState.set(result.state);
      stateVersion.update(v => v + 1);
    }
  } else if (mode === 'distributed' && distributedDebugger) {
    const result = distributedDebugger.jumpToStep(stepNumber);
    if (result.success) {
      distributedExecutionState.set(result.state);
      stateVersion.update(v => v + 1);
    }
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
    cfgExecutionState.set(cfgDebugger.getState());
  } else if (mode === 'distributed' && distributedDebugger) {
    distributedDebugger.reset();
    distributedExecutionState.set(distributedDebugger.getState());
  } else if (mode === 'bisimulation' && bisimulationValidator) {
    bisimulationValidator.resetBoth();
    if (cfgDebugger) cfgExecutionState.set(cfgDebugger.getState());
    if (distributedDebugger) distributedExecutionState.set(distributedDebugger.getState());
  }

  simulationMode.set('idle');
  stateVersion.update(v => v + 1);
}

/**
 * Stop and clean up
 */
export function stopSimulation() {
  stopPlaying();
  cfgDebugger = null;
  distributedDebugger = null;
  bisimulationValidator = null;
  cfgExecutionState.set(null);
  distributedExecutionState.set(null);
  currentCFG.set(null);
  currentCFSMs.set(null);
  simulationMode.set('idle');
  stateVersion.set(0);
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
