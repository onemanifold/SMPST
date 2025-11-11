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
} from './types';

/**
 * Multi-role protocol simulator
 * Orchestrates multiple CFSM executors
 */
export class Simulator {
  constructor(config: SimulatorConfig) {
    // TODO: Implement constructor
    throw new Error('Not implemented yet');
  }

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    throw new Error('Not implemented yet');
  }

  /**
   * Execute one step (for one role or all roles)
   */
  async step(role?: string): Promise<SimulationStepResult> {
    throw new Error('Not implemented yet');
  }

  /**
   * Run simulation to completion (or until error/maxSteps)
   */
  async run(): Promise<SimulationStepResult> {
    throw new Error('Not implemented yet');
  }

  /**
   * Pause execution
   */
  pause(): void {
    throw new Error('Not implemented yet');
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    throw new Error('Not implemented yet');
  }

  /**
   * Manually inject a message (for testing/debugging)
   */
  async injectMessage(message: Message): Promise<void> {
    throw new Error('Not implemented yet');
  }

  /**
   * Add an observer to receive execution events
   */
  addObserver(observer: ExecutionObserver): void {
    throw new Error('Not implemented yet');
  }

  /**
   * Remove an observer
   */
  removeObserver(observer: ExecutionObserver): void {
    throw new Error('Not implemented yet');
  }

  /**
   * Get execution trace
   */
  getTrace(): ExecutionTrace {
    throw new Error('Not implemented yet');
  }
}
