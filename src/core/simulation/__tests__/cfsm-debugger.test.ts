/**
 * CFSM Debugger Tests
 *
 * Tests for the time-travel debugging wrapper (CFSMDebugger)
 * Focuses on debugging features without polluting the pure executor
 */

import { describe, it, expect } from 'vitest';
import { CFSMDebugger } from '../cfsm-debugger';
import { createChannel } from '../channel';
import type { CFSM, SendAction } from '../../projection/types';

describe('CFSMDebugger - Time-Travel Debugging', () => {
  it('should record snapshots during execution', async () => {
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
    const cfsmDebugger = new CFSMDebugger(cfsm, { channels, recordTrace: true });

    await cfsmDebugger.stepForward();
    await cfsmDebugger.stepForward();

    const snapshots = cfsmDebugger.getSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('should step forward and track step numbers', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm);

    expect(cfsmDebugger.getCurrentStepNumber()).toBe(0);

    await cfsmDebugger.stepForward();

    expect(cfsmDebugger.getCurrentStepNumber()).toBe(1);
  });

  it('should step backward and track step numbers', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm);

    await cfsmDebugger.stepForward();
    await cfsmDebugger.stepForward();
    expect(cfsmDebugger.getCurrentStepNumber()).toBe(2);

    // Step backward changes step number (note: state restoration not yet implemented)
    cfsmDebugger.stepBackward();
    expect(cfsmDebugger.getCurrentStepNumber()).toBe(1);
  });

  it('should throw when stepping backward at initial state', () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm);

    expect(() => cfsmDebugger.stepBackward()).toThrow('Already at initial state');
  });

  it('should track snapshots during execution', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [{ id: 's0' }, { id: 's1' }, { id: 's2' }, { id: 's3' }],
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
        {
          id: 't2',
          from: 's2',
          to: 's3',
          action: { type: 'tau' },
        },
      ],
      initialState: 's0',
      terminalStates: ['s3'],
    };

    const cfsmDebugger = new CFSMDebugger(cfsm);

    // Move forward to step 2
    await cfsmDebugger.stepForward();
    await cfsmDebugger.stepForward();

    // Move forward more
    await cfsmDebugger.stepForward();
    expect(cfsmDebugger.getCurrentStepNumber()).toBe(3);

    // Should have recorded snapshots
    const snapshots = cfsmDebugger.getSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);

    // Step backward changes step number
    cfsmDebugger.stepBackward();
    expect(cfsmDebugger.getCurrentStepNumber()).toBe(2);
  });
});

describe('CFSMDebugger - Event Annotation', () => {
  it('should annotate executor events with step numbers', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm, { recordTrace: true });

    const events: any[] = [];
    cfsmDebugger.on('tau', (event) => events.push(event));

    await cfsmDebugger.stepForward();

    expect(events).toHaveLength(1);
    expect(events[0].stepNumber).toBe(1);
    expect(events[0].timestamp).toBeDefined();
  });

  it('should record trace of all events', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm, { recordTrace: true });

    await cfsmDebugger.stepForward();
    await cfsmDebugger.stepForward();

    const trace = cfsmDebugger.getEventTrace();
    expect(trace.length).toBeGreaterThanOrEqual(2);
    expect(trace.map(e => e.type)).toContain('tau');
  });
});

describe('CFSMDebugger - Autonomous Run with Snapshots', () => {
  it('should record periodic snapshots during run()', async () => {
    const cfsm: CFSM = {
      role: 'A',
      states: [
        { id: 's0' },
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
        { id: 's4' },
        { id: 's5' },
      ],
      transitions: [
        { id: 't0', from: 's0', to: 's1', action: { type: 'tau' } },
        { id: 't1', from: 's1', to: 's2', action: { type: 'tau' } },
        { id: 't2', from: 's2', to: 's3', action: { type: 'tau' } },
        { id: 't3', from: 's3', to: 's4', action: { type: 'tau' } },
        { id: 't4', from: 's4', to: 's5', action: { type: 'tau' } },
      ],
      initialState: 's0',
      terminalStates: ['s5'],
    };

    const cfsmDebugger = new CFSMDebugger(cfsm, { recordTrace: true });

    await cfsmDebugger.run();

    const snapshots = cfsmDebugger.getSnapshots();
    // Should have initial + final snapshots at minimum
    expect(snapshots.length).toBeGreaterThan(0);
  });

  it('should complete run() and allow inspection afterward', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm, { recordTrace: true });

    await cfsmDebugger.run();

    expect(cfsmDebugger.isComplete()).toBe(true);
    expect(cfsmDebugger.getState().currentState).toBe('s1');

    const trace = cfsmDebugger.getEventTrace();
    expect(trace.map(e => e.type)).toContain('complete');
  });
});

describe('CFSMDebugger - Wrapper Transparency', () => {
  it('should not affect executor behavior', async () => {
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
    const cfsmDebugger = new CFSMDebugger(cfsm, { channels });

    await cfsmDebugger.run();

    // Verify executor worked correctly
    expect(cfsmDebugger.isComplete()).toBe(true);

    // Verify messages sent
    const msg1 = await channelB.receive();
    expect(msg1.label).toBe('M1');
    const msg2 = await channelB.receive();
    expect(msg2.label).toBe('M2');
  });

  it('should forward executor events', async () => {
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

    const [channelA, _] = createChannel();
    const channels = new Map([['B', channelA]]);
    const cfsmDebugger = new CFSMDebugger(cfsm, { channels });

    const eventTypes: string[] = [];
    cfsmDebugger.on('send', () => eventTypes.push('send'));
    cfsmDebugger.on('complete', () => eventTypes.push('complete'));

    await cfsmDebugger.stepForward();

    // Note: 'ready' events are only emitted during run(), not step()
    expect(eventTypes).toContain('send');
    expect(eventTypes).toContain('complete');
  });
});

describe('CFSMDebugger - Configuration', () => {
  it('should support maxSteps configuration', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm, { maxSteps: 3 });

    await cfsmDebugger.run();

    expect(cfsmDebugger.getState().stepCount).toBe(3);
  });

  it('should optionally disable trace recording', async () => {
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

    const cfsmDebugger = new CFSMDebugger(cfsm, { recordTrace: false });

    await cfsmDebugger.stepForward();

    const trace = cfsmDebugger.getEventTrace();
    expect(trace).toHaveLength(0);
  });
});
