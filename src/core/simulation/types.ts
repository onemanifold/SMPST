/**
 * CFG Simulation Types (Orchestration-based)
 *
 * Types for centralized execution from global CFG.
 * Clean separation from CFSM-based choreography execution.
 */

import type { CFGNode } from '../cfg/types';

/**
 * Configuration for CFG simulator
 */
export interface CFGSimulatorConfig {
  /**
   * Maximum number of steps before stopping (prevents infinite loops)
   */
  maxSteps?: number;

  /**
   * Whether to record execution trace
   */
  recordTrace?: boolean;

  /**
   * Choice strategy: 'manual' (user picks), 'random', or 'first'
   */
  choiceStrategy?: 'manual' | 'random' | 'first';

  /**
   * Maximum number of actions to preview in each choice branch
   * Default: 5
   */
  previewLimit?: number;

  /**
   * Protocol registry for resolving sub-protocols
   * Required for sub-protocol execution support
   */
  protocolRegistry?: any; // Will be typed as IProtocolRegistry when imported

  /**
   * Call stack manager for tracking sub-protocol invocations
   * Required for sub-protocol execution support
   */
  callStackManager?: any; // Will be typed as ICallStackManager when imported

  /**
   * Execution history manager for backward stepping
   * Optional - if not provided, a default one will be created with history disabled
   */
  executionHistory?: IExecutionHistory;
}

/**
 * Current execution state of CFG simulator
 */
export interface CFGExecutionState {
  /**
   * Current node ID(s) in CFG
   * Array because parallel execution may have multiple active nodes
   */
  currentNode: string | string[];

  /**
   * All visited node IDs in order
   */
  visitedNodes: string[];

  /**
   * Number of steps executed
   */
  stepCount: number;

  /**
   * Whether execution is complete (reached terminal)
   */
  completed: boolean;

  /**
   * Whether at a choice point requiring decision
   */
  atChoice: boolean;

  /**
   * Available choices at current choice point
   */
  availableChoices?: EnhancedChoiceOption[];

  /**
   * Whether currently in parallel composition
   */
  inParallel: boolean;

  /**
   * Active parallel branches (if in parallel)
   */
  activeBranches?: string[][];

  /**
   * Whether max steps limit was reached
   */
  reachedMaxSteps: boolean;

  /**
   * Current recursion context stack
   */
  recursionStack: RecursionContext[];
}

/**
 * A choice option at a choice point
 */
export interface ChoiceOption {
  /**
   * Index of this choice
   */
  index: number;

  /**
   * Branch label (if any)
   */
  label?: string;

  /**
   * First node in this branch (for preview)
   */
  firstNode: string;

  /**
   * Description of what happens in this branch
   */
  description?: string;
}

/**
 * Recursion context for tracking continue statements
 */
export interface RecursionContext {
  /**
   * Name of recursion variable
   */
  label: string;

  /**
   * Node ID of the rec declaration
   */
  nodeId: string;

  /**
   * Iteration count
   */
  iterations: number;
}

/**
 * Result of a simulation step
 */
export interface CFGStepResult {
  /**
   * Whether step was successful
   */
  success: boolean;

  /**
   * Execution event that occurred (if any)
   */
  event?: CFGExecutionEvent;

  /**
   * Error if step failed
   */
  error?: CFGExecutionError;

  /**
   * Updated execution state
   */
  state: CFGExecutionState;
}

/**
 * Result of running simulation to completion
 */
export interface CFGRunResult {
  /**
   * Whether execution completed successfully
   */
  success: boolean;

  /**
   * Number of steps executed
   */
  steps: number;

  /**
   * Final execution state
   */
  state: CFGExecutionState;

  /**
   * Error if execution failed
   */
  error?: CFGExecutionError;
}

/**
 * Events that occur during CFG execution
 */
export type CFGExecutionEvent =
  | MessageEvent
  | ChoiceEvent
  | RecursionEvent
  | ParallelEvent
  | SubProtocolEvent
  | StateChangeEvent;

/**
 * Message send event
 */
export interface MessageEvent {
  type: 'message';
  timestamp: number;
  from: string;
  to: string;
  label: string;
  payloadType?: string;
  nodeId: string;
}

/**
 * Choice decision event
 */
export interface ChoiceEvent {
  type: 'choice';
  timestamp: number;
  decidingRole: string;
  choiceIndex: number;
  choiceLabel?: string;
  nodeId: string;
}

/**
 * Recursion event (entering rec or continue)
 */
export interface RecursionEvent {
  type: 'recursion';
  timestamp: number;
  action: 'enter' | 'continue' | 'exit';
  label: string;
  iteration?: number;
  nodeId: string;
}

/**
 * Parallel composition event (fork or join)
 */
export interface ParallelEvent {
  type: 'parallel';
  timestamp: number;
  action: 'fork' | 'join';
  branches?: number;
  nodeId: string;
}

/**
 * Sub-protocol invocation event (enter or exit)
 */
export interface SubProtocolEvent {
  type: 'subprotocol';
  timestamp: number;
  action: 'enter' | 'exit';
  protocol: string;
  roleArguments: string[];
  nodeId: string;
}

/**
 * State transition event
 */
export interface StateChangeEvent {
  type: 'state-change';
  timestamp: number;
  fromNode: string;
  toNode: string;
}

/**
 * Execution trace for visualization and debugging
 */
export interface CFGExecutionTrace {
  /**
   * All execution events in order
   */
  events: CFGExecutionEvent[];

  /**
   * When execution started
   */
  startTime: number;

  /**
   * When execution completed (if completed)
   */
  endTime?: number;

  /**
   * Whether execution completed successfully
   */
  completed: boolean;

  /**
   * Total steps executed
   */
  totalSteps: number;
}

/**
 * Errors that can occur during CFG execution
 */
export interface CFGExecutionError {
  /**
   * Error type
   */
  type: CFGExecutionErrorType;

  /**
   * Human-readable message
   */
  message: string;

  /**
   * Node where error occurred
   */
  nodeId?: string;

  /**
   * Additional error details
   */
  details?: any;
}

export type CFGExecutionErrorType =
  | 'no-transition'        // No outgoing edge from current node
  | 'choice-required'      // At choice point but no choice made
  | 'invalid-choice'       // Choice index out of bounds
  | 'already-completed'    // Tried to step after terminal
  | 'max-steps-reached'    // Hit maxSteps limit
  | 'invalid-node'         // Node not found in CFG
  | 'recursion-not-found'  // Continue with unknown label
  | 'parallel-error';      // Error in parallel execution

// ============================================================================
// Event Subscription System
// ============================================================================

/**
 * Event types that simulator can emit for visualization/debugging
 */
export type SimulatorEventType =
  | 'step-start'           // Before executing step
  | 'step-end'             // After executing step
  | 'node-enter'           // Entering a node
  | 'node-exit'            // Leaving a node
  | 'message'              // Message action executed
  | 'choice-point'         // At choice, waiting for decision
  | 'choice-selected'      // Choice made
  | 'fork'                 // Parallel fork
  | 'join'                 // Parallel join
  | 'recursion-enter'      // Entering rec
  | 'recursion-continue'   // Continue executed
  | 'recursion-exit'       // Exiting rec
  | 'complete'             // Reached terminal
  | 'error'                // Error occurred
  | 'step-into'            // Stepping into sub-protocol
  | 'step-out'             // Stepping out of sub-protocol
  | 'step-over'            // Stepping over sub-protocol (atomic execution)
  | 'step-back'            // Stepping backward (undo)
  | 'step-forward';        // Stepping forward (explicit)

/**
 * Event callback function signature
 */
export type EventCallback = (data: any) => void;

/**
 * Enhanced choice option with full branch preview
 */
export interface EnhancedChoiceOption extends ChoiceOption {
  /**
   * Preview of all actions in this branch (up to a limit)
   */
  preview: ActionPreview[];

  /**
   * Roles participating in this branch
   */
  participatingRoles: string[];

  /**
   * Estimated number of steps in this branch
   */
  estimatedSteps: number;
}

/**
 * Preview of an action in a branch
 */
export interface ActionPreview {
  type: 'message' | 'choice' | 'parallel' | 'recursion';
  from?: string;
  to?: string;
  label: string;
  description: string;
}

// ============================================================================
// Execution History (for backward stepping)
// ============================================================================

/**
 * Snapshot of execution state at a point in time
 * Used for backward stepping (undo)
 */
export interface CFGExecutionSnapshot {
  /**
   * Step number when snapshot was taken
   */
  stepNumber: number;

  /**
   * Current node ID
   */
  currentNode: string;

  /**
   * All visited nodes up to this point
   */
  visitedNodes: string[];

  /**
   * Pending choice state
   */
  pendingChoice: EnhancedChoiceOption[] | null;

  /**
   * Selected choice index
   */
  selectedChoice: number | null;

  /**
   * Parallel execution state
   */
  parallelState: {
    inParallel: boolean;
    parallelBranches: string[][];
    parallelBranchIndex: number;
    parallelBranchesCompleted: Set<number>;
    parallelJoinNode: string | null;
  };

  /**
   * Recursion stack
   */
  recursionStack: RecursionContext[];

  /**
   * Completed flag
   */
  completed: boolean;

  /**
   * Reached max steps flag
   */
  reachedMaxSteps: boolean;

  /**
   * Timestamp when snapshot was taken
   */
  timestamp: number;

  /**
   * Last event that occurred (optional)
   */
  lastEvent?: CFGExecutionEvent;
}

/**
 * Configuration for execution history tracking
 */
export interface ExecutionHistoryConfig {
  /**
   * Maximum number of snapshots to keep
   * Default: 1000
   */
  maxSnapshots?: number;

  /**
   * Whether to enable history tracking
   * Default: false (disabled for performance)
   */
  enabled?: boolean;
}

/**
 * Execution history manager interface
 */
export interface IExecutionHistory {
  /**
   * Record a snapshot
   */
  recordSnapshot(snapshot: CFGExecutionSnapshot): void;

  /**
   * Get snapshot at specific step
   */
  getSnapshot(stepNumber: number): CFGExecutionSnapshot | undefined;

  /**
   * Get previous snapshot
   */
  getPreviousSnapshot(): CFGExecutionSnapshot | undefined;

  /**
   * Get next snapshot
   */
  getNextSnapshot(): CFGExecutionSnapshot | undefined;

  /**
   * Get all snapshots
   */
  getAllSnapshots(): CFGExecutionSnapshot[];

  /**
   * Clear all snapshots
   */
  clear(): void;

  /**
   * Get current position in history
   */
  getCurrentPosition(): number;

  /**
   * Set current position in history
   */
  setCurrentPosition(stepNumber: number): void;
}
