/**
 * CFSM Executor Tests
 *
 * Tests for the pure execution engine (CFSMExecutor)
 * Focuses on autonomous concurrent execution without debugging features
 */

import { describe, it, expect } from 'vitest';
import { CFSMExecutor } from '../cfsm-executor';
import { createChannel } from '../channel';
import type { CFSM, SendAction, ReceiveAction } from '../../projection/types';

describe('CFSMExecutor - Basic Operations', () => {
  it('should initialize at initial state', () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
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

    const executor = new CFSMExecutor(cfsm);
    const state = executor.getState();

    expect(state.currentState).toBe('s0');
    expect(state.completed).toBe(false);
    expect(state.stepCount).toBe(0);
  });

  it('should execute send action via channel', async () => {
    const cfsm: CFSM = {
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

    const [channelA, channelB] = createChannel();
    const channels = new Map([['B', channelA]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    // Track events
    const events: string[] = [];
    executor.on('send', () => events.push('send'));
    executor.on('complete', () => events.push('complete'));

    await executor.step();

    expect(executor.isComplete()).toBe(true);
    expect(events).toContain('send');
    expect(events).toContain('complete');

    // Verify message sent to channel
    expect(channelB.hasMessage()).toBe(true);
    const msg = await channelB.receive();
    expect(msg.from).toBe('A');
    expect(msg.to).toBe('B');
    expect(msg.label).toBe('Hello');
  });

  it('should execute receive action with natural blocking', async () => {
    const cfsm: CFSM = {
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

    const [channelA, channelB] = createChannel();
    const channels = new Map([['A', channelB]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    // Send message before receive
    await channelA.send({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'Hello',
      timestamp: Date.now(),
    });

    const events: string[] = [];
    executor.on('receive', () => events.push('receive'));

    await executor.step();

    expect(executor.isComplete()).toBe(true);
    expect(events).toContain('receive');
  });

  it('should execute tau action', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const executor = new CFSMExecutor(cfsm);
    const events: string[] = [];
    executor.on('tau', () => events.push('tau'));

    await executor.step();

    expect(executor.isComplete()).toBe(true);
    expect(events).toContain('tau');
  });

  it('should execute choice action', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'choice', branch: 'left' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const executor = new CFSMExecutor(cfsm);
    const choiceBranches: string[] = [];
    executor.on('choice', (data) => choiceBranches.push(data.branch));

    await executor.step();

    expect(executor.isComplete()).toBe(true);
    expect(choiceBranches).toEqual(['left']);
  });
});

describe('CFSMExecutor - Autonomous Execution', () => {
  it('should run to completion autonomously', async () => {
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

    const [channelA, _] = createChannel();
    const channels = new Map([['B', channelA]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    await executor.run();

    expect(executor.isComplete()).toBe(true);
    expect(executor.getState().stepCount).toBe(2);
  });

  it('should emit action events during autonomous execution', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const executor = new CFSMExecutor(cfsm);
    const tauEvents: any[] = [];
    const completeEvents: any[] = [];
    executor.on('tau', (data) => tauEvents.push(data));
    executor.on('complete', (data) => completeEvents.push(data));

    await executor.run();

    // Executor emits action-specific events (tau, send, receive)
    // not 'ready' events (those are for debugger/coordinator)
    expect(tauEvents).toHaveLength(1);
    expect(tauEvents[0].from).toBe('s0');
    expect(tauEvents[0].to).toBe('s1');
    expect(completeEvents).toHaveLength(1);
  });

  it('should stop at maxSteps', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's0', // Infinite loop
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: [],
    };

    const executor = new CFSMExecutor(cfsm, { maxSteps: 5 });
    const maxStepsReached: boolean[] = [];
    executor.on('max-steps-reached', () => maxStepsReached.push(true));

    await executor.run();

    expect(executor.getState().stepCount).toBe(5);
    expect(maxStepsReached).toEqual([true]);
  });
});

describe('CFSMExecutor - Concurrent Coordination', () => {
  it('should block on receive until message arrives', async () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'receive', from: 'A', label: 'Msg' } as ReceiveAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const [channelA, channelB] = createChannel();
    const channels = new Map([['A', channelB]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    // Start execution (will block on receive)
    const runPromise = executor.run();

    // Give executor time to reach blocking receive
    await new Promise(resolve => setTimeout(resolve, 10));

    // Executor should not be complete yet
    expect(executor.isComplete()).toBe(false);

    // Send message to unblock
    await channelA.send({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'Msg',
      timestamp: Date.now(),
    });

    // Wait for execution to complete
    await runPromise;

    expect(executor.isComplete()).toBe(true);
  });

  it('should execute send without blocking', async () => {
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

    const [channelA, channelB] = createChannel();
    const channels = new Map([['B', channelA]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    // Both sends should complete without blocking
    await executor.run();

    expect(executor.isComplete()).toBe(true);

    // Both messages should be in channel queue
    const msg1 = await channelB.receive();
    expect(msg1.label).toBe('M1');
    const msg2 = await channelB.receive();
    expect(msg2.label).toBe('M2');
  });
});

describe('CFSMExecutor - Event-Driven Coordination', () => {
  it('should emit events for coordinator observation', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'send', to: 'B', label: 'Hello' } as SendAction,
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

    const [channelA, _] = createChannel();
    const channels = new Map([['B', channelA]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    const events: string[] = [];
    executor.on('send', () => events.push('send'));
    executor.on('tau', () => events.push('tau'));
    executor.on('complete', () => events.push('complete'));

    await executor.run();

    // Executor emits action events, not 'ready' events (coordinator responsibility)
    expect(events).toEqual(['send', 'tau', 'complete']);
  });

  it('should allow coordinator to observe without controlling', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const executor = new CFSMExecutor(cfsm);

    // Coordinator observes execution via action events
    const observations: any[] = [];
    executor.on('tau', (data) => observations.push({ event: 'tau', ...data }));
    executor.on('complete', () => observations.push({ event: 'complete' }));

    // Executor runs autonomously
    await executor.run();

    // Coordinator received observations of action events
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.map(o => o.event)).toContain('tau');
    expect(observations.map(o => o.event)).toContain('complete');
  });
});

describe('CFSMExecutor - Sequential Mode', () => {
  it('should filter enabled transitions by message availability in sequential mode', async () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'receive', from: 'A', label: 'Msg' } as ReceiveAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const [channelA, channelB] = createChannel();
    const channels = new Map([['A', channelB]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    // No message → no enabled transitions (hasMessage() check)
    let enabled = executor.getEnabledTransitions();
    expect(enabled).toHaveLength(0);

    // After message delivery → transition enabled
    // Send from channelA (so it arrives in channelB's inbox)
    await channelA.send({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'Msg',
      timestamp: Date.now(),
    });

    enabled = executor.getEnabledTransitions();
    expect(enabled).toHaveLength(1);
  });

  it('should use step() for sequential stepping', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'tau' },
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

    const executor = new CFSMExecutor(cfsm);

    expect(executor.getState().currentState).toBe('s0');

    await executor.step();
    expect(executor.getState().currentState).toBe('s1');
    expect(executor.isComplete()).toBe(false);

    await executor.step();
    expect(executor.getState().currentState).toBe('s2');
    expect(executor.isComplete()).toBe(true);
  });
});

describe('CFSMExecutor - Error Handling', () => {
  it('should emit error when no transition from non-terminal state', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [],
      initialState: 's0',
      terminalStates: ['s1'], // s0 is NOT terminal
    };

    const executor = new CFSMExecutor(cfsm);
    const errors: any[] = [];
    executor.on('error', (data) => errors.push(data));

    await executor.run();

    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('no-transition');
  });

  it('should throw on step when already completed', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const executor = new CFSMExecutor(cfsm);
    await executor.step();
    expect(executor.isComplete()).toBe(true);

    await expect(executor.step()).rejects.toThrow('Already completed');
  });

  it('should verify message label matches expected', async () => {
    const cfsm: CFSM = {
      role: 'B',
      states: [{ id: 's0' }, { id: 's1' }],
      transitions: [
        {
          id: 't0',
          from: 's0',
          to: 's1',
          action: { type: 'receive', from: 'A', label: 'Expected' } as ReceiveAction,
        },
      ],
      initialState: 's0',
      terminalStates: ['s1'],
    };

    const [channelA, channelB] = createChannel();
    const channels = new Map([['A', channelB]]);
    const executor = new CFSMExecutor(cfsm, { channels });

    // Send wrong message
    await channelA.send({
      id: 'msg1',
      from: 'A',
      to: 'B',
      label: 'WrongLabel',
      timestamp: Date.now(),
    });

    await expect(executor.run()).rejects.toThrow('Protocol violation');
  });
});
