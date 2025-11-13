/**
 * Runtime/Simulation Type Definitions
 *
 * Clean architecture for protocol execution:
 * - Executor: Single-role CFSM execution (pure state machine)
 * - Simulator: Multi-role orchestration (coordinator)
 * - Transport: Message delivery abstraction (pluggable)
 * - Trace: Execution recording (observer pattern)
 */

import type { CFSM, CFSMState } from '../projection/types';
import type { MessageAction } from '../cfg/types';

// ============================================================================
// Core Execution Types
// ============================================================================

/**
 * Call stack frame for sub-protocol execution
 * Follows formal MPST semantics: sub-protocols are invoked with push/pop stack semantics
 *
 * Each frame represents a PARENT context to return to after sub-protocol completes
 */
export interface CallStackFrame {
  parentCFSM: CFSM;        // Parent CFSM to return to after sub-protocol completes
  returnState: string;     // State in parent CFSM to return to after completion
  roleMapping: Record<string, string>;  // Formal parameter → actual role mapping
  protocol: string;        // Sub-protocol name being executed (for debugging)
}

/**
 * State of a single role's execution
 */
export interface ExecutionState {
  role: string;
  currentState: string;  // Current CFSM state ID (in current stack frame)
  visitedStates: string[];  // History of states
  pendingMessages: Message[];  // Incoming message queue
  blocked: boolean;  // Waiting for message?
  completed: boolean;  // Reached terminal state?
  callStack: CallStackFrame[];  // Sub-protocol call stack (bottom = root protocol)
}

/**
 * A message being sent/received
 */
export interface Message {
  id: string;
  from: string;
  to: string | string[];  // Single recipient or multicast
  label: string;
  payload?: any;
  timestamp: number;
}

/**
 * Result of attempting to execute a transition
 */
export interface ExecutionResult {
  success: boolean;
  newState?: string;  // New state ID if successful
  messagesSent?: Message[];  // Messages produced
  messagesConsumed?: Message[];  // Messages consumed
  error?: ExecutionError;
}

/**
 * Execution errors
 */
export interface ExecutionError {
  type: ExecutionErrorType;
  message: string;
  state?: string;
  details?: any;
}

export type ExecutionErrorType =
  | 'no-transition'  // No valid transition from current state
  | 'protocol-violation'  // Wrong message received
  | 'deadlock'  // All roles blocked
  | 'message-not-ready'  // Expected message not in queue
  | 'already-completed';  // Role already at terminal

// ============================================================================
// Message Transport Abstraction
// ============================================================================

/**
 * Abstract message transport layer
 * Implementations: InMemoryTransport, WebSocketTransport, WebRTCTransport
 */
export interface MessageTransport {
  /**
   * Send a message through the transport
   */
  send(message: Message): Promise<void>;

  /**
   * Receive next message for a role (non-blocking)
   * Returns undefined if no message available
   */
  receive(role: string): Promise<Message | undefined>;

  /**
   * Check if message is available for role
   */
  hasMessage(role: string): boolean;

  /**
   * Get all pending messages for a role
   */
  getPendingMessages(role: string): Message[];

  /**
   * Subscribe to message events
   */
  onMessage(listener: MessageListener): void;

  /**
   * Unsubscribe from message events
   */
  offMessage(listener: MessageListener): void;
}

export type MessageListener = (message: Message) => void;

// ============================================================================
// Execution Trace (Observer Pattern)
// ============================================================================

/**
 * Recorded event during execution
 */
export type TraceEvent =
  | StateChangeEvent
  | MessageSentEvent
  | MessageReceivedEvent
  | ErrorEvent;

export interface StateChangeEvent {
  type: 'state-change';
  timestamp: number;
  role: string;
  fromState: string;
  toState: string;
}

export interface MessageSentEvent {
  type: 'message-sent';
  timestamp: number;
  message: Message;
}

export interface MessageReceivedEvent {
  type: 'message-received';
  timestamp: number;
  role: string;
  message: Message;
}

export interface ErrorEvent {
  type: 'error';
  timestamp: number;
  role: string;
  error: ExecutionError;
}

/**
 * Execution trace recorder
 */
export interface ExecutionTrace {
  events: TraceEvent[];
  startTime: number;
  endTime?: number;
  completed: boolean;
}

/**
 * Observer for execution events
 */
export interface ExecutionObserver {
  onStateChange?(event: StateChangeEvent): void;
  onMessageSent?(event: MessageSentEvent): void;
  onMessageReceived?(event: MessageReceivedEvent): void;
  onError?(event: ErrorEvent): void;
}

// ============================================================================
// Executor Configuration
// ============================================================================

/**
 * Configuration for CFSM executor
 */
export interface ExecutorConfig {
  role: string;
  cfsm: CFSM;
  transport: MessageTransport;

  // Optional CFSM registry for sub-protocol execution
  // Maps protocol name → role → CFSM
  cfsmRegistry?: Map<string, Map<string, CFSM>>;

  // Optional observers
  observers?: ExecutionObserver[];

  // Execution options
  options?: {
    maxSteps?: number;  // Prevent infinite loops
    timeout?: number;  // Timeout in milliseconds
    strictMode?: boolean;  // Fail on any violation
  };
}

/**
 * Configuration for multi-role simulator
 */
export interface SimulatorConfig {
  roles: Map<string, CFSM>;  // Role name -> CFSM
  transport?: MessageTransport;  // Optional (defaults to InMemoryTransport)

  // Execution options
  options?: {
    maxSteps?: number;
    timeout?: number;
    strictMode?: boolean;
    recordTrace?: boolean;  // Enable trace recording
  };
}

// ============================================================================
// Simulation Control
// ============================================================================

/**
 * Current state of the entire simulation
 */
export interface SimulationState {
  roles: Map<string, ExecutionState>;
  messageQueue: Message[];
  step: number;
  completed: boolean;
  deadlocked: boolean;
  error?: ExecutionError;
}

/**
 * Commands for interactive simulation
 */
export type SimulationCommand =
  | { type: 'step'; role?: string }  // Step one role or all
  | { type: 'run'; maxSteps?: number }  // Run to completion
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'inject-message'; message: Message };  // Manual message injection

/**
 * Result of simulation step
 */
export interface SimulationStepResult {
  success: boolean;
  updates: Map<string, ExecutionResult>;  // Per-role results
  state: SimulationState;
  completed?: boolean;  // True if simulation reached completion
  deadlocked?: boolean;
  error?: ExecutionError;  // Error if simulation failed
}
