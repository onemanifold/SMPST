/**
 * Simulation state management
 */
import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';
import type { CFGExecutionState, CFGStepResult, CFGExecutionEvent } from '../../core/simulation/types';

// Simulation mode
export type SimulationMode = 'idle' | 'stepping' | 'playing';
export const simulationMode = writable<SimulationMode>('idle');

// Simulator instance
let simulator: any = null;

// Current execution state
export const executionState = writable<CFGExecutionState | null>(null);

// Current CFG being simulated
export const currentCFG = writable<CFG | null>(null);

// Playback speed (ms between steps in play mode)
export const playbackSpeed = writable<number>(300);

// Phase 1: Execution Events - ALL events from simulator
export const executionEvents = writable<CFGExecutionEvent[]>([]);

// Phase 2: Execution History - backward stepping state
export const currentStepNumber = writable<number>(0);
export const totalStepCount = writable<number>(0);

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
 * Initialize simulator with a CFG
 */
export async function initializeSimulation(cfg: CFG) {
  // Clean up existing simulator
  stopSimulation();

  // Dynamic import to avoid bundling issues
  const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');

  // Create new simulator with manual choice strategy (UI handles auto-selection in play mode)
  simulator = new CFGSimulator(cfg, {
    choiceStrategy: 'manual',
    maxSteps: 1000,
    recordTrace: true
  });

  currentCFG.set(cfg);
  executionState.set(simulator.getState());
  simulationMode.set('idle');

  // Phase 2: Initialize history state
  const history = simulator.getExecutionHistory();
  currentStepNumber.set(history.getCurrentPosition());
  totalStepCount.set(history.getAllSnapshots().length);
}

/**
 * Step forward one execution step
 */
export function stepSimulation() {
  if (!simulator) return;

  const result = simulator.step();
  executionState.set(result.state);

  // Phase 1: Capture execution event if present
  if (result.event) {
    executionEvents.update(events => [...events, result.event!]);
  }

  // Phase 2: Update history state
  if (result.success) {
    const history = simulator.getExecutionHistory();
    currentStepNumber.set(history.getCurrentPosition());
    totalStepCount.set(history.getAllSnapshots().length);
  }

  if (result.state.completed) {
    simulationMode.set('idle');
  }
}

/**
 * Make a choice at a choice point
 */
export function makeChoice(choiceIndex: number) {
  if (!simulator) return;

  const result = simulator.step(choiceIndex);
  executionState.set(result.state);

  // Phase 1: Capture execution event if present
  if (result.event) {
    executionEvents.update(events => [...events, result.event!]);
  }

  // Phase 2: Update history state
  if (result.success) {
    const history = simulator.getExecutionHistory();
    currentStepNumber.set(history.getCurrentPosition());
    totalStepCount.set(history.getAllSnapshots().length);
  }

  if (result.state.completed) {
    simulationMode.set('idle');
  }
}

/**
 * Start playing (auto-stepping with random choices)
 */
export function startPlaying() {
  if (!simulator || get(simulationMode) === 'playing') return;

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
  if (!simulator) return;

  const result = simulator.stepBackward();
  if (result.success) {
    executionState.set(result.state);

    // Update history position
    const history = simulator.getExecutionHistory();
    currentStepNumber.set(history.getCurrentPosition());

    // Truncate events to match history position
    const snapshots = history.getAllSnapshots();
    const currentSnapshot = snapshots.find(s => s.stepNumber === history.getCurrentPosition());
    if (currentSnapshot) {
      // Keep only events up to current step
      executionEvents.update(events =>
        events.filter(e => e.timestamp <= currentSnapshot.timestamp)
      );
    }
  }
}

/**
 * Step forward in execution history (redo)
 */
export function stepForward() {
  if (!simulator) return;

  const result = simulator.stepForward();
  if (result.success) {
    executionState.set(result.state);

    // Phase 1: Capture execution event if present
    if (result.event) {
      executionEvents.update(events => [...events, result.event!]);
    }

    // Phase 2: Update history state
    const history = simulator.getExecutionHistory();
    currentStepNumber.set(history.getCurrentPosition());
    totalStepCount.set(history.getAllSnapshots().length);
  }
}

/**
 * Jump to a specific step in execution history
 */
export function jumpToStep(stepNumber: number) {
  if (!simulator) return;

  const history = simulator.getExecutionHistory();
  const snapshot = history.getSnapshot(stepNumber);

  if (!snapshot) return;

  // Update position and restore snapshot
  history.setCurrentPosition(stepNumber);

  // Get the state by stepping backward/forward to that position
  const currentPos = history.getCurrentPosition();
  const targetPos = stepNumber;

  if (targetPos < currentPos) {
    // Step backward
    while (history.getCurrentPosition() > targetPos) {
      stepBack();
    }
  } else if (targetPos > currentPos) {
    // Step forward
    while (history.getCurrentPosition() < targetPos) {
      stepForward();
    }
  }
}

/**
 * Reset simulation to initial state
 */
export function resetSimulation() {
  if (!simulator) return;

  stopPlaying();
  simulator.reset();
  executionState.set(simulator.getState());
  simulationMode.set('idle');

  // Phase 1: Clear execution events
  executionEvents.set([]);

  // Phase 2: Reset history state
  const history = simulator.getExecutionHistory();
  currentStepNumber.set(history.getCurrentPosition());
  totalStepCount.set(history.getAllSnapshots().length);
}

/**
 * Stop and clean up simulation
 */
export function stopSimulation() {
  stopPlaying();
  simulator = null;
  executionState.set(null);
  currentCFG.set(null);
  simulationMode.set('idle');

  // Phase 1: Clear execution events
  executionEvents.set([]);

  // Phase 2: Reset history state
  currentStepNumber.set(0);
  totalStepCount.set(0);
}

// Derived stores
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

// Phase 1: Event filtering - Derived stores for each event type
export const messageEvents = derived(
  executionEvents,
  $events => $events.filter(e => e.type === 'message')
);

export const choiceEvents = derived(
  executionEvents,
  $events => $events.filter(e => e.type === 'choice')
);

export const recursionEvents = derived(
  executionEvents,
  $events => $events.filter(e => e.type === 'recursion')
);

export const parallelEvents = derived(
  executionEvents,
  $events => $events.filter(e => e.type === 'parallel')
);

export const subProtocolEvents = derived(
  executionEvents,
  $events => $events.filter(e => e.type === 'subprotocol')
);

export const stateChangeEvents = derived(
  executionEvents,
  $events => $events.filter(e => e.type === 'state-change')
);

// Phase 2: History-based derived stores
export const canStepBack = derived(
  currentStepNumber,
  $currentStep => $currentStep > 0
);

export const canStepForward = derived(
  [currentStepNumber, totalStepCount],
  ([$currentStep, $totalSteps]) => $currentStep < $totalSteps
);
