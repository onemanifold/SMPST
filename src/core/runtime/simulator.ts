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
  private paused: boolean = false;
  private trace: ExecutionTrace;

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
   * Execute one step (for one role or all roles)
   */
  async step(role?: string): Promise<SimulationStepResult> {
    const updates = new Map();

    if (role) {
      // Step single role
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
      this.stepCount++;
    } else {
      // Step all roles
      for (const [roleName, executor] of this.executors.entries()) {
        // Skip completed roles
        if (executor.getState().completed) {
          continue;
        }

        // Try to step this role
        const result = await executor.step();
        updates.set(roleName, result);

        // If successful, increment step count
        if (result.success) {
          this.stepCount++;
        }
      }
    }

    const state = this.getState();

    return {
      success: true,
      updates,
      state,
      deadlocked: state.deadlocked,
    };
  }

  /**
   * Run simulation to completion (or until error/maxSteps)
   */
  async run(): Promise<SimulationStepResult> {
    const maxSteps = this.options.maxSteps || 1000;

    while (this.stepCount < maxSteps && !this.paused) {
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
          completed: false, // Not completed if deadlocked
          deadlocked: true,
        };
      }

      // Execute one step for all roles
      const result = await this.step();

      // Check if any role made progress
      const anySuccess = Array.from(result.updates.values()).some(r => r.success);
      if (!anySuccess) {
        // Check if all roles are just blocked waiting for messages (not a deadlock, just need to retry)
        const allBlocked = Array.from(result.updates.values()).every(
          r => !r.success && r.error?.type === 'message-not-ready'
        );
        if (!allBlocked) {
          // No progress and not all blocked on messages - likely deadlock
          return {
            success: false,
            updates: result.updates,
            state: this.getState(),
            completed: false, // Not completed if deadlocked
            deadlocked: true,
          };
        }
        // All roles blocked on messages - continue loop, they may make progress next iteration
      }
    }

    // Reached max steps
    const finalState = this.getState();
    return {
      success: false,
      updates: new Map(),
      state: finalState,
      completed: finalState.completed, // Include completion status
    };
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    this.stepCount = 0;
    this.paused = false;

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

    // Also add to all executors
    for (const executor of this.executors.values()) {
      // Need to access private observers - for now, recreate executors
      // In production, would expose addObserver on Executor
    }
  }

  /**
   * Remove an observer
   */
  removeObserver(observer: ExecutionObserver): void {
    this.observers.delete(observer);
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

    // Add to transport as message listener
    this.transport.onMessage((message) => {
      this.trace.events.push({
        type: 'message-sent',
        timestamp: Date.now(),
        message,
      });
    });
  }
}
