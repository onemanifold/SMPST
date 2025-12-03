/**
 * Distributed Simulator Tests
 *
 * Tests multi-role coordination and distributed execution
 * 
 * NOTE: Actions must use the enriched CFSM schema with message: Message objects.
 * See: src/core/projection/types.ts for SendAction and ReceiveAction specifications.
 */

import { describe, it, expect } from 'vitest';
import { DistributedSimulator } from './distributed-simulator';
import type { CFSM, SendAction, ReceiveAction } from '../projection/types';

// ============================================================================
// Test Helpers - Build actions conforming to enriched CFSM schema
// ============================================================================

/**
 * Create a SendAction with proper message object per specification.
 * SendAction.message is REQUIRED per projection/types.ts
 */
function sendAction(to: string, label: string): SendAction {
  return {
    type: 'send',
    to,
    message: { type: 'Message', label },
  };
}

/**
 * Create a ReceiveAction with proper message object per specification.
 * ReceiveAction.message is REQUIRED per projection/types.ts
 */
function receiveAction(from: string, label: string): ReceiveAction {
  return {
    type: 'receive',
    from,
    message: { type: 'Message', label },
  };
}

describe('Distributed Simulator - Basic Coordination', () => {
  it('should coordinate two roles with message passing', async () => {
    // Protocol: A -> B: Hello
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'Hello'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'Hello'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms, { recordTrace: true });

    // Run to completion
    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBe(2); // A sends, B receives
    expect(dist.isComplete()).toBe(true);

    // Check traces
    const traces = result.traces!;
    expect(traces.get('A')?.events).toHaveLength(1);
    expect(traces.get('A')?.events[0].type).toBe('send');
    expect(traces.get('B')?.events).toHaveLength(1);
    expect(traces.get('B')?.events[0].type).toBe('receive');
  });

  it('should handle ping-pong protocol', async () => {
    // Protocol: A -> B: Ping, B -> A: Pong
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'Ping'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: receiveAction('B', 'Pong'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'Ping'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: sendAction('A', 'Pong'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms);

    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBeGreaterThanOrEqual(2);
    expect(dist.isComplete()).toBe(true);

    // Both roles should complete
    const traces = result.traces!;
    expect(traces.get('A')?.completed).toBe(true);
    expect(traces.get('B')?.completed).toBe(true);
  });

  it('should handle three-role protocol', async () => {
    // Protocol: A -> B: M1, B -> C: M2, C -> A: M3
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'M1'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: receiveAction('C', 'M3'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'M1'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: sendAction('C', 'M2'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsmC: CFSM = {
      role: 'C',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('B', 'M2'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: sendAction('A', 'M3'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
      ['C', cfsmC],
    ]);
    const dist = new DistributedSimulator(cfsms);

    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(dist.isComplete()).toBe(true);

    // All three roles should complete
    const traces = result.traces!;
    expect(traces.get('A')?.completed).toBe(true);
    expect(traces.get('B')?.completed).toBe(true);
    expect(traces.get('C')?.completed).toBe(true);
  });
});

describe('Distributed Simulator - Deadlock Detection', () => {
  it('should detect circular wait deadlock', async () => {
    // A waits for B, B waits for A → deadlock
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('B', 'MsgFromB'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'MsgFromA'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms);

    const result = await dist.run();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('deadlock');
    expect(dist.isDeadlocked()).toBe(true);
  });

  it('should NOT deadlock when protocol is correct', async () => {
    // Correct: A sends first, then B sends
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'Start'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: receiveAction('B', 'Reply'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'Start'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: sendAction('A', 'Reply'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms);

    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(dist.isDeadlocked()).toBe(false);
    expect(dist.isComplete()).toBe(true);
  });
});

describe('Distributed Simulator - Scheduling Strategies', () => {
  it('should use round-robin scheduling', async () => {
    // Both roles can send independently
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'FromA'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('A', 'FromB'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms, { schedulingStrategy: 'round-robin' });

    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBe(2);
  });

  it('should use fair scheduling', async () => {
    // Both roles can send independently
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'FromA'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('A', 'FromB'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms, { schedulingStrategy: 'fair', recordTrace: true });

    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBe(2);

    // Both roles should have executed once
    const traces = result.traces!;
    expect(traces.get('A')?.events).toHaveLength(1);
    expect(traces.get('B')?.events).toHaveLength(1);
  });
});

describe('Distributed Simulator - Message Buffering', () => {
  it('should buffer messages until consumed', async () => {
    // A sends two messages before B receives
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'M1'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: sendAction('B', 'M2'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'M1'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: receiveAction('A', 'M2'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms, { recordTrace: true });

    const result = await dist.run();

    expect(result.success).toBe(true);
    expect(dist.isComplete()).toBe(true);

    // Traces should show all sends and receives
    const traces = result.traces!;
    const aEvents = traces.get('A')?.events.filter(e => e.type === 'send');
    const bEvents = traces.get('B')?.events.filter(e => e.type === 'receive');

    expect(aEvents).toHaveLength(2);
    expect(bEvents).toHaveLength(2);
  });

  it('should enforce FIFO order across distributed execution', async () => {
    // A sends M1, M2 in order. B must receive in same order.
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'First'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: sendAction('B', 'Second'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'First'),
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: receiveAction('A', 'Second'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms, { deliveryModel: 'fifo', recordTrace: true });

    const result = await dist.run();

    expect(result.success).toBe(true);

    // Check order in trace
    const bTrace = result.traces!.get('B')!;
    const receiveEvents = bTrace.events.filter(e => e.type === 'receive');

    expect(receiveEvents[0]).toMatchObject({ type: 'receive', from: 'A', label: 'First' });
    expect(receiveEvents[1]).toMatchObject({ type: 'receive', from: 'A', label: 'Second' });
  });
});

describe('Distributed Simulator - Reset and State', () => {
  it('should support reset to initial state', async () => {
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'M'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'M'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms);

    // Run once
    await dist.run();
    expect(dist.isComplete()).toBe(true);

    // Reset
    dist.reset();

    // Should be back at initial state
    const state = dist.getState();
    expect(state.globalSteps).toBe(0);
    expect(state.roleStates.get('A')).toBe('s0');
    expect(state.roleStates.get('B')).toBe('s0');
    expect(dist.isComplete()).toBe(false);

    // Can run again
    const result2 = await dist.run();
    expect(result2.success).toBe(true);
  });

  it('should provide detailed execution state', async () => {
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: sendAction('B', 'M'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsmB: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: receiveAction('A', 'M'),
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const cfsms = new Map([
      ['A', cfsmA],
      ['B', cfsmB],
    ]);
    const dist = new DistributedSimulator(cfsms);

    // After first step (A sends)
    await dist.step();
    let state = dist.getState();

    expect(state.roleStates.get('A')).toBe('s1'); // A completed
    expect(state.roleStates.get('B')).toBe('s0'); // B not yet
    expect(state.globalSteps).toBe(1);
    expect(state.allCompleted).toBe(false);
    expect(state.anyCompleted).toBe(true);

    // After second step (B receives)
    await dist.step();
    state = dist.getState();

    expect(state.roleStates.get('B')).toBe('s1'); // B completed
    expect(state.allCompleted).toBe(true);
  });
});
