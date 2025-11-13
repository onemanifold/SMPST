/**
 * Simulation state management
 */
import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';
import { CFGSimulator } from '../../core/simulation/cfg-simulator';
import type { CFGExecutionState, CFGStepResult } from '../../core/simulation/types';

// Simulation mode
export type SimulationMode = 'idle' | 'stepping' | 'playing';
export const simulationMode = writable<SimulationMode>('idle');

// Simulator instance
let simulator: CFGSimulator | null = null;

// Current execution state
export const executionState = writable<CFGExecutionState | null>(null);

// Current CFG being simulated
export const currentCFG = writable<CFG | null>(null);

// Play mode interval
let playInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize simulator with a CFG
 */
export function initializeSimulation(cfg: CFG) {
  // Clean up existing simulator
  stopSimulation();

  // Create new simulator with random choice strategy for play mode
  simulator = new CFGSimulator(cfg, {
    choiceStrategy: 'random',
    maxSteps: 1000,
    recordTrace: true
  });

  currentCFG.set(cfg);
  executionState.set(simulator.getState());
  simulationMode.set('idle');
}

/**
 * Step forward one execution step
 */
export function stepSimulation() {
  if (!simulator) return;

  const result = simulator.step();
  executionState.set(result.state);

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

  // Auto-step every 500ms
  playInterval = setInterval(() => {
    const state = get(executionState);

    if (!state || state.completed) {
      stopPlaying();
      return;
    }

    // If at choice, make random selection (simulator handles this)
    stepSimulation();
  }, 500);
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

/**
 * Reset simulation to initial state
 */
export function resetSimulation() {
  if (!simulator) return;

  stopPlaying();
  simulator.reset();
  executionState.set(simulator.getState());
  simulationMode.set('idle');
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
