/**
 * Distributed Simulator Tests
 *
 * Tests multi-role coordination and distributed execution
 */

import { describe, it, expect } from 'vitest';
import { DistributedSimulator } from './distributed-simulator';
import type { CFSM, SendAction, ReceiveAction } from '../projection/types';

describe('Distributed Simulator - Basic Coordination', () => {
  it('should coordinate two roles with message passing', () => {
    // Protocol: A -> B: Hello
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'Hello' } as SendAction,
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
          action: { type: 'receive', from: 'A', label: 'Hello' } as ReceiveAction,
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
    const result = dist.run();

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

  it('should handle ping-pong protocol', () => {
    // Protocol: A -> B: Ping, B -> A: Pong
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'Ping' } as SendAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'receive', from: 'B', label: 'Pong' } as ReceiveAction,
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
          action: { type: 'receive', from: 'A', label: 'Ping' } as ReceiveAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'send', to: 'A', label: 'Pong' } as SendAction,
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

    const result = dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBeGreaterThanOrEqual(2);
    expect(dist.isComplete()).toBe(true);

    // Both roles should complete
    const traces = result.traces!;
    expect(traces.get('A')?.completed).toBe(true);
    expect(traces.get('B')?.completed).toBe(true);
  });

  it('should handle three-role protocol', () => {
    // Protocol: A -> B: M1, B -> C: M2, C -> A: M3
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'M1' } as SendAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'receive', from: 'C', label: 'M3' } as ReceiveAction,
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
          action: { type: 'receive', from: 'A', label: 'M1' } as ReceiveAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'send', to: 'C', label: 'M2' } as SendAction,
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
          action: { type: 'receive', from: 'B', label: 'M2' } as ReceiveAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'send', to: 'A', label: 'M3' } as SendAction,
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

    const result = dist.run();

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
  it('should detect circular wait deadlock', () => {
    // A waits for B, B waits for A → deadlock
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'receive', from: 'B', label: 'MsgFromB' } as ReceiveAction,
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
          action: { type: 'receive', from: 'A', label: 'MsgFromA' } as ReceiveAction,
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

    const result = dist.run();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('deadlock');
    expect(dist.isDeadlocked()).toBe(true);
  });

  it('should NOT deadlock when protocol is correct', () => {
    // Correct: A sends first, then B sends
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'Start' } as SendAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'receive', from: 'B', label: 'Reply' } as ReceiveAction,
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
          action: { type: 'receive', from: 'A', label: 'Start' } as ReceiveAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'send', to: 'A', label: 'Reply' } as SendAction,
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

    const result = dist.run();

    expect(result.success).toBe(true);
    expect(dist.isDeadlocked()).toBe(false);
    expect(dist.isComplete()).toBe(true);
  });
});

describe('Distributed Simulator - Scheduling Strategies', () => {
  it('should use round-robin scheduling', () => {
    // Both roles can send independently
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'FromA' } as SendAction,
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
          action: { type: 'send', to: 'A', label: 'FromB' } as SendAction,
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

    const result = dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBe(2);
  });

  it('should use fair scheduling', () => {
    // Both roles can send independently
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'FromA' } as SendAction,
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
          action: { type: 'send', to: 'A', label: 'FromB' } as SendAction,
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

    const result = dist.run();

    expect(result.success).toBe(true);
    expect(result.globalSteps).toBe(2);

    // Both roles should have executed once
    const traces = result.traces!;
    expect(traces.get('A')?.events).toHaveLength(1);
    expect(traces.get('B')?.events).toHaveLength(1);
  });
});

describe('Distributed Simulator - Message Buffering', () => {
  it('should buffer messages until consumed', () => {
    // A sends two messages before B receives
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'M1' } as SendAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'send', to: 'B', label: 'M2' } as SendAction,
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
          action: { type: 'receive', from: 'A', label: 'M1' } as ReceiveAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'receive', from: 'A', label: 'M2' } as ReceiveAction,
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

    const result = dist.run();

    expect(result.success).toBe(true);
    expect(dist.isComplete()).toBe(true);

    // Traces should show all sends and receives
    const traces = result.traces!;
    const aEvents = traces.get('A')?.events.filter(e => e.type === 'send');
    const bEvents = traces.get('B')?.events.filter(e => e.type === 'receive');

    expect(aEvents).toHaveLength(2);
    expect(bEvents).toHaveLength(2);
  });

  it('should enforce FIFO order across distributed execution', () => {
    // A sends M1, M2 in order. B must receive in same order.
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'First' } as SendAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'send', to: 'B', label: 'Second' } as SendAction,
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
          action: { type: 'receive', from: 'A', label: 'First' } as ReceiveAction,
        },
        {
          id: 't1',
          from: 's1',
          to: 's2',
          action: { type: 'receive', from: 'A', label: 'Second' } as ReceiveAction,
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

    const result = dist.run();

    expect(result.success).toBe(true);

    // Check order in trace
    const bTrace = result.traces!.get('B')!;
    const receiveEvents = bTrace.events.filter(e => e.type === 'receive');

    expect(receiveEvents[0]).toMatchObject({ type: 'receive', from: 'A', label: 'First' });
    expect(receiveEvents[1]).toMatchObject({ type: 'receive', from: 'A', label: 'Second' });
  });
});

describe('Distributed Simulator - Reset and State', () => {
  it('should support reset to initial state', () => {
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'M' } as SendAction,
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
          action: { type: 'receive', from: 'A', label: 'M' } as ReceiveAction,
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
    dist.run();
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
    const result2 = dist.run();
    expect(result2.success).toBe(true);
  });

  it('should provide detailed execution state', () => {
    const cfsmA: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'M' } as SendAction,
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
          action: { type: 'receive', from: 'A', label: 'M' } as ReceiveAction,
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
    dist.step();
    let state = dist.getState();

    expect(state.roleStates.get('A')).toBe('s1'); // A completed
    expect(state.roleStates.get('B')).toBe('s0'); // B not yet
    expect(state.globalSteps).toBe(1);
    expect(state.allCompleted).toBe(false);
    expect(state.anyCompleted).toBe(true);

    // After second step (B receives)
    dist.step();
    state = dist.getState();

    expect(state.roleStates.get('B')).toBe('s1'); // B completed
    expect(state.allCompleted).toBe(true);
  });
});
