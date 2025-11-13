/**
 * Stepping Framework for Verification and Debugging
 *
 * Provides step-forward, step-in, step-back capabilities to:
 * 1. Reason through execution semantics
 * 2. Prove correctness at test time
 * 3. Assist diagnosis of protocol bugs
 *
 * Following MPST formal semantics:
 * - Step forward: one transition per role (interleaving)
 * - Step back: reverse to previous global state (time-travel)
 * - Step in: enter sub-protocol with call stack
 * - Step out: exit sub-protocol, return to caller
 */

import type {
  SimulationState,
  ExecutionState,
  Message,
} from './types';

/**
 * Snapshot of complete simulation state at one point in time
 * Used for step-back (time-travel debugging)
 */
export interface SimulationSnapshot {
  /** Step number when snapshot was taken */
  step: number;

  /** State of each role's executor */
  roleStates: Map<string, ExecutionState>;

  /** State of all message queues (per-pair) */
  messageQueues: Map<string, Message[]>;  // "sender->receiver" -> Message[]

  /** Timestamp when snapshot was taken */
  timestamp: number;

  /** Description of what happened in this step */
  description?: string;
}

/**
 * History of execution steps for time-travel debugging
 */
export class ExecutionHistory {
  private snapshots: SimulationSnapshot[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 1000) {
    this.maxHistory = maxHistory;
  }

  /**
   * Record a snapshot of current state
   */
  record(snapshot: SimulationSnapshot): void {
    this.snapshots.push(snapshot);

    // Limit history size
    if (this.snapshots.length > this.maxHistory) {
      this.snapshots.shift();
    }
  }

  /**
   * Get snapshot at specific step
   */
  getSnapshot(step: number): SimulationSnapshot | undefined {
    return this.snapshots.find(s => s.step === step);
  }

  /**
   * Get most recent snapshot
   */
  getCurrent(): SimulationSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1];
  }

  /**
   * Get previous snapshot (for step-back)
   */
  getPrevious(): SimulationSnapshot | undefined {
    if (this.snapshots.length < 2) return undefined;
    return this.snapshots[this.snapshots.length - 2];
  }

  /**
   * Get all snapshots
   */
  getAll(): SimulationSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Get number of snapshots in history
   */
  get length(): number {
    return this.snapshots.length;
  }
}

/**
 * Step operation result
 */
export interface StepResult {
  success: boolean;
  snapshot?: SimulationSnapshot;
  error?: string;
}

/**
 * Step direction for stepping operations
 */
export type StepDirection = 'forward' | 'back' | 'in' | 'out';

/**
 * Verification utilities for proving correctness
 */
export class SteppingVerifier {
  /**
   * Verify that stepping forward then back returns to same state
   * CRITICAL for correctness of step-back implementation
   */
  static verifyReversibility(
    beforeSnapshot: SimulationSnapshot,
    afterSnapshot: SimulationSnapshot
  ): boolean {
    // Compare role states
    if (beforeSnapshot.roleStates.size !== afterSnapshot.roleStates.size) {
      return false;
    }

    for (const [role, beforeState] of beforeSnapshot.roleStates) {
      const afterState = afterSnapshot.roleStates.get(role);
      if (!afterState) return false;

      if (beforeState.currentState !== afterState.currentState) return false;
      if (beforeState.completed !== afterState.completed) return false;
      if (beforeState.blocked !== afterState.blocked) return false;
    }

    // Compare message queues
    if (beforeSnapshot.messageQueues.size !== afterSnapshot.messageQueues.size) {
      return false;
    }

    for (const [queueKey, beforeQueue] of beforeSnapshot.messageQueues) {
      const afterQueue = afterSnapshot.messageQueues.get(queueKey);
      if (!afterQueue) return false;

      if (beforeQueue.length !== afterQueue.length) return false;

      for (let i = 0; i < beforeQueue.length; i++) {
        if (beforeQueue[i].id !== afterQueue[i].id) return false;
      }
    }

    return true;
  }

  /**
   * Verify MPST invariants hold at a snapshot
   */
  static verifyMPSTInvariants(snapshot: SimulationSnapshot): {
    valid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Invariant 1: No role should be both completed and blocked
    for (const [role, state] of snapshot.roleStates) {
      if (state.completed && state.blocked) {
        violations.push(`Role ${role} is both completed and blocked`);
      }
    }

    // Invariant 2: Completed roles should be in terminal state
    // (Would need CFSM access to verify this)

    // Invariant 3: Messages should be in per-pair queues
    for (const queueKey of snapshot.messageQueues.keys()) {
      if (!queueKey.includes('->')) {
        violations.push(`Invalid queue key format: ${queueKey}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}
