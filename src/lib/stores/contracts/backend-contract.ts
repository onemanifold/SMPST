/**
 * Backend Contract Enforcement
 *
 * This file ensures stores MUST handle all backend return values.
 * TypeScript will refuse to compile if you ignore any property.
 */

import type { CFGStepResult, CFGExecutionState } from '../../../core/simulation/types';
import type { DebugStepResult } from '../../../core/simulation/cfg-debugger';
import type { DistributedDebugStepResult } from '../../../core/simulation/distributed-debugger';
import type { DistributedExecutionState } from '../../../core/simulation/types';

/**
 * Contract handler forces you to explicitly handle all backend properties
 *
 * Usage in store:
 *   const result = simulator.step();
 *   handleStepResult(result, {
 *     onSuccess: (state, event) => { ... },
 *     onError: (error) => { ... }
 *   });
 */
export interface StepResultHandler {
  /**
   * Called when step succeeds
   * @param state - Updated execution state
   * @param event - Event that occurred (may be undefined)
   */
  onSuccess: (state: CFGExecutionState, event: CFGStepResult['event']) => void;

  /**
   * Called when step fails
   * @param error - Error details
   * @param state - State at time of error
   */
  onError: (error: NonNullable<CFGStepResult['error']>, state: CFGExecutionState) => void;
}

/**
 * Handle a CFGStepResult with compile-time guarantee all properties are used
 *
 * This function FORCES you to handle both success and error cases.
 * TypeScript won't compile if you don't provide both handlers.
 */
export function handleStepResult(
  result: CFGStepResult,
  handler: StepResultHandler
): void {
  if (!result.success || result.error) {
    // Error path - MUST be handled
    handler.onError(
      result.error ?? { type: 'no-transition', message: 'Unknown error' },
      result.state
    );
  } else {
    // Success path - ALL properties exposed
    handler.onSuccess(result.state, result.event);
  }
}

/**
 * Type guard to check if result is an error
 * Useful for inline checking without full handler
 */
export function isStepError(result: CFGStepResult): result is CFGStepResult & {
  success: false;
  error: NonNullable<CFGStepResult['error']>
} {
  return !result.success || result.error !== undefined;
}

/**
 * Extract all properties from step result into separate values
 * TypeScript forces you to use all returned values
 *
 * Usage:
 *   const { state, event, error } = extractStepResult(result);
 *   if (error) { ... }
 */
export function extractStepResult(result: CFGStepResult) {
  return {
    success: result.success,
    state: result.state,
    event: result.event,
    error: result.error,
  } as const;
}

// ============================================================================
// CFG Debugger Contract Handlers
// ============================================================================

/**
 * Contract handler for CFG debugger step results
 */
export interface DebugStepResultHandler<TState, TEvent> {
  /**
   * Called when step succeeds
   */
  onSuccess: (state: TState, event?: TEvent) => void;

  /**
   * Called when step fails
   */
  onError: (error: any, state: TState) => void;
}

/**
 * Handle a DebugStepResult with compile-time guarantee all properties are used
 */
export function handleDebugStepResult(
  result: DebugStepResult,
  handler: DebugStepResultHandler<CFGExecutionState, DebugStepResult['event']>
): void {
  if (!result.success || result.error) {
    handler.onError(result.error ?? 'Unknown error', result.state);
  } else {
    handler.onSuccess(result.state, result.event);
  }
}

// ============================================================================
// Distributed Debugger Contract Handlers
// ============================================================================

/**
 * Handle a DistributedDebugStepResult with compile-time guarantee all properties are used
 */
export function handleDistributedDebugStepResult(
  result: DistributedDebugStepResult,
  handler: DebugStepResultHandler<DistributedExecutionState, DistributedDebugStepResult['event']>
): void {
  if (!result.success || result.error) {
    handler.onError(result.error ?? 'Unknown error', result.state);
  } else {
    handler.onSuccess(result.state, result.event);
  }
}
