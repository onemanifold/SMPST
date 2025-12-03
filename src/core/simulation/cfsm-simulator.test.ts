/**
 * CFSM Simulator Tests
 *
 * Tests single-role CFSM execution with formal correctness properties
 * 
 * NOTE: Actions must use the enriched CFSM schema with message: Message objects.
 * See: src/core/projection/types.ts for SendAction and ReceiveAction specifications.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CFSMSimulator } from './cfsm-simulator';
import type { CFSM, CFSMTransition, SendAction, ReceiveAction } from '../projection/types';
import type { Message } from './cfsm-simulator-types';

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
          action: sendAction('B', 'M1'),
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

  it('should execute send action (always enabled)', async () => {
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
          action: sendAction('B', 'Hello'),
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
    const result = await sim.step();

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

  it('should execute receive action when message in buffer', async () => {
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
          action: receiveAction('A', 'Hello'),
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
    const result = await sim.step();

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
          action: receiveAction('A', 'M1'),
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
          action: sendAction('B', 'M1'),
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
          action: receiveAction('A', 'M1'),
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
          action: sendAction('B', 'Done'),
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
          action: sendAction('B', 'Test'),
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
          action: receiveAction('A', 'M'),
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
          action: sendAction('B', 'M1'),
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

describe('CFSM Simulator - Stepping Debugger', () => {
  describe('stepForward and stepBackward', () => {
    it('should step forward and record snapshots', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      sim.enableHistory();

      expect(sim.getState().stepCount).toBe(0);

      const result1 = await sim.stepForward();
      expect(result1.success).toBe(true);
      expect(sim.getState().stepCount).toBe(1);
      expect(sim.getState().currentState).toBe('s1');

      const result2 = await sim.stepForward();
      expect(result2.success).toBe(true);
      expect(sim.getState().stepCount).toBe(2);
      expect(sim.getState().currentState).toBe('s2');

      // Verify history has snapshots
      const history = sim.getExecutionHistory();
      const snapshots = history.getAllSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it('should step backward and restore previous state', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      sim.enableHistory();

      await sim.stepForward();
      const stateAtStep1 = sim.getState();

      await sim.stepForward();
      expect(sim.getState().currentState).toBe('s2');

      // Step backward
      const backResult = sim.stepBackward();
      expect(backResult.success).toBe(true);
      expect(sim.getState().currentState).toBe(stateAtStep1.currentState);
      expect(sim.getState().stepCount).toBe(stateAtStep1.stepCount);
    });

    it('should fail to step backward when no history available', () => {
      const cfsm: CFSM = {
        role: 'A',
        states: [{ id: 's0' }, { id: 's1' }],
        transitions: [
          {
            id: 't0',
            from: 's0',
            to: 's1',
            action: sendAction('B', 'M1'),
          },
        ],
        initialState: 's0',
        terminalStates: ['s1'],
      };

      const sim = new CFSMSimulator(cfsm);
      // History disabled by default

      const result = sim.stepBackward();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No previous state');
    });
  });

  describe('stepInto', () => {
    it('should step into and record snapshot', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      sim.enableHistory();

      const result = await sim.stepInto();

      expect(result.success).toBe(true);
      expect(sim.getState().currentState).toBe('s1');
      expect(sim.getState().stepCount).toBe(1);
    });

    it('should fail stepInto when already completed', async () => {
      const cfsm: CFSM = {
        role: 'A',
        states: [{ id: 's0' }, { id: 's1' }],
        transitions: [
          {
            id: 't0',
            from: 's0',
            to: 's1',
            action: sendAction('B', 'Done'),
          },
        ],
        initialState: 's0',
        terminalStates: ['s1'],
      };

      const sim = new CFSMSimulator(cfsm);
      await sim.run();
      expect(sim.isComplete()).toBe(true);

      const result = await sim.stepInto();
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid-state');
      expect(result.error?.message).toContain('already completed');
    });

    it('should emit step-into event on success', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      let eventEmitted = false;
      let eventData: any = null;

      sim.on('step-into', (data) => {
        eventEmitted = true;
        eventData = data;
      });

      await sim.stepInto();

      expect(eventEmitted).toBe(true);
      expect(eventData.stepCount).toBe(1);
      expect(eventData.depth).toBeDefined();
    });

    it('should NOT emit step-into event on failure', async () => {
      const cfsm: CFSM = {
        role: 'A',
        states: [{ id: 's0' }, { id: 's1' }],
        transitions: [
          {
            id: 't0',
            from: 's0',
            to: 's1',
            action: sendAction('B', 'Done'),
          },
        ],
        initialState: 's0',
        terminalStates: ['s1'],
      };

      const sim = new CFSMSimulator(cfsm);
      await sim.run();

      let eventEmitted = false;
      sim.on('step-into', () => {
        eventEmitted = true;
      });

      await sim.stepInto();
      expect(eventEmitted).toBe(false);
    });
  });

  describe('stepOver', () => {
    it('should step over and record snapshot', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      sim.enableHistory();

      const result = await sim.stepOver();

      expect(result.success).toBe(true);
      expect(sim.getState().currentState).toBe('s1');
    });

    it('should fail stepOver when already completed', async () => {
      const cfsm: CFSM = {
        role: 'A',
        states: [{ id: 's0' }, { id: 's1' }],
        transitions: [
          {
            id: 't0',
            from: 's0',
            to: 's1',
            action: sendAction('B', 'Done'),
          },
        ],
        initialState: 's0',
        terminalStates: ['s1'],
      };

      const sim = new CFSMSimulator(cfsm);
      await sim.run();

      const result = await sim.stepOver();
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid-state');
      expect(result.error?.message).toContain('already completed');
    });

    it('should emit step-over event on success', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      let eventEmitted = false;
      let eventData: any = null;

      sim.on('step-over', (data) => {
        eventEmitted = true;
        eventData = data;
      });

      await sim.stepOver();

      expect(eventEmitted).toBe(true);
      expect(eventData.stepCount).toBeDefined();
      expect(eventData.state).toBeDefined();
    });

    it('should NOT emit step-over event on failure', async () => {
      const cfsm: CFSM = {
        role: 'A',
        states: [{ id: 's0' }, { id: 's1' }],
        transitions: [
          {
            id: 't0',
            from: 's0',
            to: 's1',
            action: sendAction('B', 'Done'),
          },
        ],
        initialState: 's0',
        terminalStates: ['s1'],
      };

      const sim = new CFSMSimulator(cfsm);
      await sim.run();

      let eventEmitted = false;
      sim.on('step-over', () => {
        eventEmitted = true;
      });

      await sim.stepOver();
      expect(eventEmitted).toBe(false);
    });
  });

  describe('stepOut', () => {
    it('should fail stepOut when not in sub-protocol', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);

      const result = await sim.stepOut();

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid-state');
      expect(result.error?.message).toContain('Not in a sub-protocol');
    });

    it('should fail stepOut when already completed', async () => {
      const cfsm: CFSM = {
        role: 'A',
        states: [{ id: 's0' }, { id: 's1' }],
        transitions: [
          {
            id: 't0',
            from: 's0',
            to: 's1',
            action: sendAction('B', 'Done'),
          },
        ],
        initialState: 's0',
        terminalStates: ['s1'],
      };

      const sim = new CFSMSimulator(cfsm);
      await sim.run();

      const result = await sim.stepOut();
      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('invalid-state');
      expect(result.error?.message).toContain('already completed');
    });
  });

  describe('getCallStackDepth', () => {
    it('should return 0 when at root level', () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      expect(sim.getCallStackDepth()).toBe(0);
    });
  });

  describe('stepping state reset', () => {
    it('should reset stepping state on reset()', async () => {
      const cfsm: CFSM = {
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

      const sim = new CFSMSimulator(cfsm);
      sim.enableHistory();

      // Take some steps
      await sim.stepForward();
      await sim.stepForward();
      expect(sim.getState().stepCount).toBe(2);

      // Reset
      sim.reset();

      expect(sim.getState().stepCount).toBe(0);
      expect(sim.getState().currentState).toBe('s0');
      expect(sim.getCallStackDepth()).toBe(0);

      // Should be able to step again
      const result = await sim.stepForward();
      expect(result.success).toBe(true);
    });
  });
});
