/**
 * Enhanced Call Stack Types for Sub-Protocol Support
 *
 * Unified call stack supporting both:
 * - Recursion (rec X { ... continue X; })
 * - Sub-protocols (do SubProtocol(...))
 *
 * Design:
 * - Single stack for both constructs (unified semantics)
 * - Formal correctness: matches Scribble operational semantics
 * - Event-driven: emits events for UI integration
 */

import type { CFG } from '../cfg/types';
import type { RoleMapping } from '../protocol-registry/registry';

// ============================================================================
// Call Stack Frame Types
// ============================================================================

/**
 * A single frame in the protocol execution call stack
 *
 * Represents either:
 * - Recursion context (rec X { ... })
 * - Sub-protocol invocation (do SubProtocol(...))
 */
export interface ProtocolCallFrame {
  /**
   * Unique frame ID (for tracking)
   */
  id: string;

  /**
   * Frame type: recursion or sub-protocol
   */
  type: 'recursion' | 'subprotocol';

  /**
   * Protocol or recursion label name
   */
  name: string;

  /**
   * Entry node ID in parent CFG (where we entered)
   */
  entryNodeId: string;

  /**
   * Exit node ID in parent CFG (where to return)
   */
  exitNodeId: string;

  /**
   * Current node ID within this frame's CFG
   */
  currentNode: string;

  /**
   * Sub-protocol CFG (for sub-protocol frames)
   */
  subCFG?: CFG;

  /**
   * Role mapping (for sub-protocol frames)
   * Maps formal roles to actual roles
   */
  roleMapping?: RoleMapping;

  /**
   * Iteration count (for recursion frames)
   */
  iterations?: number;

  /**
   * Step count within this frame
   */
  stepCount: number;

  /**
   * Timestamp when frame was created
   */
  enteredAt: number;

  /**
   * Metadata for debugging/visualization
   */
  metadata?: FrameMetadata;
}

/**
 * Frame metadata (optional, for UI/debugging)
 */
export interface FrameMetadata {
  /**
   * Display name (for UI)
   */
  displayName?: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Verification status
   */
  verified?: boolean;

  /**
   * Source location (AST node location)
   */
  sourceLocation?: any;
}

// ============================================================================
// Call Stack State
// ============================================================================

/**
 * Complete call stack state
 */
export interface CallStackState {
  /**
   * Ordered stack of frames (bottom to top)
   */
  frames: ProtocolCallFrame[];

  /**
   * Current active frame (top of stack)
   */
  currentFrame: ProtocolCallFrame | null;

  /**
   * Total depth (number of frames)
   */
  depth: number;

  /**
   * Total steps across all frames
   */
  totalSteps: number;
}

// ============================================================================
// Call Stack Events
// ============================================================================

/**
 * Base call stack event
 */
export interface CallStackEvent {
  type: CallStackEventType;
  timestamp: number;
  stack: ReadonlyArray<ProtocolCallFrame>;
  depth: number;
}

/**
 * Event types
 */
export type CallStackEventType =
  | 'frame-push'      // New frame added
  | 'frame-pop'       // Frame removed
  | 'frame-step'      // Step within frame
  | 'stack-reset';    // Stack cleared

/**
 * Frame push event (entering recursion or sub-protocol)
 */
export interface FramePushEvent extends CallStackEvent {
  type: 'frame-push';
  frame: ProtocolCallFrame;
  reason: 'recursion' | 'subprotocol';
}

/**
 * Frame pop event (exiting recursion or sub-protocol)
 */
export interface FramePopEvent extends CallStackEvent {
  type: 'frame-pop';
  frame: ProtocolCallFrame;
  reason: 'completion' | 'max-iterations';
  duration: number; // milliseconds spent in frame
}

/**
 * Frame step event (action within frame)
 */
export interface FrameStepEvent extends CallStackEvent {
  type: 'frame-step';
  frame: ProtocolCallFrame;
  nodeId: string;
  action?: string; // Description of action (if any)
}

/**
 * Stack reset event (simulation reset)
 */
export interface StackResetEvent extends CallStackEvent {
  type: 'stack-reset';
}

// ============================================================================
// Call Stack Operations
// ============================================================================

/**
 * Call stack manager interface (for DI)
 */
export interface ICallStackManager {
  /**
   * Get current stack state
   */
  getState(): CallStackState;

  /**
   * Push a new frame onto the stack
   */
  push(frame: Omit<ProtocolCallFrame, 'id' | 'enteredAt' | 'stepCount'>): ProtocolCallFrame;

  /**
   * Pop the current frame off the stack
   * @returns The popped frame, or null if stack is empty
   */
  pop(): ProtocolCallFrame | null;

  /**
   * Update current frame's position
   */
  step(nodeId: string, action?: string): void;

  /**
   * Reset the call stack
   */
  reset(): void;

  /**
   * Subscribe to stack events
   */
  on(eventType: CallStackEventType, handler: (event: CallStackEvent) => void): void;

  /**
   * Unsubscribe from stack events
   */
  off(eventType: CallStackEventType, handler: (event: CallStackEvent) => void): void;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Configuration for call stack manager
 */
export interface CallStackConfig {
  /**
   * Maximum stack depth (prevents infinite recursion)
   */
  maxDepth?: number;

  /**
   * Maximum iterations per recursion frame
   */
  maxIterations?: number;

  /**
   * Whether to emit events
   */
  emitEvents?: boolean;
}

/**
 * Frame builder for creating frames
 */
export interface FrameBuilder {
  /**
   * Build recursion frame
   */
  recursion(label: string, entryNode: string, exitNode: string): Omit<ProtocolCallFrame, 'id' | 'enteredAt' | 'stepCount'>;

  /**
   * Build sub-protocol frame
   */
  subprotocol(
    name: string,
    entryNode: string,
    exitNode: string,
    subCFG: CFG,
    roleMapping: RoleMapping
  ): Omit<ProtocolCallFrame, 'id' | 'enteredAt' | 'stepCount'>;
}
