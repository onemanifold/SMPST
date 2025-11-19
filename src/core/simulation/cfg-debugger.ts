/**
 * CFG Debugger - Time-Travel Debugging for Global Orchestration
 *
 * Wraps CFGSimulator (global orchestration VM) and provides:
 * - Time-travel (snapshots, backward/forward stepping)
 * - Event annotation (adds stepNumber)
 * - History management
 * - Visible event filtering
 *
 * Architecture:
 * - Layer 2: CFGSimulator (VM Runtime) - Pure execution, no history
 * - Layer 3: CFGDebugger (this) - History, time-travel, event annotation
 * - Layer 4: Frontend Store - UI state, display logic
 */

import type { CFG } from '../cfg/types';
import type { CFGSimulator } from './cfg-simulator';
import type {
  CFGExecutionState,
  CFGExecutionEvent,
  CFGStepResult,
  CFGSimulatorConfig,
} from './types';

/**
 * Event with debugger metadata (stepNumber)
 */
export interface DebugEvent extends CFGExecutionEvent {
  stepNumber: number;
}

/**
 * Snapshot for time-travel
 */
export interface DebugSnapshot {
  stepNumber: number;
  timestamp: number;
  state: CFGExecutionState;
}

/**
 * Result of a debug step operation
 */
export interface DebugStepResult {
  success: boolean;
  event?: DebugEvent;
  state: CFGExecutionState;
  error?: any;
}

/**
 * CFGDebugger - Wraps CFGSimulator with time-travel debugging
 */
export class CFGDebugger {
  private vm: CFGSimulator;
  private cfg: CFG;

  // Debugger state (not VM state)
  private snapshots: DebugSnapshot[] = [];
  private allEvents: DebugEvent[] = [];
  private currentPosition: number = 0;

  constructor(
    cfg: CFG,
    CFGSimClass: typeof CFGSimulator,
    config?: CFGSimulatorConfig
  ) {
    this.cfg = cfg;

    // Create VM instance
    this.vm = new CFGSimClass(cfg, {
      ...config,
      recordTrace: true, // Always record trace for debugging
    });

    // Capture any events from initialization (e.g., recursion enter)
    const trace = this.vm.getTrace();
    if (trace.events.length > 0) {
      // Annotate initial events with stepNumber 0
      trace.events.forEach((event: CFGExecutionEvent) => {
        const debugEvent: DebugEvent = {
          ...event,
          stepNumber: 0,
        };
        this.allEvents.push(debugEvent);
      });
    }

    // Record initial snapshot
    this.recordSnapshot();
  }

  /**
   * Step forward (execute next instruction + record history)
   */
  stepForward(): DebugStepResult {
    // Check if we can step forward
    if (this.currentPosition < this.snapshots.length - 1) {
      // We're in the middle of history - this is a redo operation
      return this.redo();
    }

    // Execute VM step
    const vmResult = this.vm.step();

    if (!vmResult.success) {
      return {
        success: false,
        state: vmResult.state,
        error: vmResult.error,
      };
    }

    // Move position forward
    this.currentPosition++;

    // Annotate event with stepNumber (debugger adds this!)
    const debugEvent = vmResult.event
      ? {
          ...vmResult.event,
          stepNumber: this.currentPosition,
        }
      : undefined;

    // Record event in all events (for redo)
    if (debugEvent) {
      this.allEvents.push(debugEvent);
    }

    // Record snapshot for backward stepping
    this.recordSnapshot();

    return {
      success: true,
      event: debugEvent,
      state: vmResult.state,
    };
  }

  /**
   * Step backward (time-travel to previous state)
   */
  stepBackward(): DebugStepResult {
    if (this.currentPosition === 0) {
      return {
        success: false,
        state: this.vm.getState(),
      };
    }

    // Move position backward
    this.currentPosition--;

    // Get snapshot
    const snapshot = this.snapshots[this.currentPosition];

    // Restore VM to snapshot state
    this.restoreVMState(snapshot.state);

    return {
      success: true,
      state: snapshot.state,
    };
  }

  /**
   * Redo (step forward in history without re-executing)
   */
  private redo(): DebugStepResult {
    this.currentPosition++;
    const snapshot = this.snapshots[this.currentPosition];

    // Restore VM to snapshot state
    this.restoreVMState(snapshot.state);

    // Get the event that was recorded at this step
    const event = this.allEvents.find(e => e.stepNumber === this.currentPosition);

    return {
      success: true,
      event,
      state: snapshot.state,
    };
  }

  /**
   * Jump to a specific step in history
   */
  jumpToStep(stepNumber: number): DebugStepResult {
    if (stepNumber < 0 || stepNumber >= this.snapshots.length) {
      return {
        success: false,
        state: this.vm.getState(),
      };
    }

    this.currentPosition = stepNumber;
    const snapshot = this.snapshots[stepNumber];

    // Restore VM to snapshot state
    this.restoreVMState(snapshot.state);

    return {
      success: true,
      state: snapshot.state,
    };
  }

  /**
   * Make a choice at a choice point
   */
  choose(choiceIndex: number): void {
    this.vm.choose(choiceIndex);
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    // Reset VM
    this.vm.reset();

    // Clear debugger state
    this.snapshots = [];
    this.allEvents = [];
    this.currentPosition = 0;

    // Record initial snapshot
    this.recordSnapshot();
  }

  /**
   * Get current execution state
   */
  getState(): CFGExecutionState {
    return this.vm.getState();
  }

  /**
   * Get current position in history
   */
  getCurrentPosition(): number {
    return this.currentPosition;
  }

  /**
   * Get total number of steps (snapshots - 1, since first snapshot is step 0)
   */
  getTotalSteps(): number {
    return this.snapshots.length - 1;
  }

  /**
   * Can step backward?
   */
  canStepBack(): boolean {
    return this.currentPosition > 0;
  }

  /**
   * Can step forward?
   */
  canStepForward(): boolean {
    return this.currentPosition < this.snapshots.length - 1;
  }

  /**
   * Get all events (for debugging/export)
   */
  getAllEvents(): DebugEvent[] {
    return [...this.allEvents];
  }

  /**
   * Get events visible at current time position
   */
  getVisibleEvents(): DebugEvent[] {
    return this.allEvents.filter(e => e.stepNumber <= this.currentPosition);
  }

  /**
   * Get all snapshots (for debugging/export)
   */
  getAllSnapshots(): DebugSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get current CFG being debugged
   */
  getCFG(): CFG {
    return this.cfg;
  }

  // Private helper methods

  /**
   * Record a snapshot of current VM state
   */
  private recordSnapshot(): void {
    const snapshot: DebugSnapshot = {
      stepNumber: this.currentPosition,
      timestamp: Date.now(),
      state: this.cloneState(this.vm.getState()),
    };

    // If we're in the middle of history and stepping forward,
    // truncate future snapshots
    if (this.currentPosition < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentPosition + 1);
      // Also truncate future events
      this.allEvents = this.allEvents.filter(
        e => e.stepNumber <= this.currentPosition
      );
    }

    this.snapshots.push(snapshot);
  }

  /**
   * Restore VM to a previous state
   */
  private restoreVMState(state: CFGExecutionState): void {
    // CFGSimulator doesn't have a restoreState method yet
    // For now, we'll use the internal state directly
    // This is a bit of a hack, but it works
    const vm = this.vm as any;

    // Restore core state
    vm.currentNode = state.currentNode;
    vm.visitedNodes = [...state.visitedNodes];
    vm.stepCount = state.stepCount;
    vm.completed = state.completed;
    vm.atChoice = state.atChoice;
    vm.pendingChoice = state.availableChoices ? [...state.availableChoices] : null;
    vm.selectedChoice = null;
    vm.inParallel = state.inParallel;
    vm.activeBranches = state.activeBranches ? [...state.activeBranches] : undefined;
    vm.reachedMaxSteps = state.reachedMaxSteps;
    vm.recursionStack = state.recursionStack ? [...state.recursionStack] : [];
  }

  /**
   * Deep clone execution state
   */
  private cloneState(state: CFGExecutionState): CFGExecutionState {
    return {
      currentNode: Array.isArray(state.currentNode)
        ? [...state.currentNode]
        : state.currentNode,
      visitedNodes: [...state.visitedNodes],
      stepCount: state.stepCount,
      completed: state.completed,
      atChoice: state.atChoice,
      availableChoices: state.availableChoices
        ? state.availableChoices.map(c => ({ ...c }))
        : undefined,
      inParallel: state.inParallel,
      activeBranches: state.activeBranches
        ? state.activeBranches.map(b => [...b])
        : undefined,
      reachedMaxSteps: state.reachedMaxSteps,
      recursionStack: state.recursionStack
        ? state.recursionStack.map(r => ({ ...r }))
        : [],
    };
  }
}
