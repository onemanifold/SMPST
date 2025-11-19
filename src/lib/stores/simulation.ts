/**
 * Simulation state management
 *
 * Architecture:
 * - SimulationDebugger: Time-travel, history, event annotation (owns CFGSimulator)
 * - This store: UI state, reactivity, derived convenience stores
 * - No state duplication - debugger is source of truth
 */
import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';
import type { CFGExecutionState } from '../../core/simulation/types';
import type { SimulationDebugger } from '../../core/simulation/simulation-debugger';
import type { DebugEvent } from '../../core/simulation/simulation-debugger';

// Re-export DebugEvent as SteppedExecutionEvent for backward compatibility
export type SteppedExecutionEvent = DebugEvent;

// Simulation mode (UI concern)
export type SimulationMode = 'idle' | 'stepping' | 'playing';
export const simulationMode = writable<SimulationMode>('idle');

// Debugger instance (owns the VM runtime)
let simDebugger: SimulationDebugger | null = null;

// Current execution state (mirrored for reactivity)
export const executionState = writable<CFGExecutionState | null>(null);

// Current CFG being simulated
export const currentCFG = writable<CFG | null>(null);

// Playback speed (UI preference)
export const playbackSpeed = writable<number>(300);

// Reactivity trigger - increment when debugger state changes
const stateVersion = writable(0);

// Play mode interval
let playInterval: ReturnType<typeof setInterval> | null = null;

// Subscribe to playback speed changes and restart interval if playing
playbackSpeed.subscribe(speed => {
  const mode = get(simulationMode);
  if (mode === 'playing' && playInterval) {
    // Restart interval with new speed
    clearInterval(playInterval);
    playInterval = setInterval(() => {
      const state = get(executionState);
      if (!state || state.completed) {
        stopPlaying();
        return;
      }
      stepSimulation();
    }, speed);
  }
});

/**
 * Initialize debugger with a CFG
 */
export async function initializeSimulation(cfg: CFG) {
  // Clean up existing debugger
  stopSimulation();

  // Dynamic import to avoid bundling issues
  const { SimulationDebugger } = await import('../../core/simulation/simulation-debugger');
  const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');

  // Create new debugger (owns CFGSimulator internally)
  simDebugger = new SimulationDebugger(
    cfg,
    CFGSimulator,
    {
      choiceStrategy: 'manual',
      maxSteps: 1000,
    }
  );

  currentCFG.set(cfg);
  executionState.set(simDebugger.getState());
  simulationMode.set('idle');
  stateVersion.update(v => v + 1);
}

/**
 * Step forward one execution step
 */
export function stepSimulation() {
  if (!simDebugger) return;

  const result = simDebugger.stepForward();
  executionState.set(result.state);
  stateVersion.update(v => v + 1);

  if (result.state.completed) {
    simulationMode.set('idle');
  }
}

/**
 * Make a choice at a choice point
 */
export function makeChoice(choiceIndex: number) {
  if (!simDebugger) return;

  // Set the choice
  simDebugger.choose(choiceIndex);

  // Step forward with the choice
  const result = simDebugger.stepForward();
  executionState.set(result.state);
  stateVersion.update(v => v + 1);

  if (result.state.completed) {
    simulationMode.set('idle');
  }
}

/**
 * Start playing (auto-stepping with random choices)
 */
export function startPlaying() {
  if (!simDebugger || get(simulationMode) === 'playing') return;

  simulationMode.set('playing');

  // Auto-step at the current playback speed
  const speed = get(playbackSpeed);
  playInterval = setInterval(() => {
    const state = get(executionState);

    if (!state || state.completed) {
      stopPlaying();
      return;
    }

    // UI will auto-select choices when in play mode
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
// Phase 2: Backward Stepping Actions
// ============================================================================

/**
 * Step backward in execution history
 */
export function stepBack() {
  if (!simDebugger) return;

  const result = simDebugger.stepBackward();
  if (result.success) {
    executionState.set(result.state);
    stateVersion.update(v => v + 1);
  }
}

/**
 * Step forward in execution history (redo)
 */
export function stepForward() {
  if (!simDebugger) return;

  const result = simDebugger.stepForward();
  if (result.success) {
    executionState.set(result.state);
    stateVersion.update(v => v + 1);
  }
}

/**
 * Jump to a specific step in execution history
 */
export function jumpToStep(stepNumber: number) {
  if (!simDebugger) return;

  const result = simDebugger.jumpToStep(stepNumber);
  if (result.success) {
    executionState.set(result.state);
    stateVersion.update(v => v + 1);
  }
}

/**
 * Reset simulation to initial state
 */
export function resetSimulation() {
  if (!simDebugger) return;

  stopPlaying();
  simDebugger.reset();
  executionState.set(simDebugger.getState());
  simulationMode.set('idle');
  stateVersion.update(v => v + 1);
}

/**
 * Stop and clean up simulation
 */
export function stopSimulation() {
  stopPlaying();
  simDebugger = null;
  executionState.set(null);
  currentCFG.set(null);
  simulationMode.set('idle');
  stateVersion.set(0);
}

// ============================================================================
// Derived Stores - NO State Duplication
// ============================================================================

export const isSimulationActive = derived(
  currentCFG,
  $cfg => $cfg !== null
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
// History State - From Debugger (No Duplication)
// ============================================================================

export const currentStepNumber = derived(
  stateVersion,
  () => simDebugger?.getCurrentPosition() ?? 0
);

export const totalStepCount = derived(
  stateVersion,
  () => simDebugger?.getTotalSteps() ?? 0
);

export const canStepBack = derived(
  stateVersion,
  () => simDebugger?.canStepBack() ?? false
);

export const canStepForward = derived(
  stateVersion,
  () => simDebugger?.canStepForward() ?? false
);

// ============================================================================
// Event Stores - From Debugger (No Duplication, No Augmentation)
// ============================================================================

/**
 * All events captured during execution
 * Events include stepNumber (added by debugger)
 */
export const executionEvents = derived(
  stateVersion,
  () => simDebugger?.getAllEvents() ?? []
);

/**
 * Events visible at current time position (time-travel filtered)
 */
export const visibleExecutionEvents = derived(
  stateVersion,
  () => simDebugger?.getVisibleEvents() ?? []
);

// Event type filters - Applied to visible events (time-travel aware)
export const messageEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'message')
);

export const choiceEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'choice')
);

export const recursionEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'recursion')
);

export const parallelEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'parallel')
);

export const subProtocolEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'subprotocol')
);

export const stateChangeEvents = derived(
  visibleExecutionEvents,
  $events => $events.filter(e => e.type === 'state-change')
);
