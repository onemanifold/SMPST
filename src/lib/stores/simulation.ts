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

// Phase 1: Execution Events with Step Numbers
// Extended event type that includes stepNumber for time-travel filtering
export type SteppedExecutionEvent = CFGExecutionEvent & { stepNumber: number };

// Phase 1: Execution Events - ALL events from simulator (with step numbers)
export const executionEvents = writable<SteppedExecutionEvent[]>([]);

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

  // Phase 2: Enable execution history for backward stepping
  simulator.enableHistory();

  currentCFG.set(cfg);
  executionState.set(simulator.getState());
  simulationMode.set('idle');

  // Phase 1: Capture any events from initialization (e.g., recursion enter)
  const trace = simulator.getTrace();
  const history = simulator.getExecutionHistory();
  const currentStep = history.getCurrentPosition();

  if (trace.events.length > 0) {
    // Add step numbers to events
    const steppedEvents: SteppedExecutionEvent[] = trace.events.map((event: CFGExecutionEvent) => ({
      ...event,
      stepNumber: currentStep,
    }));
    executionEvents.set(steppedEvents);
  }

  // Phase 2: Initialize history state
  currentStepNumber.set(currentStep);
  totalStepCount.set(history.getAllSnapshots().length);
}

/**
 * Step forward one execution step
 */
export function stepSimulation() {
  if (!simulator) return;

  // Use stepForward() to record history snapshots
  const result = simulator.stepForward();
  executionState.set(result.state);

  // Phase 2: Update history state FIRST to get current step number
  if (result.success) {
    const history = simulator.getExecutionHistory();
    const currentStep = history.getCurrentPosition();
    currentStepNumber.set(currentStep);
    totalStepCount.set(history.getAllSnapshots().length);

    // Phase 1: Capture execution event if present (with step number)
    if (result.event) {
      const steppedEvent: SteppedExecutionEvent = {
        ...result.event,
        stepNumber: currentStep,
      };
      executionEvents.update(events => [...events, steppedEvent]);
    }
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

  // Set the choice
  simulator.choose(choiceIndex);

  // Step forward with the choice (records history snapshot)
  const result = simulator.stepForward();
  executionState.set(result.state);

  // Phase 2: Update history state FIRST to get current step number
  if (result.success) {
    const history = simulator.getExecutionHistory();
    const currentStep = history.getCurrentPosition();
    currentStepNumber.set(currentStep);
    totalStepCount.set(history.getAllSnapshots().length);

    // Phase 1: Capture execution event if present (with step number)
    if (result.event) {
      const steppedEvent: SteppedExecutionEvent = {
        ...result.event,
        stepNumber: currentStep,
      };
      executionEvents.update(events => [...events, steppedEvent]);
    }
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

    // Events are filtered by visibleExecutionEvents derived store
    // No need to manually truncate executionEvents
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

    // Phase 2: Update history state FIRST to get current step number
    const history = simulator.getExecutionHistory();
    const currentStep = history.getCurrentPosition();
    currentStepNumber.set(currentStep);
    totalStepCount.set(history.getAllSnapshots().length);

    // Phase 1: Capture execution event if present (with step number)
    if (result.event) {
      const steppedEvent: SteppedExecutionEvent = {
        ...result.event,
        stepNumber: currentStep,
      };
      executionEvents.update(events => [...events, steppedEvent]);
    }
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

  // Get current position BEFORE changing it
  const currentPos = history.getCurrentPosition();
  const targetPos = stepNumber;

  if (targetPos < currentPos) {
    // Step backward
    const stepsBack = currentPos - targetPos;
    for (let i = 0; i < stepsBack; i++) {
      stepBack();
    }
  } else if (targetPos > currentPos) {
    // Step forward
    const stepsForward = targetPos - currentPos;
    for (let i = 0; i < stepsForward; i++) {
      stepForward();
    }
  }
  // If targetPos === currentPos, we're already there - do nothing
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

// Phase 2: Visible events filtered by current history position
// This ensures event log matches the current step when navigating history
export const visibleExecutionEvents = derived(
  [executionEvents, currentStepNumber],
  ([$events, $currentStep]) => $events.filter(e => e.stepNumber <= $currentStep)
);

// Phase 1: Event filtering - Derived stores for each event type
// These now filter from visibleExecutionEvents (time-travel aware)
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

// Phase 2: History-based derived stores
export const canStepBack = derived(
  currentStepNumber,
  $currentStep => $currentStep > 0
);

export const canStepForward = derived(
  [currentStepNumber, totalStepCount],
  ([$currentStep, $totalSteps]) => $currentStep < $totalSteps
);
