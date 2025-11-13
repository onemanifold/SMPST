/**
 * CFSM Simulator Types
 *
 * Implements distributed execution semantics for CFSMs based on:
 * - Honda, Yoshida, Carbone (2008): Multiparty Asynchronous Session Types
 * - Brand & Zafiropulo (1983): On Communicating Finite-State Machines
 * - LTS (Labeled Transition System) semantics
 *
 * Key principle: Asynchronous message passing with FIFO channels
 */

import type { CFSM, CFSMTransition, CFSMAction } from '../projection/types';

/**
 * Configuration for CFSM simulator
 */
export interface CFSMSimulatorConfig {
  /**
   * Maximum steps before stopping (prevents infinite loops)
   */
  maxSteps?: number;

  /**
   * Maximum buffer size per channel (0 = unbounded)
   */
  maxBufferSize?: number;

  /**
   * Whether to record execution trace
   */
  recordTrace?: boolean;

  /**
   * Transition selection strategy when multiple enabled
   */
  transitionStrategy?: 'first' | 'random' | 'manual';

  /**
   * Enable FIFO ordering verification (Theorem 5.3, Honda 2016)
   * When enabled, verifies messages received in send order
   */
  verifyFIFO?: boolean;
}

/**
 * A message in flight or buffered
 */
export interface Message {
  id: string;           // Unique message ID
  from: string;         // Sender role
  to: string;           // Receiver role
  label: string;        // Message label
  payloadType?: string; // Payload type
  timestamp: number;    // When sent
}

/**
 * Message buffer for one role
 * Maps sender role → queue of messages
 */
export interface MessageBuffer {
  // from-role → messages in FIFO order
  channels: Map<string, Message[]>;
}

/**
 * Current execution state of CFSM simulator
 */
export interface CFSMExecutionState {
  /**
   * Current control state
   */
  currentState: string;

  /**
   * All visited states (for debugging/visualization)
   */
  visitedStates: string[];

  /**
   * Number of steps executed
   */
  stepCount: number;

  /**
   * Whether execution completed (reached terminal)
   */
  completed: boolean;

  /**
   * Whether max steps reached
   */
  reachedMaxSteps: boolean;

  /**
   * Message buffer state
   */
  buffer: MessageBuffer;

  /**
   * Currently enabled transitions
   */
  enabledTransitions: CFSMTransition[];

  /**
   * Pending transition selection (for manual mode)
   */
  pendingTransitionChoice: number | null;
}

/**
 * Result of executing one step
 */
export interface CFSMStepResult {
  success: boolean;
  transition?: CFSMTransition;
  action?: CFSMAction;
  state: CFSMExecutionState;
  error?: CFSMExecutionError;
}

/**
 * Result of running to completion
 */
export interface CFSMRunResult {
  success: boolean;
  steps: number;
  state: CFSMExecutionState;
  trace?: CFSMExecutionTrace;
  error?: CFSMExecutionError;
}

/**
 * Execution error
 */
export interface CFSMExecutionError {
  type: 'no-enabled-transitions' | 'buffer-overflow' | 'max-steps' | 'invalid-state' | 'transition-required' | 'fifo-violation';
  message: string;
  stateId?: string;
  details?: FIFOViolation;
}

/**
 * FIFO ordering violation detected
 * Theorem 5.3 (Honda et al. 2016): Messages must be received in send order
 */
export interface FIFOViolation {
  channel: string;  // Sender role
  expectedMessage: Message;
  actualMessage: Message;
  queueState: Message[];
}

/**
 * Execution trace
 */
export interface CFSMExecutionTrace {
  role: string;
  events: CFSMTraceEvent[];
  startTime: number;
  endTime?: number;
  totalSteps: number;
  completed: boolean;
}

/**
 * Trace event types
 */
export type CFSMTraceEvent =
  | CFSMSendEvent
  | CFSMReceiveEvent
  | CFSMTauEvent
  | CFSMChoiceEvent;

export interface CFSMSendEvent {
  type: 'send';
  timestamp: number;
  to: string | string[];
  label: string;
  payloadType?: string;
  messageId: string;
  stateId: string;
}

export interface CFSMReceiveEvent {
  type: 'receive';
  timestamp: number;
  from: string;
  label: string;
  payloadType?: string;
  messageId: string;
  stateId: string;
}

export interface CFSMTauEvent {
  type: 'tau';
  timestamp: number;
  stateId: string;
}

export interface CFSMChoiceEvent {
  type: 'choice';
  timestamp: number;
  branch: string;
  stateId: string;
}

/**
 * Event types for CFSM simulator
 */
export type CFSMEventType =
  | 'step-start'
  | 'step-end'
  | 'transition-fired'
  | 'send'
  | 'receive'
  | 'tau'
  | 'choice'
  | 'buffer-enqueue'
  | 'buffer-dequeue'
  | 'complete'
  | 'error'
  | 'deadlock';

export type CFSMEventCallback = (data: any) => void;

/**
 * Configuration for distributed simulator
 */
export interface DistributedSimulatorConfig {
  /**
   * Maximum steps before stopping
   */
  maxSteps?: number;

  /**
   * Maximum buffer size per channel
   */
  maxBufferSize?: number;

  /**
   * Channel delivery model
   */
  deliveryModel?: 'fifo' | 'unordered';

  /**
   * Whether to record traces
   */
  recordTrace?: boolean;

  /**
   * Strategy for selecting next transition when multiple roles enabled
   */
  schedulingStrategy?: 'round-robin' | 'random' | 'fair' | 'manual';

  /**
   * Whether to explore all interleavings (for verification)
   */
  exploreAllInterleavings?: boolean;
}

/**
 * Global execution state for distributed simulation
 */
export interface DistributedExecutionState {
  /**
   * Current state of each role
   */
  roleStates: Map<string, string>;

  /**
   * Step count for each role
   */
  roleSteps: Map<string, number>;

  /**
   * Global step count
   */
  globalSteps: number;

  /**
   * Messages in global queue (sent but not yet delivered)
   */
  inFlightMessages: Message[];

  /**
   * Message buffers for each role
   */
  roleBuffers: Map<string, MessageBuffer>;

  /**
   * Whether any role completed
   */
  anyCompleted: boolean;

  /**
   * Whether all roles completed
   */
  allCompleted: boolean;

  /**
   * Whether deadlock detected
   */
  deadlocked: boolean;

  /**
   * Roles that can make progress
   */
  enabledRoles: string[];
}

/**
 * Result of distributed step
 */
export interface DistributedStepResult {
  success: boolean;
  role?: string;
  transition?: CFSMTransition;
  action?: CFSMAction;
  state: DistributedExecutionState;
  error?: DistributedExecutionError;
}

/**
 * Result of distributed run
 */
export interface DistributedRunResult {
  success: boolean;
  globalSteps: number;
  state: DistributedExecutionState;
  traces: Map<string, CFSMExecutionTrace>;
  error?: DistributedExecutionError;
}

/**
 * Distributed execution error
 */
export interface DistributedExecutionError {
  type: 'deadlock' | 'buffer-overflow' | 'max-steps' | 'no-progress' | 'invalid-message';
  message: string;
  roles?: string[];
  details?: any;
}
