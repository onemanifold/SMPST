/**
 * Protocol Simulator Implementation
 *
 * Coordinates execution of multiple roles in a protocol.
 * Clean separation: simulator orchestrates executors, doesn't know about UI.
 */

import type {
  SimulatorConfig,
  SimulationState,
  SimulationStepResult,
  Message,
  ExecutionObserver,
  ExecutionTrace,
  TraceEvent,
  ExecutionState,
} from './types';
import { Executor } from './executor';
import { createInMemoryTransport } from './transport';
import type { MessageTransport } from './types';

/**
 * Multi-role protocol simulator
 * Orchestrates multiple CFSM executors
 */
export class Simulator {
  private executors: Map<string, Executor> = new Map();
  private transport: MessageTransport;
  private options: SimulatorConfig['options'];
  private observers: Set<ExecutionObserver> = new Set();

  private stepCount: number = 0;
  private trace: ExecutionTrace;

  // Fair scheduling: round-robin role selection
  private nextRoleIndex: number = 0;
  private roleNames: string[] = [];

  // Pause/resume: run-specific closure (null when no run() active)
  private currentRunPause: (() => void) | null = null;

  constructor(config: SimulatorConfig) {
    this.transport = config.transport || createInMemoryTransport();
    this.options = config.options || {};

    // Create executor for each role
    for (const [role, cfsm] of config.roles.entries()) {
      const executor = new Executor({
        role,
        cfsm,
        transport: this.transport,
        options: {
          maxSteps: this.options.maxSteps,
          strictMode: this.options.strictMode,
        },
      });

      this.executors.set(role, executor);
    }

    // Initialize role names for fair scheduling
    this.roleNames = Array.from(config.roles.keys());

    // Initialize trace
    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
    };

    // Add trace recording observer if enabled
    if (this.options.recordTrace) {
      this.addTraceRecorder();
    }
  }

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    const roles = new Map<string, ExecutionState>();
    for (const [role, executor] of this.executors.entries()) {
      roles.set(role, executor.getState());
    }

    // Check if all roles completed
    const completed = Array.from(this.executors.values()).every(
      e => e.getState().completed
    );

    // Check for deadlock (all roles blocked or completed, AND no pending messages for blocked roles)
    const allBlockedOrCompleted = Array.from(this.executors.values()).every(
      e => e.getState().blocked || e.getState().completed
    );
    const someNotCompleted = Array.from(this.executors.values()).some(
      e => !e.getState().completed
    );
    // Check if any blocked role has messages available
    const blockedRoleHasMessages = Array.from(this.executors.values()).some(
      e => e.getState().blocked && e.getState().pendingMessages.length > 0
    );
    const deadlocked = allBlockedOrCompleted && someNotCompleted && !blockedRoleHasMessages;

    return {
      roles,
      messageQueue: [], // Not tracking global queue, using per-role queues
      step: this.stepCount,
      completed,
      deadlocked,
    };
  }

  /**
   * Execute one step - ONE role executes ONE transition
   *
   * FORMAL SEMANTICS (Honda, Yoshida, Carbone 2008):
   * - One step = ONE role executes ONE action (send, receive, or epsilon)
   * - Fair scheduling: All ready roles eventually scheduled
   *
   * Implementation:
   * - If role specified: Step that specific role
   * - If no role: Use round-robin fair scheduling to select next ready role
   *
   * Step counting: One step() call = one CFSM transition = increment by 1
   */
  async step(role?: string): Promise<SimulationStepResult> {
    const updates = new Map();
    let selectedRole: string | null = null;

    if (role) {
      // Step specific role
      const executor = this.executors.get(role);
      if (!executor) {
        return {
          success: false,
          updates,
          state: this.getState(),
        };
      }

      const result = await executor.step();
      updates.set(role, result);
      selectedRole = role;
    } else {
      // Fair scheduling: Find next ready role using round-robin
      const startIndex = this.nextRoleIndex;
      let attempts = 0;

      while (attempts < this.roleNames.length) {
        const candidateRole = this.roleNames[this.nextRoleIndex];
        const executor = this.executors.get(candidateRole);

        // Move to next role for next time (round-robin)
        this.nextRoleIndex = (this.nextRoleIndex + 1) % this.roleNames.length;
        attempts++;

        if (!executor) continue;

        // Skip completed roles
        if (executor.getState().completed) {
          continue;
        }

        // Try to step this role
        const result = await executor.step();
        updates.set(candidateRole, result);
        selectedRole = candidateRole;
        break;  // Stepped ONE role - done
      }

      // If no role could step, all are completed or blocked
      if (!selectedRole) {
        return {
          success: false,
          updates,
          state: this.getState(),
        };
      }
    }

    // Increment step counter: one step = one transition
    this.stepCount++;

    const state = this.getState();

    return {
      success: true,
      updates,
      state,
      deadlocked: state.deadlocked,
    };
  }

  /**
   * Run simulation to completion (or until error/maxSteps/pause)
   *
   * FORMAL SEMANTICS:
   * - Calls step() repeatedly until completion or interruption
   * - Each step() is one CFSM transition (one role, one action)
   * - Fair scheduling ensures all ready roles eventually execute
   *
   * Pause/Resume:
   * - Uses run-specific closure variable for pause signal
   * - Calling pause() sets signal for current run() only
   * - Signal auto-cleared when run() exits
   * - Internal state (stepCount, executor positions) preserved between runs
   */
  async run(): Promise<SimulationStepResult> {
    const maxSteps = this.options.maxSteps || 1000;

    // Run-specific pause signal (closure variable)
    let pauseRequested = false;

    // Expose pause setter for this specific run() invocation
    this.currentRunPause = () => { pauseRequested = true; };

    try {
      while (this.stepCount < maxSteps && !pauseRequested) {
        const state = this.getState();

        // Check if completed
        if (state.completed) {
          this.trace.completed = true;
          this.trace.endTime = Date.now();
          return {
            success: true,
            updates: new Map(),
            state,
            completed: true,
          };
        }

        // Check for deadlock
        if (state.deadlocked) {
          return {
            success: false,
            updates: new Map(),
            state,
            completed: false,
            deadlocked: true,
          };
        }

        // Execute ONE step (one role, one transition)
        const result = await this.step();

        // Check for protocol violations (strictMode errors)
        const protocolViolation = Array.from(result.updates.values()).find(
          r => r.error?.type === 'protocol-violation'
        );
        if (protocolViolation) {
          return {
            success: false,
            updates: result.updates,
            state: this.getState(),
            error: protocolViolation.error,
            completed: false,
          };
        }

        // Check if step made progress (role advanced or was blocked)
        if (!result.success) {
          // No role could step - all completed or deadlocked
          const finalState = this.getState();
          return {
            success: false,
            updates: result.updates,
            state: finalState,
            completed: finalState.completed,
            deadlocked: finalState.deadlocked,
          };
        }

        // Yield to event loop to allow pause() and other async operations
        // Use setImmediate to yield to macrotask queue (where setTimeout/setImmediate callbacks run)
        await new Promise(resolve => setImmediate(resolve));
      }

      // Exited loop - check why
      const finalState = this.getState();

      if (pauseRequested) {
        // Paused - return current state (not completed)
        return {
          success: true,
          updates: new Map(),
          state: finalState,
          completed: false,
        };
      }

      // Reached max steps
      return {
        success: false,
        updates: new Map(),
        state: finalState,
        completed: finalState.completed,
      };
    } finally {
      // Clear run-specific pause handler (auto-cleanup)
      this.currentRunPause = null;
    }
  }

  /**
   * Pause current run() execution
   *
   * Sets pause signal for current run() invocation only.
   * If no run() is active, this has no effect.
   */
  pause(): void {
    if (this.currentRunPause) {
      this.currentRunPause();  // Set current run's pause signal
    }
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    this.stepCount = 0;
    this.nextRoleIndex = 0;  // Reset fair scheduling

    // Reset all executors
    for (const executor of this.executors.values()) {
      executor.reset();
    }

    // Reset trace
    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
    };

    // Clear any active pause handler
    this.currentRunPause = null;
  }

  /**
   * Manually inject a message (for testing/debugging)
   */
  async injectMessage(message: Message): Promise<void> {
    await this.transport.send(message);
  }

  /**
   * Add an observer to receive execution events
   */
  addObserver(observer: ExecutionObserver): void {
    this.observers.add(observer);

    // Propagate observer to all executors so they can fire events
    for (const executor of this.executors.values()) {
      executor.addObserver(observer);
    }
  }

  /**
   * Remove an observer
   */
  removeObserver(observer: ExecutionObserver): void {
    this.observers.delete(observer);

    // Propagate removal to all executors
    for (const executor of this.executors.values()) {
      executor.removeObserver(observer);
    }
  }

  /**
   * Get execution trace
   */
  getTrace(): ExecutionTrace {
    return {
      ...this.trace,
      events: [...this.trace.events],
    };
  }

  /**
   * Add trace recorder observer
   */
  private addTraceRecorder(): void {
    const recorder: ExecutionObserver = {
      onStateChange: (event) => {
        this.trace.events.push(event);
      },
      onMessageSent: (event) => {
        this.trace.events.push(event);
      },
      onMessageReceived: (event) => {
        this.trace.events.push(event);
      },
      onError: (event) => {
        this.trace.events.push(event);
      },
    };

    // Register the observer so it gets propagated to all executors
    this.addObserver(recorder);
  }
}
