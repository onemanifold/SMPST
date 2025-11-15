/**
 * Execution History Manager
 *
 * Manages snapshots of execution state for backward stepping (undo/redo).
 * Supports both CFG and CFSM simulators.
 */

import type {
  CFGExecutionSnapshot,
  ExecutionHistoryConfig,
  IExecutionHistory,
} from './types';
import type {
  CFSMExecutionSnapshot,
  CFSMExecutionHistoryConfig,
  ICFSMExecutionHistory,
} from './cfsm-simulator-types';

// ============================================================================
// CFG Execution History
// ============================================================================

export class ExecutionHistory implements IExecutionHistory {
  private snapshots: Map<number, CFGExecutionSnapshot> = new Map();
  private currentPosition: number = 0;
  private config: Required<ExecutionHistoryConfig>;

  constructor(config: ExecutionHistoryConfig = {}) {
    this.config = {
      maxSnapshots: config.maxSnapshots ?? 1000,
      enabled: config.enabled ?? false,
    };
  }

  recordSnapshot(snapshot: CFGExecutionSnapshot): void {
    if (!this.config.enabled) {
      return;
    }

    // Add snapshot to history
    this.snapshots.set(snapshot.stepNumber, snapshot);
    this.currentPosition = snapshot.stepNumber;

    // Enforce max snapshots limit
    if (this.snapshots.size > this.config.maxSnapshots) {
      // Remove oldest snapshot
      const oldestStep = Math.min(...this.snapshots.keys());
      this.snapshots.delete(oldestStep);
    }
  }

  getSnapshot(stepNumber: number): CFGExecutionSnapshot | undefined {
    return this.snapshots.get(stepNumber);
  }

  getPreviousSnapshot(): CFGExecutionSnapshot | undefined {
    // Find the largest step number less than current position
    const previousSteps = Array.from(this.snapshots.keys())
      .filter(step => step < this.currentPosition)
      .sort((a, b) => b - a);

    if (previousSteps.length === 0) {
      return undefined;
    }

    const previousStep = previousSteps[0];
    this.currentPosition = previousStep;
    return this.snapshots.get(previousStep);
  }

  getNextSnapshot(): CFGExecutionSnapshot | undefined {
    // Find the smallest step number greater than current position
    const nextSteps = Array.from(this.snapshots.keys())
      .filter(step => step > this.currentPosition)
      .sort((a, b) => a - b);

    if (nextSteps.length === 0) {
      return undefined;
    }

    const nextStep = nextSteps[0];
    this.currentPosition = nextStep;
    return this.snapshots.get(nextStep);
  }

  getAllSnapshots(): CFGExecutionSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }

  clear(): void {
    this.snapshots.clear();
    this.currentPosition = 0;
  }

  getCurrentPosition(): number {
    return this.currentPosition;
  }

  setCurrentPosition(stepNumber: number): void {
    this.currentPosition = stepNumber;
  }

  /**
   * Check if history is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable history tracking
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable history tracking
   */
  disable(): void {
    this.config.enabled = false;
  }
}

// ============================================================================
// CFSM Execution History
// ============================================================================

export class CFSMExecutionHistory implements ICFSMExecutionHistory {
  private snapshots: Map<number, CFSMExecutionSnapshot> = new Map();
  private currentPosition: number = 0;
  private config: Required<CFSMExecutionHistoryConfig>;

  constructor(config: CFSMExecutionHistoryConfig = {}) {
    this.config = {
      maxSnapshots: config.maxSnapshots ?? 1000,
      enabled: config.enabled ?? false,
    };
  }

  recordSnapshot(snapshot: CFSMExecutionSnapshot): void {
    if (!this.config.enabled) {
      return;
    }

    // Add snapshot to history
    this.snapshots.set(snapshot.stepNumber, snapshot);
    this.currentPosition = snapshot.stepNumber;

    // Enforce max snapshots limit
    if (this.snapshots.size > this.config.maxSnapshots) {
      // Remove oldest snapshot
      const oldestStep = Math.min(...this.snapshots.keys());
      this.snapshots.delete(oldestStep);
    }
  }

  getSnapshot(stepNumber: number): CFSMExecutionSnapshot | undefined {
    return this.snapshots.get(stepNumber);
  }

  getPreviousSnapshot(): CFSMExecutionSnapshot | undefined {
    // Find the largest step number less than current position
    const previousSteps = Array.from(this.snapshots.keys())
      .filter(step => step < this.currentPosition)
      .sort((a, b) => b - a);

    if (previousSteps.length === 0) {
      return undefined;
    }

    const previousStep = previousSteps[0];
    this.currentPosition = previousStep;
    return this.snapshots.get(previousStep);
  }

  getNextSnapshot(): CFSMExecutionSnapshot | undefined {
    // Find the smallest step number greater than current position
    const nextSteps = Array.from(this.snapshots.keys())
      .filter(step => step > this.currentPosition)
      .sort((a, b) => a - b);

    if (nextSteps.length === 0) {
      return undefined;
    }

    const nextStep = nextSteps[0];
    this.currentPosition = nextStep;
    return this.snapshots.get(nextStep);
  }

  getAllSnapshots(): CFSMExecutionSnapshot[] {
    return Array.from(this.snapshots.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }

  clear(): void {
    this.snapshots.clear();
    this.currentPosition = 0;
  }

  getCurrentPosition(): number {
    return this.currentPosition;
  }

  setCurrentPosition(stepNumber: number): void {
    this.currentPosition = stepNumber;
  }

  /**
   * Check if history is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable history tracking
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable history tracking
   */
  disable(): void {
    this.config.enabled = false;
  }
}
