/**
 * Simulation Store v2 - With Contract Enforcement
 *
 * This version uses backend contract handlers to ensure ALL
 * backend properties are handled. Future sessions CANNOT ignore
 * backend return values - TypeScript won't compile.
 */
import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';
import type { CFGExecutionState, CFGExecutionError, CFGExecutionEvent } from '../../core/simulation/types';
import { handleStepResult } from './contracts/backend-contract';

// Simulation mode
export type SimulationMode = 'idle' | 'stepping' | 'playing';
export const simulationMode = writable<SimulationMode>('idle');

// Simulator instance
let simulator: any = null;

// Current execution state
export const executionState = writable<CFGExecutionState | null>(null);

// ✅ NEW: Expose backend error state to UI
export const lastError = writable<CFGExecutionError | null>(null);

// ✅ NEW: Expose backend events to UI
export const lastEvent = writable<CFGExecutionEvent | null>(null);

// Current CFG being simulated
export const currentCFG = writable<CFG | null>(null);

// Playback speed (ms between steps in play mode)
export const playbackSpeed = writable<number>(300);

// Play mode interval
let playInterval: ReturnType<typeof setInterval> | null = null;

// Subscribe to playback speed changes
playbackSpeed.subscribe(speed => {
  const mode = get(simulationMode);
  if (mode === 'playing' && playInterval) {
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
  stopSimulation();

  const { CFGSimulator } = await import('../../core/simulation/cfg-simulator');

  simulator = new CFGSimulator(cfg, {
    choiceStrategy: 'manual',
    maxSteps: 1000,
    recordTrace: true
  });

  currentCFG.set(cfg);
  executionState.set(simulator.getState());
  simulationMode.set('idle');
  lastError.set(null);
  lastEvent.set(null);
}

/**
 * Step forward one execution step
 *
 * ✅ ENFORCED: Must handle all backend properties via contract
 */
export function stepSimulation() {
  if (!simulator) {
    console.warn('stepSimulation called with no active simulator');
    return;
  }

  const result = simulator.step();

  // ✅ TypeScript FORCES us to handle both success and error cases
  handleStepResult(result, {
    onSuccess: (state, event) => {
      // Update all relevant stores
      executionState.set(state);
      lastEvent.set(event ?? null);
      lastError.set(null); // Clear any previous error

      if (state.completed) {
        simulationMode.set('idle');
      }
    },

    onError: (error, state) => {
      // Handle error case - CANNOT be ignored
      console.error('Simulation step failed:', error);
      executionState.set(state);
      lastError.set(error);
      lastEvent.set(null);

      // Stop simulation on error
      simulationMode.set('idle');
      stopPlaying();
    }
  });
}

/**
 * Make a choice at a choice point
 *
 * ✅ ENFORCED: Must handle all backend properties via contract
 */
export function makeChoice(choiceIndex: number) {
  if (!simulator) {
    console.warn('makeChoice called with no active simulator');
    return;
  }

  const result = simulator.step(choiceIndex);

  // ✅ TypeScript FORCES us to handle both success and error cases
  handleStepResult(result, {
    onSuccess: (state, event) => {
      executionState.set(state);
      lastEvent.set(event ?? null);
      lastError.set(null);

      if (state.completed) {
        simulationMode.set('idle');
      }
    },

    onError: (error, state) => {
      // Handle invalid choice gracefully
      console.error('Invalid choice:', error);
      executionState.set(state);
      lastError.set(error);

      // Don't stop simulation - let user try another choice
      if (error.type !== 'invalid-choice') {
        simulationMode.set('idle');
        stopPlaying();
      }
    }
  });
}

/**
 * Start playing (auto-stepping)
 */
export function startPlaying() {
  if (!simulator || get(simulationMode) === 'playing') return;

  simulationMode.set('playing');

  const speed = get(playbackSpeed);
  playInterval = setInterval(() => {
    const state = get(executionState);

    if (!state || state.completed) {
      stopPlaying();
      return;
    }

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
 * Pause simulation
 */
export function pauseSimulation() {
  stopPlaying();
  simulationMode.set('stepping');
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
  lastError.set(null);
  lastEvent.set(null);
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
  lastError.set(null);
  lastEvent.set(null);
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

// ✅ NEW: Derived store for UI to check error state
export const hasError = derived(
  lastError,
  $error => $error !== null
);
