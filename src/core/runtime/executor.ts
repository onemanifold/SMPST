/**
 * CFSM Executor Implementation
 *
 * Executes a single role's CFSM (state machine).
 * Clean separation: executor doesn't know about UI, only manages state transitions.
 */

import type {
  ExecutorConfig,
  ExecutionState,
  ExecutionResult,
  Message,
} from './types';

/**
 * CFSM Executor
 * Manages execution of a single role's state machine
 */
export class Executor {
  constructor(config: ExecutorConfig) {
    // TODO: Implement constructor
    throw new Error('Not implemented yet');
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    throw new Error('Not implemented yet');
  }

  /**
   * Execute one step (one transition)
   */
  async step(): Promise<ExecutionResult> {
    throw new Error('Not implemented yet');
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    throw new Error('Not implemented yet');
  }
}
