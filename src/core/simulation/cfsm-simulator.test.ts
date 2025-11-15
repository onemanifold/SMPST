/**
 * CFSM Simulator Tests
 *
 * Tests single-role CFSM execution with formal correctness properties
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CFSMSimulator } from './cfsm-simulator';
import type { CFSM, CFSMTransition, SendAction, ReceiveAction } from '../projection/types';
import type { Message } from './cfsm-simulator-types';

describe('CFSM Simulator - Basic Operations', () => {
  it('should initialize at initial state', () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [
        { id: 's0', label: 'initial' },
        { id: 's1', label: 'end' },
      ],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'M1' } as SendAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const sim = new CFSMSimulator(cfsm);
    const state = sim.getState();

    expect(state.currentState).toBe('s0');
    expect(state.visitedStates).toEqual(['s0']);
    expect(state.stepCount).toBe(0);
    expect(state.completed).toBe(false);
  });

  it('should execute send action (always enabled)', () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [
        { id: 's0' },
        { id: 's1' },
      ],
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

    const sim = new CFSMSimulator(cfsm);

    // Send always enabled
    const enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].action.type).toBe('send');

    // Execute send
    const result = sim.step();

    expect(result.success).toBe(true);
    expect(result.action?.type).toBe('send');
    expect(sim.getState().currentState).toBe('s1');
    expect(sim.isComplete()).toBe(true);

    // Check outgoing message
    const messages = sim.getOutgoingMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('A');
    expect(messages[0].to).toBe('B');
    expect(messages[0].label).toBe('Hello');
  });

  it('should execute receive action when message in buffer', () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [
        { id: 's0' },
        { id: 's1' },
      ],
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

    const sim = new CFSMSimulator(cfsm);

    // Initially, receive NOT enabled (no message)
    let enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(0);

    // Deliver message
    const msg: Message = {
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'Hello',
      timestamp: Date.now(),
    };
    sim.deliverMessage(msg);

    // Now receive enabled
    enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].action.type).toBe('receive');

    // Execute receive
    const result = sim.step();

    expect(result.success).toBe(true);
    expect(result.action?.type).toBe('receive');
    expect(sim.getState().currentState).toBe('s1');
    expect(sim.isComplete()).toBe(true);

    // Buffer should be empty (channel exists but queue is empty)
    const state = sim.getState();
    const queue = state.buffer.channels.get('A');
    expect(queue).toBeDefined();
    expect(queue).toHaveLength(0);
  });

  it('should enforce FIFO order for messages', () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [
        { id: 's0' },
        { id: 's1' },
        { id: 's2' },
      ],
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

    const sim = new CFSMSimulator(cfsm);

    // Deliver two messages in order
    sim.deliverMessage({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'First',
      timestamp: 1,
    });
    sim.deliverMessage({
      id: 'msg2',
      from: 'A',
      to: 'B',
      label: 'Second',
      timestamp: 2,
    });

    // First transition enabled (matches first message)
    let enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].id).toBe('t0');

    // Execute first receive
    sim.step();
    expect(sim.getState().currentState).toBe('s1');

    // Second transition enabled
    enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].id).toBe('t1');

    // Execute second receive
    sim.step();
    expect(sim.getState().currentState).toBe('s2');
    expect(sim.isComplete()).toBe(true);
  });
});

describe('CFSM Simulator - Transition Enabling', () => {
  it('should only enable receive when message available', () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'receive', from: 'A', label: 'M1' } as ReceiveAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const sim = new CFSMSimulator(cfsm);

    // No message → no enabled transitions
    expect(sim.getEnabledTransitions()).toHaveLength(0);

    // Add wrong message → still not enabled (FIFO blocks)
    sim.deliverMessage({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'WRONG',
      timestamp: 1,
    });
    expect(sim.getEnabledTransitions()).toHaveLength(0);

    // Add correct message behind wrong one → STILL not enabled due to FIFO
    // (WRONG message must be consumed first)
    sim.deliverMessage({
      id: 'msg2',
      from: 'A',
      to: 'B',
      label: 'M1',
      timestamp: 2,
    });
    expect(sim.getEnabledTransitions()).toHaveLength(0); // FIFO ordering

    // Alternative: Test with correct message first
    const sim2 = new CFSMSimulator(cfsm);
    sim2.deliverMessage({
      id: 'msg3',
      from: 'A',
      to: 'B',
      label: 'M1',
      timestamp: 3,
    });
    expect(sim2.getEnabledTransitions()).toHaveLength(1); // Now enabled
  });

  it('should always enable send and tau actions', () => {
    const cfsm: CFSM = {
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
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const sim = new CFSMSimulator(cfsm);

    // Send always enabled
    let enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].action.type).toBe('send');

    sim.step();

    // Tau always enabled
    enabled = sim.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].action.type).toBe('tau');
  });
});

describe('CFSM Simulator - Deadlock Detection', () => {
  it('should detect deadlock when blocked on receive', async () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'receive', from: 'A', label: 'M1' } as ReceiveAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const sim = new CFSMSimulator(cfsm);

    // No message → step fails with no-enabled-transitions
    const result = await sim.step();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('no-enabled-transitions');
    expect(sim.isComplete()).toBe(false);
  });

  it('should complete normally at terminal state', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'Done' } as SendAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const sim = new CFSMSimulator(cfsm);

    await sim.step();

    expect(sim.isComplete()).toBe(true);

    // Further steps should return completed error
    const result = await sim.step();
    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('invalid-state');
  });
});

describe('CFSM Simulator - Event Emission', () => {
  it('should emit send/receive events', () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'Test' } as SendAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const sim = new CFSMSimulator(cfsm);
    const events: string[] = [];

    sim.on('send', () => events.push('send'));
    sim.on('complete', () => events.push('complete'));

    sim.step();

    expect(events).toEqual(['send', 'complete']);
  });

  it('should emit buffer events on message delivery', () => {
    const cfsm: CFSM = {
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

    const sim = new CFSMSimulator(cfsm);
    const events: string[] = [];

    sim.on('buffer-enqueue', () => events.push('enqueue'));
    sim.on('buffer-dequeue', () => events.push('dequeue'));
    sim.on('receive', () => events.push('receive'));

    // Deliver message
    sim.deliverMessage({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'M',
      timestamp: 1,
    });

    expect(events).toContain('enqueue');

    // Receive message
    sim.step();

    expect(events).toContain('dequeue');
    expect(events).toContain('receive');
  });
});

describe('CFSM Simulator - Trace Recording', () => {
  it('should record execution trace', () => {
    const cfsm: CFSM = {
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
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s2'],
    };

    const sim = new CFSMSimulator(cfsm, { recordTrace: true });

    sim.step();
    sim.step();

    const trace = sim.getTrace();

    expect(trace.role).toBe('A');
    expect(trace.events).toHaveLength(2);
    expect(trace.events[0].type).toBe('send');
    expect(trace.events[1].type).toBe('tau');
    expect(trace.completed).toBe(true);
    expect(trace.totalSteps).toBe(2);
  });
});

describe('CFSM Simulator - Run to Completion', () => {
  it('should run simple protocol to completion', async () => {
    const cfsm: CFSM = {
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

    const sim = new CFSMSimulator(cfsm);
    const result = await sim.run();

    expect(result.success).toBe(true);
    expect(result.steps).toBe(2);
    expect(sim.isComplete()).toBe(true);
  });

  it('should stop at maxSteps', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's0', // Self-loop
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const sim = new CFSMSimulator(cfsm, { maxSteps: 10 });
    const result = await sim.run();

    expect(result.success).toBe(false);
    expect(result.error?.type).toBe('max-steps');
    expect(result.steps).toBe(10);
  });
});
