/**
 * Distributed Debugger - Time-Travel Debugging for Choreography Execution
 *
 * Wraps DistributedSimulator (choreography VM) and provides:
 * - Time-travel (snapshots, backward/forward stepping)
 * - Event annotation (adds stepNumber)
 * - History management
 * - Visible event filtering
 *
 * Architecture:
 * - Layer 2: DistributedSimulator (VM Runtime) - Pure execution, no history
 * - Layer 3: DistributedDebugger (this) - History, time-travel, event annotation
 * - Layer 4: Frontend Store - UI state, display logic
 */

import type { CFSM } from '../cfsm/types';
import type { DistributedSimulator } from './distributed-simulator';
import type {
  DistributedExecutionState,
  DistributedStepResult,
  DistributedSimulatorConfig,
  CFSMAction,
} from './cfsm-simulator-types';

/**
 * Distributed execution event with stepNumber
 */
export interface DistributedDebugEvent {
  stepNumber: number;
  timestamp: number;
  role: string;
  action?: CFSMAction;
  globalStep: number;
  roleStep: number;
}

/**
 * Snapshot for distributed time-travel
 */
export interface DistributedDebugSnapshot {
  stepNumber: number;
  timestamp: number;
  state: DistributedExecutionState;
}

/**
 * Result of a distributed debug step
 */
export interface DistributedDebugStepResult {
  success: boolean;
  event?: DistributedDebugEvent;
  state: DistributedExecutionState;
  error?: any;
}

/**
 * DistributedDebugger - Wraps DistributedSimulator with time-travel debugging
 */
export class DistributedDebugger {
  private vm: DistributedSimulator;
  private cfsms: Map<string, CFSM>;

  // Debugger state (not VM state)
  private snapshots: DistributedDebugSnapshot[] = [];
  private allEvents: DistributedDebugEvent[] = [];
  private currentPosition: number = 0;

  constructor(
    cfsms: Map<string, CFSM>,
    DistributedSimClass: typeof DistributedSimulator,
    config?: DistributedSimulatorConfig
  ) {
    this.cfsms = cfsms;

    // Create VM instance
    this.vm = new DistributedSimClass(cfsms, {
      ...config,
      recordTrace: true, // Always record trace for debugging
    });

    // Record initial snapshot
    this.recordSnapshot();
  }

  /**
   * Step forward (execute next instruction + record history)
   */
  async stepForward(): Promise<DistributedDebugStepResult> {
    // Check if we can step forward
    if (this.currentPosition < this.snapshots.length - 1) {
      // We're in the middle of history - this is a redo operation
      return this.redo();
    }

    // Execute VM step
    const vmResult = await this.vm.step();

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
    const debugEvent = vmResult.role
      ? {
          stepNumber: this.currentPosition,
          timestamp: Date.now(),
          role: vmResult.role,
          action: vmResult.action,
          globalStep: vmResult.state.globalSteps,
          roleStep: vmResult.state.roleSteps.get(vmResult.role) ?? 0,
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
  async stepBackward(): Promise<DistributedDebugStepResult> {
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
  private redo(): DistributedDebugStepResult {
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
  async jumpToStep(stepNumber: number): Promise<DistributedDebugStepResult> {
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
  getState(): DistributedExecutionState {
    return this.vm.getState();
  }

  /**
   * Get current position in history
   */
  getCurrentPosition(): number {
    return this.currentPosition;
  }

  /**
   * Get total number of steps
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
  getAllEvents(): DistributedDebugEvent[] {
    return [...this.allEvents];
  }

  /**
   * Get events visible at current time position
   */
  getVisibleEvents(): DistributedDebugEvent[] {
    return this.allEvents.filter(e => e.stepNumber <= this.currentPosition);
  }

  /**
   * Get all snapshots (for debugging/export)
   */
  getAllSnapshots(): DistributedDebugSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get CFSMs being debugged
   */
  getCFSMs(): Map<string, CFSM> {
    return this.cfsms;
  }

  // Private helper methods

  /**
   * Record a snapshot of current VM state
   */
  private recordSnapshot(): void {
    const snapshot: DistributedDebugSnapshot = {
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
  private restoreVMState(state: DistributedExecutionState): void {
    // DistributedSimulator doesn't have a restoreState method yet
    // For now, we'll use internal state directly
    // This is a workaround until we add proper state restoration to DistributedSimulator
    const vm = this.vm as any;

    // Restore distributed state
    vm.roleStates = new Map(state.roleStates);
    vm.roleSteps = new Map(state.roleSteps);
    vm.globalSteps = state.globalSteps;
    vm.inFlightMessages = [...state.inFlightMessages];
    vm.roleBuffers = new Map(state.roleBuffers);
    vm.anyCompleted = state.anyCompleted;
    vm.allCompleted = state.allCompleted;
    vm.deadlocked = state.deadlocked;
    vm.enabledRoles = [...state.enabledRoles];
  }

  /**
   * Deep clone execution state
   */
  private cloneState(state: DistributedExecutionState): DistributedExecutionState {
    return {
      roleStates: new Map(state.roleStates),
      roleSteps: new Map(state.roleSteps),
      globalSteps: state.globalSteps,
      inFlightMessages: [...state.inFlightMessages],
      roleBuffers: new Map(state.roleBuffers),
      anyCompleted: state.anyCompleted,
      allCompleted: state.allCompleted,
      deadlocked: state.deadlocked,
      enabledRoles: [...state.enabledRoles],
    };
  }
}
