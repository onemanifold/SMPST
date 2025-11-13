/**
 * Comprehensive Test Suite for Call Stack Manager
 *
 * Tests formal correctness and edge cases:
 * - Stack operations (push, pop, step, reset)
 * - Event emission and handling
 * - Error conditions (overflow, empty stack, max iterations)
 * - Frame management (recursion and sub-protocol)
 * - Configuration validation
 * - Immutability guarantees
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CallStackManager,
  createCallStackManager,
  StackOverflowError,
  MaxIterationsExceededError,
  EmptyStackError,
} from './call-stack-manager';
import type {
  ICallStackManager,
  ProtocolCallFrame,
  CallStackEvent,
  FramePushEvent,
  FramePopEvent,
  FrameStepEvent,
  StackResetEvent,
} from './call-stack-types';
import type { CFG } from '../cfg/types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a minimal CFG for testing
 */
function createTestCFG(name: string): CFG {
  return {
    protocolName: name,
    role: 'TestRole',
    nodes: [
      { id: 'entry', type: 'entry', label: 'Entry' },
      { id: 'exit', type: 'exit', label: 'Exit' },
    ],
    edges: [{ from: 'entry', to: 'exit', label: '' }],
    entryNodeId: 'entry',
    exitNodeId: 'exit',
  };
}

/**
 * Create a recursion frame for testing
 */
function createRecursionFrame(
  label: string,
  entryNode: string = 'rec_entry',
  exitNode: string = 'rec_exit'
): Omit<ProtocolCallFrame, 'id' | 'enteredAt' | 'stepCount'> {
  return {
    type: 'recursion',
    name: label,
    entryNodeId: entryNode,
    exitNodeId: exitNode,
    currentNode: entryNode,
    iterations: 0,
  };
}

/**
 * Create a sub-protocol frame for testing
 */
function createSubProtocolFrame(
  protocolName: string,
  entryNode: string = 'entry',
  exitNode: string = 'exit'
): Omit<ProtocolCallFrame, 'id' | 'enteredAt' | 'stepCount'> {
  return {
    type: 'subprotocol',
    name: protocolName,
    entryNodeId: entryNode,
    exitNodeId: exitNode,
    currentNode: entryNode,
    subCFG: createTestCFG(protocolName),
    roleMapping: {
      mapping: new Map([['Client', 'Alice'], ['Server', 'Bob']]),
      reverse: new Map([['Alice', 'Client'], ['Bob', 'Server']]),
    },
  };
}

// ============================================================================
// Test Suite: Basic Operations
// ============================================================================

describe('CallStackManager - Basic Operations', () => {
  let manager: ICallStackManager;

  beforeEach(() => {
    manager = createCallStackManager();
  });

  it('should start with empty stack', () => {
    const state = manager.getState();
    expect(state.frames).toEqual([]);
    expect(state.currentFrame).toBeNull();
    expect(state.depth).toBe(0);
    expect(state.totalSteps).toBe(0);
    expect(manager.isEmpty()).toBe(true);
  });

  it('should push recursion frame', () => {
    const frameData = createRecursionFrame('Loop');
    const frame = manager.push(frameData);

    expect(frame.id).toMatch(/^frame-\d+$/);
    expect(frame.type).toBe('recursion');
    expect(frame.name).toBe('Loop');
    expect(frame.stepCount).toBe(0);
    expect(frame.enteredAt).toBeGreaterThan(0);

    const state = manager.getState();
    expect(state.depth).toBe(1);
    expect(state.currentFrame).toEqual(frame);
    expect(manager.isEmpty()).toBe(false);
  });

  it('should push sub-protocol frame', () => {
    const frameData = createSubProtocolFrame('AuthProtocol');
    const frame = manager.push(frameData);

    expect(frame.id).toMatch(/^frame-\d+$/);
    expect(frame.type).toBe('subprotocol');
    expect(frame.name).toBe('AuthProtocol');
    expect(frame.subCFG).toBeDefined();
    expect(frame.roleMapping).toBeDefined();
  });

  it('should pop frame and return it', () => {
    const frameData = createRecursionFrame('Loop');
    const pushedFrame = manager.push(frameData);

    const poppedFrame = manager.pop();
    expect(poppedFrame).toEqual(pushedFrame);

    const state = manager.getState();
    expect(state.depth).toBe(0);
    expect(state.currentFrame).toBeNull();
    expect(manager.isEmpty()).toBe(true);
  });

  it('should throw EmptyStackError when popping empty stack', () => {
    expect(() => manager.pop()).toThrow(EmptyStackError);
    expect(() => manager.pop()).toThrow('Cannot pop from empty call stack');
  });

  it('should step within current frame', () => {
    const frameData = createRecursionFrame('Loop');
    manager.push(frameData);

    manager.step('node1', 'Send message');

    let state = manager.getState();
    expect(state.currentFrame?.currentNode).toBe('node1');
    expect(state.currentFrame?.stepCount).toBe(1);
    expect(state.totalSteps).toBe(1);

    manager.step('node2', 'Receive response');
    state = manager.getState(); // Get fresh state after second step
    expect(state.currentFrame?.stepCount).toBe(2);
    expect(state.totalSteps).toBe(2);
  });

  it('should throw EmptyStackError when stepping on empty stack', () => {
    expect(() => manager.step('node1')).toThrow(EmptyStackError);
  });

  it('should reset stack completely', () => {
    manager.push(createRecursionFrame('Loop1'));
    manager.push(createSubProtocolFrame('Auth'));
    manager.step('node1');
    manager.step('node2');

    manager.reset();

    const state = manager.getState();
    expect(state.frames).toEqual([]);
    expect(state.depth).toBe(0);
    expect(state.totalSteps).toBe(0);
    expect(manager.isEmpty()).toBe(true);
  });

  it('should assign unique frame IDs', () => {
    const frame1 = manager.push(createRecursionFrame('Loop1'));
    const frame2 = manager.push(createRecursionFrame('Loop2'));
    const frame3 = manager.push(createSubProtocolFrame('Auth'));

    expect(frame1.id).not.toBe(frame2.id);
    expect(frame2.id).not.toBe(frame3.id);
    expect(frame1.id).not.toBe(frame3.id);
  });
});

// ============================================================================
// Test Suite: Stack Depth and Overflow
// ============================================================================

describe('CallStackManager - Stack Depth', () => {
  it('should enforce default max depth (100)', () => {
    const manager = createCallStackManager();

    // Push 100 frames (should succeed)
    for (let i = 0; i < 100; i++) {
      manager.push(createRecursionFrame(`Loop${i}`));
    }
    expect(manager.getDepth()).toBe(100);

    // Push 101st frame (should fail)
    expect(() => manager.push(createRecursionFrame('Loop101'))).toThrow(StackOverflowError);
    expect(() => manager.push(createRecursionFrame('Loop101'))).toThrow(
      'Call stack overflow: maximum depth 100 exceeded'
    );
  });

  it('should enforce custom max depth', () => {
    const manager = createCallStackManager({ maxDepth: 5 });

    for (let i = 0; i < 5; i++) {
      manager.push(createRecursionFrame(`Loop${i}`));
    }
    expect(manager.getDepth()).toBe(5);

    expect(() => manager.push(createRecursionFrame('Loop6'))).toThrow(StackOverflowError);
    expect(() => manager.push(createRecursionFrame('Loop6'))).toThrow(
      'maximum depth 5 exceeded'
    );
  });

  it('should allow pushing after popping below max depth', () => {
    const manager = createCallStackManager({ maxDepth: 3 });

    manager.push(createRecursionFrame('Loop1'));
    manager.push(createRecursionFrame('Loop2'));
    manager.push(createRecursionFrame('Loop3'));

    expect(() => manager.push(createRecursionFrame('Loop4'))).toThrow(StackOverflowError);

    manager.pop();
    expect(manager.getDepth()).toBe(2);

    // Should succeed now
    const frame = manager.push(createRecursionFrame('Loop4'));
    expect(frame.name).toBe('Loop4');
    expect(manager.getDepth()).toBe(3);
  });
});

// ============================================================================
// Test Suite: Iteration Counting
// ============================================================================

describe('CallStackManager - Iteration Counting', () => {
  it('should track iterations for recursion frames', () => {
    const manager = createCallStackManager();
    const frameData = createRecursionFrame('Loop');
    manager.push(frameData);

    manager.incrementIterations();
    expect(manager.getState().currentFrame?.iterations).toBe(1);

    manager.incrementIterations();
    expect(manager.getState().currentFrame?.iterations).toBe(2);
  });

  it('should enforce max iterations limit', () => {
    const manager = createCallStackManager({ maxIterations: 10 });
    const frameData = createRecursionFrame('Loop');
    manager.push(frameData);

    // Increment to limit
    for (let i = 0; i < 10; i++) {
      manager.incrementIterations();
    }
    expect(manager.getState().currentFrame?.iterations).toBe(10);

    // Exceed limit
    expect(() => manager.incrementIterations()).toThrow(MaxIterationsExceededError);
    expect(() => manager.incrementIterations()).toThrow(
      'Maximum iterations (10) exceeded for recursion "Loop"'
    );
  });

  it('should not throw when incrementing iterations on sub-protocol frame', () => {
    const manager = createCallStackManager();
    manager.push(createSubProtocolFrame('Auth'));

    // Should be safe no-op
    expect(() => manager.incrementIterations()).not.toThrow();
    expect(manager.getState().currentFrame?.iterations).toBeUndefined();
  });

  it('should not throw when incrementing iterations on empty stack', () => {
    const manager = createCallStackManager();

    // Should be safe no-op
    expect(() => manager.incrementIterations()).not.toThrow();
  });

  it('should reject pushing recursion frame with iterations exceeding limit', () => {
    const manager = createCallStackManager({ maxIterations: 5 });
    const frameData = createRecursionFrame('Loop');
    frameData.iterations = 6; // Exceeds limit of 5

    expect(() => manager.push(frameData)).toThrow(MaxIterationsExceededError);
  });

  it('should accept pushing recursion frame with iterations at limit', () => {
    const manager = createCallStackManager({ maxIterations: 5 });
    const frameData = createRecursionFrame('Loop');
    frameData.iterations = 5; // At limit, should be allowed

    const frame = manager.push(frameData);
    expect(frame.iterations).toBe(5);
  });

  it('should accept pushing recursion frame with iterations below limit', () => {
    const manager = createCallStackManager({ maxIterations: 10 });
    const frameData = createRecursionFrame('Loop');
    frameData.iterations = 3;

    const frame = manager.push(frameData);
    expect(frame.iterations).toBe(3);
  });
});

// ============================================================================
// Test Suite: State Access
// ============================================================================

describe('CallStackManager - State Access', () => {
  let manager: ICallStackManager;

  beforeEach(() => {
    manager = createCallStackManager();
  });

  it('should return immutable state copy', () => {
    manager.push(createRecursionFrame('Loop'));
    const state1 = manager.getState();
    const state2 = manager.getState();

    // Different array instances
    expect(state1.frames).not.toBe(state2.frames);

    // But equal content
    expect(state1.frames).toEqual(state2.frames);
  });

  it('should not allow external modification of frames', () => {
    manager.push(createRecursionFrame('Loop1'));
    manager.push(createRecursionFrame('Loop2'));

    const state = manager.getState();
    const originalDepth = state.depth;

    // Try to modify (should not affect internal state)
    state.frames.pop();

    const newState = manager.getState();
    expect(newState.depth).toBe(originalDepth);
    expect(newState.frames.length).toBe(2);
  });

  it('should get frame by ID', () => {
    const frame1 = manager.push(createRecursionFrame('Loop1'));
    const frame2 = manager.push(createRecursionFrame('Loop2'));

    const retrieved = manager.getFrameById(frame1.id);
    expect(retrieved).toEqual(frame1);
    expect(manager.getFrameById(frame2.id)).toEqual(frame2);
    expect(manager.getFrameById('nonexistent')).toBeUndefined();
  });

  it('should get frame at specific depth', () => {
    const frame1 = manager.push(createRecursionFrame('Loop1'));
    const frame2 = manager.push(createRecursionFrame('Loop2'));
    const frame3 = manager.push(createSubProtocolFrame('Auth'));

    expect(manager.getFrameAtDepth(0)).toEqual(frame1);
    expect(manager.getFrameAtDepth(1)).toEqual(frame2);
    expect(manager.getFrameAtDepth(2)).toEqual(frame3);
    expect(manager.getFrameAtDepth(3)).toBeUndefined();
    expect(manager.getFrameAtDepth(-1)).toBeUndefined();
  });

  it('should return readonly array of frames', () => {
    manager.push(createRecursionFrame('Loop1'));
    manager.push(createRecursionFrame('Loop2'));

    const frames = manager.getFrames();
    expect(frames.length).toBe(2);

    // Verify it's a copy
    const frames2 = manager.getFrames();
    expect(frames).not.toBe(frames2);
    expect(frames).toEqual(frames2);
  });

  it('should correctly report isEmpty', () => {
    expect(manager.isEmpty()).toBe(true);

    manager.push(createRecursionFrame('Loop'));
    expect(manager.isEmpty()).toBe(false);

    manager.pop();
    expect(manager.isEmpty()).toBe(true);
  });

  it('should correctly report depth', () => {
    expect(manager.getDepth()).toBe(0);

    manager.push(createRecursionFrame('Loop1'));
    expect(manager.getDepth()).toBe(1);

    manager.push(createRecursionFrame('Loop2'));
    expect(manager.getDepth()).toBe(2);

    manager.pop();
    expect(manager.getDepth()).toBe(1);

    manager.reset();
    expect(manager.getDepth()).toBe(0);
  });
});

// ============================================================================
// Test Suite: Event Emission
// ============================================================================

describe('CallStackManager - Event Emission', () => {
  it('should emit frame-push event when pushing', () => {
    const manager = createCallStackManager();
    const events: FramePushEvent[] = [];

    manager.on('frame-push', (event) => {
      events.push(event as FramePushEvent);
    });

    const frameData = createRecursionFrame('Loop');
    const frame = manager.push(frameData);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('frame-push');
    expect(events[0].frame).toEqual(frame);
    expect(events[0].reason).toBe('recursion');
    expect(events[0].depth).toBe(1);
    expect(events[0].timestamp).toBeGreaterThan(0);
  });

  it('should emit frame-push with subprotocol reason', () => {
    const manager = createCallStackManager();
    const events: FramePushEvent[] = [];

    manager.on('frame-push', (event) => {
      events.push(event as FramePushEvent);
    });

    manager.push(createSubProtocolFrame('Auth'));

    expect(events[0].reason).toBe('subprotocol');
  });

  it('should emit frame-pop event when popping', () => {
    const manager = createCallStackManager();
    const events: FramePopEvent[] = [];

    manager.on('frame-pop', (event) => {
      events.push(event as FramePopEvent);
    });

    const frame = manager.push(createRecursionFrame('Loop'));

    // Small delay to ensure duration > 0
    const start = Date.now();
    while (Date.now() - start < 5) {
      // Wait
    }

    manager.pop();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('frame-pop');
    expect(events[0].frame.id).toBe(frame.id);
    expect(events[0].reason).toBe('completion');
    expect(events[0].duration).toBeGreaterThanOrEqual(0);
    expect(events[0].depth).toBe(0);
  });

  it('should emit frame-step event when stepping', () => {
    const manager = createCallStackManager();
    const events: FrameStepEvent[] = [];

    manager.on('frame-step', (event) => {
      events.push(event as FrameStepEvent);
    });

    manager.push(createRecursionFrame('Loop'));
    manager.step('node1', 'Send message');

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('frame-step');
    expect(events[0].nodeId).toBe('node1');
    expect(events[0].action).toBe('Send message');
    expect(events[0].depth).toBe(1);
  });

  it('should emit stack-reset event when resetting', () => {
    const manager = createCallStackManager();
    const events: StackResetEvent[] = [];

    manager.on('stack-reset', (event) => {
      events.push(event as StackResetEvent);
    });

    manager.push(createRecursionFrame('Loop'));
    manager.reset();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('stack-reset');
    expect(events[0].depth).toBe(0);
    expect(events[0].stack).toEqual([]);
  });

  it('should not emit events when emitEvents is false', () => {
    const manager = createCallStackManager({ emitEvents: false });
    const events: CallStackEvent[] = [];

    manager.on('frame-push', (event) => events.push(event));
    manager.on('frame-pop', (event) => events.push(event));
    manager.on('frame-step', (event) => events.push(event));
    manager.on('stack-reset', (event) => events.push(event));

    manager.push(createRecursionFrame('Loop'));
    manager.step('node1');
    manager.pop();
    manager.reset();

    expect(events).toHaveLength(0);
  });

  it('should support multiple event handlers', () => {
    const manager = createCallStackManager();
    const events1: FramePushEvent[] = [];
    const events2: FramePushEvent[] = [];

    manager.on('frame-push', (event) => events1.push(event as FramePushEvent));
    manager.on('frame-push', (event) => events2.push(event as FramePushEvent));

    manager.push(createRecursionFrame('Loop'));

    expect(events1).toHaveLength(1);
    expect(events2).toHaveLength(1);
    expect(events1[0]).toEqual(events2[0]);
  });

  it('should support unsubscribing from events', () => {
    const manager = createCallStackManager();
    const events: FramePushEvent[] = [];

    const handler = (event: CallStackEvent) => {
      events.push(event as FramePushEvent);
    };

    manager.on('frame-push', handler);
    manager.push(createRecursionFrame('Loop1'));
    expect(events).toHaveLength(1);

    manager.off('frame-push', handler);
    manager.push(createRecursionFrame('Loop2'));
    expect(events).toHaveLength(1); // No new event
  });

  it('should not break stack when event handler throws', () => {
    const manager = createCallStackManager();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    manager.on('frame-push', () => {
      throw new Error('Handler error');
    });

    // Should not throw
    expect(() => manager.push(createRecursionFrame('Loop'))).not.toThrow();
    expect(manager.getDepth()).toBe(1);

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should include complete stack snapshot in events', () => {
    const manager = createCallStackManager();
    const events: CallStackEvent[] = [];

    manager.on('frame-push', (event) => events.push(event));
    manager.on('frame-step', (event) => events.push(event));

    manager.push(createRecursionFrame('Loop1'));
    manager.push(createRecursionFrame('Loop2'));
    manager.step('node1');

    // Each event should have complete stack snapshot at that point
    expect(events[0].stack).toHaveLength(1);
    expect(events[1].stack).toHaveLength(2);
    expect(events[2].stack).toHaveLength(2);
  });
});

// ============================================================================
// Test Suite: Mixed Frame Types
// ============================================================================

describe('CallStackManager - Mixed Frame Types', () => {
  it('should handle mixed recursion and sub-protocol frames', () => {
    const manager = createCallStackManager();

    const rec1 = manager.push(createRecursionFrame('MainLoop'));
    const sub1 = manager.push(createSubProtocolFrame('Auth'));
    const rec2 = manager.push(createRecursionFrame('InnerLoop'));
    const sub2 = manager.push(createSubProtocolFrame('Payment'));

    const frames = manager.getFrames();
    expect(frames[0].type).toBe('recursion');
    expect(frames[1].type).toBe('subprotocol');
    expect(frames[2].type).toBe('recursion');
    expect(frames[3].type).toBe('subprotocol');

    expect(manager.getDepth()).toBe(4);
  });

  it('should maintain independent iteration counts per recursion frame', () => {
    const manager = createCallStackManager();

    manager.push(createRecursionFrame('OuterLoop'));
    manager.incrementIterations();
    manager.incrementIterations();
    expect(manager.getState().currentFrame?.iterations).toBe(2);

    manager.push(createRecursionFrame('InnerLoop'));
    manager.incrementIterations();
    expect(manager.getState().currentFrame?.iterations).toBe(1);

    manager.pop();
    expect(manager.getState().currentFrame?.iterations).toBe(2);
  });

  it('should maintain independent step counts per frame', () => {
    const manager = createCallStackManager();

    manager.push(createRecursionFrame('Loop1'));
    manager.step('node1');
    manager.step('node2');
    expect(manager.getState().currentFrame?.stepCount).toBe(2);

    manager.push(createSubProtocolFrame('Auth'));
    manager.step('auth_node1');
    expect(manager.getState().currentFrame?.stepCount).toBe(1);

    const state = manager.getState();
    expect(state.frames[0].stepCount).toBe(2);
    expect(state.frames[1].stepCount).toBe(1);
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('CallStackManager - Edge Cases', () => {
  it('should handle metadata in frames', () => {
    const manager = createCallStackManager();
    const frameData = createRecursionFrame('Loop');
    frameData.metadata = {
      displayName: 'Main Loop',
      description: 'Primary processing loop',
      verified: true,
    };

    const frame = manager.push(frameData);
    expect(frame.metadata?.displayName).toBe('Main Loop');
    expect(frame.metadata?.verified).toBe(true);
  });

  it('should handle frames with special characters in names', () => {
    const manager = createCallStackManager();

    const frame1 = manager.push(createRecursionFrame('Loop:Main'));
    const frame2 = manager.push(createSubProtocolFrame('Auth/OAuth2'));
    const frame3 = manager.push(createRecursionFrame('Loop-Inner_v2'));

    expect(frame1.name).toBe('Loop:Main');
    expect(frame2.name).toBe('Auth/OAuth2');
    expect(frame3.name).toBe('Loop-Inner_v2');
  });

  it('should handle very long protocol names', () => {
    const manager = createCallStackManager();
    const longName = 'A'.repeat(1000);

    const frame = manager.push(createSubProtocolFrame(longName));
    expect(frame.name).toBe(longName);
  });

  it('should handle rapid push/pop cycles', () => {
    const manager = createCallStackManager();

    for (let i = 0; i < 100; i++) {
      manager.push(createRecursionFrame(`Loop${i}`));
      manager.step('node1');
      manager.pop();
    }

    expect(manager.isEmpty()).toBe(true);
    expect(manager.getState().totalSteps).toBe(100);
  });

  it('should maintain total step count across frames', () => {
    const manager = createCallStackManager();

    manager.push(createRecursionFrame('Loop1'));
    manager.step('node1');
    manager.step('node2');

    manager.push(createRecursionFrame('Loop2'));
    manager.step('node1');

    expect(manager.getState().totalSteps).toBe(3);

    manager.pop();
    manager.step('node3');

    expect(manager.getState().totalSteps).toBe(4);
  });

  it('should preserve total step count after reset', () => {
    const manager = createCallStackManager();

    manager.push(createRecursionFrame('Loop'));
    manager.step('node1');
    manager.step('node2');

    manager.reset();
    expect(manager.getState().totalSteps).toBe(0);

    manager.push(createRecursionFrame('Loop2'));
    manager.step('node1');
    expect(manager.getState().totalSteps).toBe(1);
  });

  it('should handle complex role mappings', () => {
    const manager = createCallStackManager();
    const frameData = createSubProtocolFrame('MultiRoleAuth');

    frameData.roleMapping = {
      mapping: new Map([
        ['Client', 'Alice'],
        ['Server', 'Bob'],
        ['Verifier', 'Charlie'],
      ]),
      reverse: new Map([
        ['Alice', 'Client'],
        ['Bob', 'Server'],
        ['Charlie', 'Verifier'],
      ]),
    };

    const frame = manager.push(frameData);
    expect(frame.roleMapping?.mapping.size).toBe(3);
    expect(frame.roleMapping?.mapping.get('Client')).toBe('Alice');
    expect(frame.roleMapping?.reverse.get('Charlie')).toBe('Verifier');
  });
});

// ============================================================================
// Test Suite: Integration Scenarios
// ============================================================================

describe('CallStackManager - Integration', () => {
  it('should handle realistic protocol execution scenario', () => {
    const manager = createCallStackManager({ maxDepth: 10, maxIterations: 5 });
    const events: CallStackEvent[] = [];

    // Subscribe to all events
    manager.on('frame-push', (e) => events.push(e));
    manager.on('frame-pop', (e) => events.push(e));
    manager.on('frame-step', (e) => events.push(e));

    // Main protocol starts
    manager.push(createRecursionFrame('MainLoop'));
    manager.step('main_init', 'Initialize');

    // Enter sub-protocol
    manager.push(createSubProtocolFrame('AuthProtocol'));
    manager.step('auth_start', 'Begin authentication');
    manager.step('auth_verify', 'Verify credentials');
    manager.pop();

    // Continue main protocol
    manager.step('main_process', 'Process data');

    // Enter nested recursion
    manager.push(createRecursionFrame('DataLoop'));
    manager.incrementIterations();
    manager.step('data_read', 'Read');
    manager.incrementIterations();
    manager.step('data_write', 'Write');
    manager.pop();

    // Finish main protocol
    manager.step('main_exit', 'Exit');
    manager.pop();

    // Verify final state
    expect(manager.isEmpty()).toBe(true);
    expect(manager.getState().totalSteps).toBe(7);

    // Verify event sequence
    expect(events.filter(e => e.type === 'frame-push')).toHaveLength(3);
    expect(events.filter(e => e.type === 'frame-pop')).toHaveLength(3);
    expect(events.filter(e => e.type === 'frame-step')).toHaveLength(7);
  });

  it('should handle error recovery scenario', () => {
    const manager = createCallStackManager({ maxDepth: 3 });

    // Build up to max depth
    manager.push(createRecursionFrame('Loop1'));
    manager.push(createRecursionFrame('Loop2'));
    manager.push(createRecursionFrame('Loop3'));

    // Try to exceed depth (should fail)
    expect(() => manager.push(createRecursionFrame('Loop4'))).toThrow(StackOverflowError);

    // Stack should still be valid
    expect(manager.getDepth()).toBe(3);
    expect(() => manager.step('node1')).not.toThrow();

    // Can pop and continue
    manager.pop();
    expect(manager.getDepth()).toBe(2);

    // Can push again
    const frame = manager.push(createRecursionFrame('Loop4'));
    expect(frame.name).toBe('Loop4');
  });

  it('should handle concurrent event handlers correctly', () => {
    const manager = createCallStackManager();
    const handler1Events: string[] = [];
    const handler2Events: string[] = [];
    const handler3Events: string[] = [];

    manager.on('frame-push', () => handler1Events.push('push'));
    manager.on('frame-push', () => handler2Events.push('push'));
    manager.on('frame-step', () => handler3Events.push('step'));

    manager.push(createRecursionFrame('Loop'));
    manager.step('node1');
    manager.step('node2');

    expect(handler1Events).toEqual(['push']);
    expect(handler2Events).toEqual(['push']);
    expect(handler3Events).toEqual(['step', 'step']);
  });
});
