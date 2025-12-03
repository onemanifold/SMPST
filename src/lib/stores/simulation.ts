/**
 * Simulation State Management - Bisimulation Architecture
 *
 * SINGLE SOURCE OF TRUTH PATTERN:
 * - BisimulationCoordinator owns all execution state
 * - CFG provides step ORDER (source of truth for sequence)
 * - CFSMs provide actual STATE (distributed execution with full fidelity)
 * - ALL state access goes through derived stores that read from coordinator
 * - NO state mirrors (prevents desync bugs)
 * - State updates trigger via stateVersion increment
 *
 * Architecture:
 * - Always-on bisimulation (no mode switching)
 * - CFG and CFSM execution are coordinated together
 * - Concurrent events can be reordered locally
 * - Causal dependencies strictly enforced
 */

import { writable, derived, get } from 'svelte/store';
import type { CFG } from '../../core/cfg/types';
import type { CFSM } from '../../core/projection/types';
import type { CFGExecutionState } from '../../core/simulation/types';
import type { BisimulationCoordinator } from '../../core/simulation/bisimulation-coordinator';

/**
 * Playback mode - UI state
 */
export type SimulationMode = 'idle' | 'stepping' | 'playing';

// ============================================================================
// Layer 4: Frontend State
// ============================================================================

// Playback mode
export const simulationMode = writable<SimulationMode>('idle');

// Playback speed (UI preference)
export const playbackSpeed = writable<number>(300);

// Choice strategy
export type ChoiceStrategy = 'manual' | 'random' | 'first';
export const choiceStrategy = writable<ChoiceStrategy>('manual');

// Advanced configuration
export const maxStepsConfig = writable<number>(1000);

// Reactivity trigger - increment when coordinator state changes
const stateVersion = writable(0);

// ============================================================================
// Layer 3: Coordinator Instance
// ============================================================================

let coordinator: BisimulationCoordinator | null = null;

// ============================================================================
// Current State (derived from coordinator - NO MIRRORS)
// ============================================================================

// Current CFG/CFSMs
export const currentCFG = writable<CFG | null>(null);
export const currentCFSMs = writable<Map<string, CFSM> | null>(null);

// CFG execution state - reads directly from coordinator
export const cfgExecutionState = derived(
  stateVersion,
  () => coordinator?.getCFGState() ?? null
);

// CFSM execution states - reads directly from coordinator
export const cfsmExecutionStates = derived(
  stateVersion,
  () => coordinator?.getCFSMStates() ?? null
);

// Primary execution state (CFG view)
export const executionState = derived(
  cfgExecutionState,
  $state => $state
);

// ============================================================================
// Error State
// ============================================================================

// Last error from coordinator operations - exposed to UI
export const lastError = writable<any>(null);

// ============================================================================
// Execution State Details (derived from execution state)
// ============================================================================

/**
 * Recursion stack - shows active recursion labels
 */
export const recursionStack = derived(
  cfgExecutionState,
  $state => $state?.recursionStack ?? []
);

/**
 * Whether execution is currently inside a parallel block
 */
export const isInParallel = derived(
  cfgExecutionState,
  $state => $state?.inParallel ?? false
);

/**
 * Active parallel branches
 */
export const activeBranches = derived(
  cfgExecutionState,
  $state => $state?.activeBranches ?? []
);

/**
 * Whether max steps limit has been reached
 */
export const hasReachedMaxSteps = derived(
  cfgExecutionState,
  $state => $state?.reachedMaxSteps ?? false
);

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
 * Initialize simulation with CFG and CFSMs
 * Always uses bisimulation coordination
 */
export async function initializeSimulation(cfg: CFG, cfsms: Map<string, CFSM>) {
  stopSimulation();

  const { BisimulationCoordinator } = await import('../../core/simulation/bisimulation-coordinator');

  coordinator = new BisimulationCoordinator(cfg, cfsms, {
    choiceStrategy: get(choiceStrategy),
    maxSteps: get(maxStepsConfig),
  });

  currentCFG.set(cfg);
  currentCFSMs.set(cfsms);
  simulationMode.set('idle');
  lastError.set(null);
  stateVersion.update(v => v + 1);
}

/**
 * Initialize simulation with just a CFG (will project to get CFSMs)
 */
export async function initializeSimulationFromCFG(cfg: CFG) {
  const { projectAll } = await import('../../core/projection/projector');
  const result = projectAll(cfg);
  return initializeSimulation(cfg, result.cfsms);
}

// ============================================================================
// Step/Control Functions
// ============================================================================

/**
 * Step forward one execution step
 */
export async function stepSimulation() {
  if (!coordinator) {
    console.warn('stepSimulation called with no active coordinator');
    return;
  }

  try {
    await coordinator.step();
    stateVersion.update(v => v + 1);
    lastError.set(null);

    if (coordinator.isComplete()) {
      simulationMode.set('idle');
      stopPlaying();
    }
  } catch (error) {
    console.error('[Bisimulation] Step error:', error);
    lastError.set(error);
    simulationMode.set('idle');
    stopPlaying();
  }
}

/**
 * Make a choice at a choice point
 */
export async function makeChoice(choiceIndex: number) {
  if (!coordinator) return;

  try {
    coordinator.choose(choiceIndex);
    await coordinator.step();
    stateVersion.update(v => v + 1);
    lastError.set(null);

    if (coordinator.isComplete()) {
      simulationMode.set('idle');
    }
  } catch (error) {
    console.error('[Bisimulation] Choice error:', error);
    lastError.set(error);
  }
}

/**
 * Start playing (auto-stepping)
 */
export function startPlaying() {
  if (!coordinator || get(simulationMode) === 'playing') return;

  simulationMode.set('playing');

  const speed = get(playbackSpeed);
  playInterval = setInterval(() => {
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

/**
 * Reset simulation to initial state
 */
export function resetSimulation() {
  if (!coordinator) return;

  stopPlaying();
  coordinator.reset();
  simulationMode.set('idle');
  lastError.set(null);
  stateVersion.update(v => v + 1);
}

/**
 * Stop and clean up simulation
 */
export function stopSimulation() {
  stopPlaying();
  coordinator = null;
  currentCFG.set(null);
  currentCFSMs.set(null);
  simulationMode.set('idle');
  lastError.set(null);
  stateVersion.set(0);
}

// ============================================================================
// Derived Stores - NO State Duplication
// ============================================================================

export const isSimulationActive = derived(
  [currentCFG, currentCFSMs],
  ([$cfg, $cfsms]) => $cfg !== null && $cfsms !== null
);

export const isPlaying = derived(
  simulationMode,
  $mode => $mode === 'playing'
);

export const canStep = derived(
  [stateVersion],
  () => coordinator !== null && !coordinator.isComplete()
);

export const isAtChoice = derived(
  executionState,
  $state => $state?.atChoice ?? false
);

export const availableChoices = derived(
  executionState,
  $state => $state?.availableChoices ?? []
);

export const isComplete = derived(
  stateVersion,
  () => coordinator?.isComplete() ?? false
);

// ============================================================================
// History State
// ============================================================================

export const currentStepNumber = derived(
  stateVersion,
  () => coordinator?.getStepCount() ?? 0
);

export const totalStepCount = derived(
  stateVersion,
  () => coordinator?.getStepCount() ?? 0
);

// ============================================================================
// Bisimulation-Specific Stores
// ============================================================================

/**
 * Get the CFG simulator for direct access
 */
export const getCFGSimulator = () => coordinator?.getCFGSimulator() ?? null;

/**
 * Get a specific role's debugger
 */
export const getDebugger = (role: string) => coordinator?.getDebugger(role) ?? null;

/**
 * Bisimulation verification result
 */
export const bisimulationResult = derived(
  stateVersion,
  () => coordinator?.verifyBisimulation() ?? null
);

/**
 * CFSM states for each role
 */
export const roleStates = derived(
  cfsmExecutionStates,
  $states => $states ?? new Map()
);

// ============================================================================
// Backward Compatibility Exports
// ============================================================================

// These are kept for backward compatibility with existing code
// They now always reflect the bisimulation state

/**
 * @deprecated Use initializeSimulation instead
 */
export async function initializeCFGSimulation(cfg: CFG) {
  return initializeSimulationFromCFG(cfg);
}

/**
 * @deprecated Use initializeSimulation instead
 */
export async function initializeDistributedSimulation(cfsms: Map<string, CFSM>) {
  console.warn('initializeDistributedSimulation is deprecated. Use initializeSimulation with both CFG and CFSMs.');
  // Cannot initialize without CFG in new architecture
  throw new Error('Cannot initialize distributed simulation without CFG. Use initializeSimulation(cfg, cfsms) instead.');
}

/**
 * @deprecated Use initializeSimulation instead
 */
export async function initializeBisimulation(cfg: CFG, cfsms: Map<string, CFSM>) {
  return initializeSimulation(cfg, cfsms);
}

/**
 * @deprecated No longer needed - always uses bisimulation
 */
export type ExecutionMode = 'bisimulation';

/**
 * @deprecated No longer needed - always uses bisimulation
 */
export const executionMode = derived(
  stateVersion,
  () => 'bisimulation' as const
);

/**
 * @deprecated Use cfgExecutionState instead
 */
export const distributedExecutionState = derived(
  stateVersion,
  () => null
);

/**
 * @deprecated No longer supported
 */
export async function switchExecutionMode(_mode: string) {
  console.warn('switchExecutionMode is deprecated. The simulator always uses bisimulation mode.');
}

// Re-export types for compatibility
export type { ChoiceStrategy };
export type SteppedExecutionEvent = any;

// Legacy stores that are no longer used but kept for compatibility
export const lastEvent = writable<any>(null);
export type SchedulingStrategy = 'manual' | 'round-robin' | 'fair' | 'random';
export type DeliveryModel = 'FIFO' | 'unordered' | 'lossy';
export const schedulingStrategy = writable<SchedulingStrategy>('manual');
export const deliveryModel = writable<DeliveryModel>('FIFO');

// Step backward is not yet supported in BisimulationCoordinator
export async function stepBack() {
  console.warn('stepBack is not yet supported in bisimulation mode');
}

export function stepForward() {
  stepSimulation();
}

export async function jumpToStep(_stepNumber: number) {
  console.warn('jumpToStep is not yet supported in bisimulation mode');
}

// History stores - simplified
export const canStepBack = derived(stateVersion, () => false);
export const canStepForward = derived(
  stateVersion,
  () => coordinator !== null && !coordinator.isComplete()
);

// Event stores
export const executionEvents = derived(stateVersion, () => []);
export const visibleExecutionEvents = derived(stateVersion, () => []);
export const messageEvents = derived(stateVersion, () => []);
export const choiceEvents = derived(stateVersion, () => []);
export const recursionEvents = derived(stateVersion, () => []);
export const parallelEvents = derived(stateVersion, () => []);
export const subProtocolEvents = derived(stateVersion, () => []);
export const stateChangeEvents = derived(stateVersion, () => []);
export const bisimulationTrace = derived(stateVersion, () => null);
