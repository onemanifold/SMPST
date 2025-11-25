/**
 * CFSM Debugger - Time-Travel Debugging Wrapper
 *
 * Wraps CFSMExecutor to add debugging features:
 * - Execution history (snapshots)
 * - Backward stepping (time-travel)
 * - Step modes (into/over/out)
 * - Event stream with step numbers
 *
 * Architecture:
 * - CFSMExecutor: pure execution engine
 * - CFSMDebugger: wraps executor, adds history (this class)
 * - CFSMSimulator: compatibility wrapper
 *
 * The debugger owns the executor and mediates all interactions with it.
 */

import { CFSMExecutor } from './cfsm-executor';
import type { CFSM } from '../projection/types';
import type { CFSMExecutorConfig } from './cfsm-simulator-types';

export interface CFSMDebuggerConfig extends CFSMExecutorConfig {
  /**
   * Maximum snapshots to keep (for memory management)
   */
  maxSnapshots?: number;

  /**
   * Whether to record execution trace
   */
  recordTrace?: boolean;
}

interface Snapshot {
  stepNumber: number;
  executorState: any; // Serialized executor state
  timestamp: number;
}

interface DebugEvent {
  type: string;
  stepNumber: number;
  timestamp: number;
  data: any;
}

/**
 * CFSM Debugger - adds time-travel to executor
 */
export class CFSMDebugger {
  private executor: CFSMExecutor;
  private config: Required<CFSMDebuggerConfig>;

  // History
  private snapshots: Snapshot[] = [];
  private currentStepNumber: number = 0;

  // Events
  private events: DebugEvent[] = [];

  // Event listeners
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor(cfsm: CFSM, config: CFSMDebuggerConfig = {}) {
    this.config = {
      maxSteps: config.maxSteps ?? 1000,
      maxSnapshots: config.maxSnapshots ?? 1000,
      recordTrace: config.recordTrace ?? false,
      channels: config.channels,
      cfsmRegistry: config.cfsmRegistry || new Map(),
    };

    // Create executor
    this.executor = new CFSMExecutor(cfsm, {
      maxSteps: this.config.maxSteps,
      channels: this.config.channels,
      cfsmRegistry: this.config.cfsmRegistry,
    });

    // Subscribe to executor events
    this.subscribeToExecutor();

    // Record initial snapshot
    this.recordSnapshot();
  }

  /**
   * Subscribe to executor events and annotate with step numbers
   */
  private subscribeToExecutor(): void {
    // Forward all executor events with step number annotation
    const eventTypes = ['ready', 'send', 'receive', 'tau', 'choice', 'complete',
                       'subprotocol-enter', 'subprotocol-exit', 'error'];

    for (const eventType of eventTypes) {
      this.executor.on(eventType, (data: any) => {
        const debugEvent: DebugEvent = {
          type: eventType,
          stepNumber: this.currentStepNumber,
          timestamp: Date.now(),
          data,
        };

        if (this.config.recordTrace) {
          this.events.push(debugEvent);
        }

        // Emit to debugger listeners
        this.emit(eventType, debugEvent);
      });
    }
  }

  /**
   * Record current state as snapshot
   */
  private recordSnapshot(): void {
    const snapshot: Snapshot = {
      stepNumber: this.currentStepNumber,
      executorState: this.executor.getState(),
      timestamp: Date.now(),
    };

    this.snapshots.push(snapshot);

    // Limit snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  /**
   * Event emitter pattern
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      ...this.executor.getState(),
      currentStepNumber: this.currentStepNumber,
      totalSnapshots: this.snapshots.length,
    };
  }

  /**
   * Check if completed
   */
  isComplete(): boolean {
    return this.executor.isComplete();
  }

  /**
   * Get execution events
   */
  getEvents(): DebugEvent[] {
    return [...this.events];
  }

  /**
   * Execute one step forward
   */
  async stepForward(): Promise<void> {
    await this.executor.step();
    this.currentStepNumber++;
    this.recordSnapshot();
    this.emit('step-forward', { stepNumber: this.currentStepNumber });
  }

  /**
   * Step backward (time-travel)
   */
  stepBackward(): void {
    if (this.currentStepNumber === 0) {
      throw new Error('Already at initial state');
    }

    this.currentStepNumber--;

    // Find snapshot at or before current step
    let snapshot = this.snapshots[this.currentStepNumber];
    if (!snapshot) {
      // Find closest earlier snapshot
      for (let i = this.currentStepNumber - 1; i >= 0; i--) {
        if (this.snapshots[i]) {
          snapshot = this.snapshots[i];
          break;
        }
      }
    }

    if (!snapshot) {
      throw new Error('No snapshot available for backward step');
    }

    // Note: Currently executor state is not fully restorable
    // This would require executor to support setState()
    // For now, we just track step number and let the higher layer handle reset

    this.emit('step-backward', { stepNumber: this.currentStepNumber });
  }

  /**
   * Run to completion (autonomous execution)
   */
  async run(): Promise<void> {
    // Record snapshots periodically during run
    this.executor.on('ready', () => {
      this.currentStepNumber++;
      if (this.currentStepNumber % 10 === 0) {
        this.recordSnapshot();
      }
    });

    await this.executor.run();

    // Final snapshot
    this.recordSnapshot();
  }

  /**
   * Get enabled transitions (for coordinator inspection)
   */
  getEnabledTransitions() {
    return this.executor.getEnabledTransitions();
  }

  /**
   * Get current step number
   */
  getCurrentStepNumber(): number {
    return this.currentStepNumber;
  }

  /**
   * Get total snapshots
   */
  getTotalSnapshots(): number {
    return this.snapshots.length;
  }
}
