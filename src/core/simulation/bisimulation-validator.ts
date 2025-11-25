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
import type { SendAction, ReceiveAction } from '../projection/types';

/**
 * Backward compatibility helper for accessing action label
 * Supports both new (action.message.label) and deprecated (action.label) formats
 */
function getActionLabel(action: any): string {
  // Try new format first
  if (action.message?.label) {
    return action.message.label;
  }
  // Fall back to deprecated format
  if (action.label) {
    return action.label;
  }
  throw new Error('Action missing both message.label and deprecated label property');
}

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
    distributed: { success: boolean; events?: DistributedDebugEvent[] };
    equivalent: boolean;
  }> {
    const cfgResult = this.cfgDebugger.stepForward();
    const distributedEvents: DistributedDebugEvent[] = [];
    let equivalent = true;

    if (cfgResult.success && cfgResult.event?.type === 'message') {
      // A single CFG message event corresponds to a send and a receive in the distributed simulation.
      // We need to step the distributed debugger until both have occurred.
      let sent = false;
      let received = false;
      for (let i = 0; i < 10; i++) { // Max 10 steps to find the pair
        const distResult = await this.distributedDebugger.stepForward();
        if (distResult.success && distResult.event) {
          distributedEvents.push(distResult.event);
          if (distResult.event.action?.type === 'send') sent = true;
          if (distResult.event.action?.type === 'receive') received = true;
        }
        if (sent && received) break;
      }
      equivalent = this.compareEvents(cfgResult.event, distributedEvents.find(e => e.action?.type === 'send'));
    } else if (cfgResult.success) {
      const distResult = await this.distributedDebugger.stepForward();
      if (distResult.success && distResult.event) {
        distributedEvents.push(distResult.event);
      }
      equivalent = this.compareEvents(cfgResult.event, distResult.event);
    }

    return {
      cfg: {
        success: cfgResult.success,
        event: cfgResult.event,
      },
      distributed: {
        success: true,
        events: distributedEvents,
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
    const cfgEvents = this.cfgDebugger.getVisibleEvents().filter(e => e.type === 'message');
    const distSendEvents = this.distributedDebugger.getVisibleEvents().filter(e => e.action?.type === 'send');

    const minSteps = Math.min(cfgEvents.length, distSendEvents.length);

    for (let i = 0; i < minSteps; i++) {
      if (!this.compareEvents(cfgEvents[i], distSendEvents[i])) {
        return {
          equivalent: false,
          divergencePoint: i,
          divergenceReason: `Event mismatch at step ${i}`,
          stepsCompared: i + 1,
        };
      }
    }

    if (cfgEvents.length !== distSendEvents.length) {
      return {
        equivalent: false,
        divergencePoint: minSteps,
        divergenceReason: `Different number of message events: CFG has ${cfgEvents.length}, Distributed has ${distSendEvents.length}`,
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
    if (!cfgEvent && !distEvent) return true;
    if (!cfgEvent || !distEvent) return false;

    // A CFG 'message' event should correspond to a distributed 'send' event.
    // The distributed 'receive' is an internal tau-transition from the global view.
    if (cfgEvent.type === 'message' && cfgEvent.action && distEvent.action?.type === 'send') {
      const cfgAction = cfgEvent.action;
      const distAction = distEvent.action;

      // Compare sender, receiver, and message label
      const senderMatch = cfgAction.from === distEvent.role;
      const receiverMatch = cfgAction.to === distAction.to;
      const labelMatch = getActionLabel(cfgAction) === getActionLabel(distAction);

      return senderMatch && receiverMatch && labelMatch;
    }

    // Other event types can be considered equivalent for now.
    // A more robust implementation would handle choices, parallels, etc.
    return true;
  }
}
