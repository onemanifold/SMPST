/**
 * Call Stack Manager Implementation
 *
 * Manages protocol execution call stack with event emission for UI integration.
 *
 * Thread-safe: All operations are synchronous and atomic
 * Event-driven: Emits events for all stack modifications
 * Immutable state: Returns readonly views of internal state
 */

import type {
  ICallStackManager,
  CallStackConfig,
  CallStackState,
  ProtocolCallFrame,
  CallStackEvent,
  CallStackEventType,
  FramePushEvent,
  FramePopEvent,
  FrameStepEvent,
  StackResetEvent,
} from './call-stack-types';

// ============================================================================
// Errors
// ============================================================================

export class StackOverflowError extends Error {
  constructor(maxDepth: number) {
    super(`Call stack overflow: maximum depth ${maxDepth} exceeded`);
    this.name = 'StackOverflowError';
  }
}

export class MaxIterationsExceededError extends Error {
  constructor(label: string, maxIterations: number) {
    super(`Maximum iterations (${maxIterations}) exceeded for recursion "${label}"`);
    this.name = 'MaxIterationsExceededError';
  }
}

export class EmptyStackError extends Error {
  constructor() {
    super('Cannot pop from empty call stack');
    this.name = 'EmptyStackError';
  }
}

// ============================================================================
// Call Stack Manager
// ============================================================================

export class CallStackManager implements ICallStackManager {
  private frames: ProtocolCallFrame[] = [];
  private frameIdCounter = 0;
  private totalSteps = 0;

  private readonly config: Required<CallStackConfig>;
  private readonly eventHandlers: Map<CallStackEventType, Set<(event: CallStackEvent) => void>>;

  constructor(config: CallStackConfig = {}) {
    this.config = {
      maxDepth: config.maxDepth ?? 100,
      maxIterations: config.maxIterations ?? 1000,
      emitEvents: config.emitEvents ?? true,
    };

    this.eventHandlers = new Map();
  }

  // ============================================================================
  // State Access
  // ============================================================================

  /**
   * Get current call stack state (readonly)
   */
  getState(): CallStackState {
    return {
      frames: [...this.frames], // Copy for immutability
      currentFrame: this.getCurrentFrame(),
      depth: this.frames.length,
      totalSteps: this.totalSteps,
    };
  }

  /**
   * Get current active frame (top of stack)
   */
  private getCurrentFrame(): ProtocolCallFrame | null {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1] : null;
  }

  // ============================================================================
  // Stack Operations
  // ============================================================================

  /**
   * Push a new frame onto the stack
   *
   * @throws {StackOverflowError} if max depth exceeded
   */
  push(frameData: Omit<ProtocolCallFrame, 'id' | 'enteredAt' | 'stepCount'>): ProtocolCallFrame {
    // Check depth limit
    if (this.frames.length >= this.config.maxDepth) {
      throw new StackOverflowError(this.config.maxDepth);
    }

    // Check iteration limit for recursion
    if (frameData.type === 'recursion') {
      const iterations = frameData.iterations ?? 0;
      if (iterations > this.config.maxIterations) {
        throw new MaxIterationsExceededError(frameData.name, this.config.maxIterations);
      }
    }

    // Create complete frame
    const frame: ProtocolCallFrame = {
      ...frameData,
      id: `frame-${this.frameIdCounter++}`,
      enteredAt: Date.now(),
      stepCount: 0,
    };

    // Push onto stack
    this.frames.push(frame);

    // Emit event
    this.emitFramePush(frame);

    return frame;
  }

  /**
   * Pop the current frame off the stack
   *
   * @throws {EmptyStackError} if stack is empty
   */
  pop(): ProtocolCallFrame {
    if (this.frames.length === 0) {
      throw new EmptyStackError();
    }

    const frame = this.frames.pop()!;

    // Calculate duration
    const duration = Date.now() - frame.enteredAt;

    // Emit event
    this.emitFramePop(frame, 'completion', duration);

    return frame;
  }

  /**
   * Update current frame's position and step count
   */
  step(nodeId: string, action?: string): void {
    const frame = this.getCurrentFrame();
    if (!frame) {
      throw new EmptyStackError();
    }

    // Update frame
    frame.currentNode = nodeId;
    frame.stepCount++;
    this.totalSteps++;

    // Update iterations for recursion frames
    if (frame.type === 'recursion') {
      // Iteration counting logic handled externally
      // (simulator knows when continue is taken)
    }

    // Emit event
    this.emitFrameStep(frame, nodeId, action);
  }

  /**
   * Increment iteration count for current recursion frame
   */
  incrementIterations(): void {
    const frame = this.getCurrentFrame();
    if (frame && frame.type === 'recursion') {
      frame.iterations = (frame.iterations ?? 0) + 1;

      // Check iteration limit
      if (frame.iterations > this.config.maxIterations) {
        throw new MaxIterationsExceededError(frame.name, this.config.maxIterations);
      }
    }
  }

  /**
   * Reset the call stack (clears all frames)
   */
  reset(): void {
    this.frames = [];
    this.frameIdCounter = 0;
    this.totalSteps = 0;

    // Emit event
    this.emitStackReset();
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to call stack events
   */
  on(eventType: CallStackEventType, handler: (event: CallStackEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from call stack events
   */
  off(eventType: CallStackEventType, handler: (event: CallStackEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  private emit(event: CallStackEvent): void {
    if (!this.config.emitEvents) return;

    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          // Prevent handler errors from breaking the stack
          console.error(`Error in call stack event handler:`, error);
        }
      }
    }
  }

  /**
   * Emit frame push event
   */
  private emitFramePush(frame: ProtocolCallFrame): void {
    const event: FramePushEvent = {
      type: 'frame-push',
      timestamp: Date.now(),
      stack: [...this.frames],
      depth: this.frames.length,
      frame,
      reason: frame.type === 'recursion' ? 'recursion' : 'subprotocol',
    };
    this.emit(event);
  }

  /**
   * Emit frame pop event
   */
  private emitFramePop(
    frame: ProtocolCallFrame,
    reason: 'completion' | 'max-iterations',
    duration: number
  ): void {
    const event: FramePopEvent = {
      type: 'frame-pop',
      timestamp: Date.now(),
      stack: [...this.frames],
      depth: this.frames.length,
      frame,
      reason,
      duration,
    };
    this.emit(event);
  }

  /**
   * Emit frame step event
   */
  private emitFrameStep(frame: ProtocolCallFrame, nodeId: string, action?: string): void {
    const event: FrameStepEvent = {
      type: 'frame-step',
      timestamp: Date.now(),
      stack: [...this.frames],
      depth: this.frames.length,
      frame,
      nodeId,
      action,
    };
    this.emit(event);
  }

  /**
   * Emit stack reset event
   */
  private emitStackReset(): void {
    const event: StackResetEvent = {
      type: 'stack-reset',
      timestamp: Date.now(),
      stack: [],
      depth: 0,
    };
    this.emit(event);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Find frame by ID
   */
  getFrameById(id: string): ProtocolCallFrame | undefined {
    return this.frames.find(f => f.id === id);
  }

  /**
   * Get frame at specific depth (0 = bottom, length-1 = top)
   */
  getFrameAtDepth(depth: number): ProtocolCallFrame | undefined {
    return this.frames[depth];
  }

  /**
   * Check if stack is empty
   */
  isEmpty(): boolean {
    return this.frames.length === 0;
  }

  /**
   * Get stack depth
   */
  getDepth(): number {
    return this.frames.length;
  }

  /**
   * Get all frames (readonly copy)
   */
  getFrames(): ReadonlyArray<ProtocolCallFrame> {
    return [...this.frames];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new call stack manager
 */
export function createCallStackManager(config?: CallStackConfig): ICallStackManager {
  return new CallStackManager(config);
}
