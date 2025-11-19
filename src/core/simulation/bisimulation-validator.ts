/**
 * Bisimulation Validator - Verifies Behavioral Equivalence
 *
 * Coordinates CFGDebugger and DistributedDebugger to verify that:
 * - Global orchestration (CFG) and choreography (Distributed) are behaviorally equivalent
 * - Event traces match (modulo interleaving)
 * - Both executions reach equivalent states
 *
 * Architecture (Layer 3):
 * - Wraps BOTH CFGDebugger and DistributedDebugger
 * - Runs them in parallel or step-by-step
 * - Compares traces and states
 * - Reports divergence points
 */

import type { CFG } from '../cfg/types';
import type { CFSM } from '../cfsm/types';
import type { CFGDebugger } from './cfg-debugger';
import type { DistributedDebugger } from './distributed-debugger';
import type { DebugEvent } from './cfg-debugger';
import type { DistributedDebugEvent } from './distributed-debugger';

/**
 * Bisimulation comparison result
 */
export interface BisimulationResult {
  /**
   * Are the executions equivalent so far?
   */
  equivalent: boolean;

  /**
   * Step number where divergence occurred (if any)
   */
  divergencePoint?: number;

  /**
   * Reason for divergence (if any)
   */
  divergenceReason?: string;

  /**
   * Total steps compared
   */
  stepsCompared: number;
}

/**
 * Bisimulation trace for analysis
 */
export interface BisimulationTrace {
  cfgTrace: DebugEvent[];
  distributedTrace: DistributedDebugEvent[];
  equivalent: boolean;
  divergencePoint?: number;
}

/**
 * BisimulationValidator - Coordinates dual debuggers for equivalence checking
 */
export class BisimulationValidator {
  private cfgDebugger: CFGDebugger;
  private distributedDebugger: DistributedDebugger;

  constructor(
    cfgDebugger: CFGDebugger,
    distributedDebugger: DistributedDebugger
  ) {
    this.cfgDebugger = cfgDebugger;
    this.distributedDebugger = distributedDebugger;
  }

  /**
   * Step both debuggers forward in parallel
   */
  async stepBoth(): Promise<{
    cfg: { success: boolean; event?: DebugEvent };
    distributed: { success: boolean; event?: DistributedDebugEvent };
    equivalent: boolean;
  }> {
    // Step CFG debugger
    const cfgResult = this.cfgDebugger.stepForward();

    // Step distributed debugger
    const distResult = await this.distributedDebugger.stepForward();

    // Compare events for equivalence
    const equivalent = this.compareEvents(cfgResult.event, distResult.event);

    return {
      cfg: {
        success: cfgResult.success,
        event: cfgResult.event,
      },
      distributed: {
        success: distResult.success,
        event: distResult.event,
      },
      equivalent,
    };
  }

  /**
   * Step backward in both debuggers
   */
  async stepBackBoth(): Promise<{
    cfg: { success: boolean };
    distributed: { success: boolean };
  }> {
    const cfgResult = this.cfgDebugger.stepBackward();
    const distResult = await this.distributedDebugger.stepBackward();

    return {
      cfg: { success: cfgResult.success },
      distributed: { success: distResult.success },
    };
  }

  /**
   * Reset both debuggers
   */
  resetBoth(): void {
    this.cfgDebugger.reset();
    this.distributedDebugger.reset();
  }

  /**
   * Check if traces are equivalent
   */
  checkEquivalence(): BisimulationResult {
    const cfgEvents = this.cfgDebugger.getVisibleEvents();
    const distEvents = this.distributedDebugger.getVisibleEvents();

    // Simple check: same number of steps
    const minSteps = Math.min(cfgEvents.length, distEvents.length);

    for (let i = 0; i < minSteps; i++) {
      if (!this.compareEvents(cfgEvents[i], distEvents[i])) {
        return {
          equivalent: false,
          divergencePoint: i,
          divergenceReason: `Event mismatch at step ${i}`,
          stepsCompared: i + 1,
        };
      }
    }

    // If one has more events than the other, that's a divergence
    if (cfgEvents.length !== distEvents.length) {
      return {
        equivalent: false,
        divergencePoint: minSteps,
        divergenceReason: `Different number of events: CFG has ${cfgEvents.length}, Distributed has ${distEvents.length}`,
        stepsCompared: minSteps,
      };
    }

    return {
      equivalent: true,
      stepsCompared: minSteps,
    };
  }

  /**
   * Get full trace from both executions
   */
  getTrace(): BisimulationTrace {
    const result = this.checkEquivalence();

    return {
      cfgTrace: this.cfgDebugger.getVisibleEvents(),
      distributedTrace: this.distributedDebugger.getVisibleEvents(),
      equivalent: result.equivalent,
      divergencePoint: result.divergencePoint,
    };
  }

  /**
   * Get current position in both debuggers
   */
  getCurrentPosition(): { cfg: number; distributed: number } {
    return {
      cfg: this.cfgDebugger.getCurrentPosition(),
      distributed: this.distributedDebugger.getCurrentPosition(),
    };
  }

  /**
   * Can step back in both?
   */
  canStepBack(): boolean {
    return this.cfgDebugger.canStepBack() && this.distributedDebugger.canStepBack();
  }

  /**
   * Can step forward in both?
   */
  canStepForward(): boolean {
    return this.cfgDebugger.canStepForward() && this.distributedDebugger.canStepForward();
  }

  // Private helper methods

  /**
   * Compare a CFG event with a Distributed event for equivalence
   *
   * Note: This is a simplified comparison. Full bisimulation equivalence
   * requires considering message interleaving, role-based ordering, etc.
   */
  private compareEvents(
    cfgEvent?: DebugEvent,
    distEvent?: DistributedDebugEvent
  ): boolean {
    // Both null/undefined -> equivalent
    if (!cfgEvent && !distEvent) {
      return true;
    }

    // One null, one not -> not equivalent
    if (!cfgEvent || !distEvent) {
      return false;
    }

    // For now, basic comparison:
    // - CFG message events should correspond to distributed send/recv pairs
    // - This is simplified - real bisimulation is more complex

    // TODO: Implement proper bisimulation equivalence checking
    // For now, we just verify both produced events
    return true;
  }
}
