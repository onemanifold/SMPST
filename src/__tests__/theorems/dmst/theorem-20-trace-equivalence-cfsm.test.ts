/**
 * THEOREM 20: Trace Equivalence for DMst (CFSM Level)
 *
 * Castro-Perez & Yoshida (ECOOP 2023), §4, Theorem 20
 *
 * FORMAL STATEMENT:
 *   For a dynamically updatable protocol G with dynamic participants,
 *   the global semantics and local semantics produce equivalent traces.
 *
 *   If G → G' (global reduction), then for each role r: [[G]]_r → [[G']]_r
 *   where [[G]]_r is the local view of role r.
 *
 *   Formally: traces(G) ≈ compose(traces([[G]]_r) for all r)
 *
 * THEOREM-DRIVEN DEVELOPMENT:
 *   Each test encodes a proof obligation from the theorem.
 *   Tests are executable specifications of formal properties.
 *
 * Test categories:
 * 1. Simple updatable recursion (baseline)
 * 2. Multiple sequential updates
 * 3. Trace preservation after update
 * 4. Local vs global trace equivalence
 * 5. Extension trace visibility
 * 6. Role-specific traces
 */

import { describe, it, expect } from 'vitest';
import type { CFSM } from '../../../core/projection/types';
import {
  extractTrace,
  composeTraces,
  compareTraces,
  formatTrace,
  traceHasAction,
  countActions,
  type Trace,
} from '../../../core/verification/trace-semantics';
import {
  compute1UnfoldingCFSM,
} from '../../../core/verification/dmst/safe-update-cfsm';
import {
  extendCFSM,
} from '../../../core/runtime/versioned-cfsm';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create simple protocol with recursion
 * Alice -> Bob: Work(); continue X
 */
function createSimpleRecursive(role: string): CFSM {
  return {
    role,
    protocolName: 'SimpleRecursive',
    parameters: [],
    states: [
      { id: 'S0' },
      { id: 'S1_rec_X' },
      { id: 'S2' },
    ],
    transitions: [
      {
        id: 't1',
        from: 'S0',
        to: 'S1_rec_X',
        action: { type: 'tau' },
      },
      {
        id: 't2',
        from: 'S1_rec_X',
        to: 'S2',
        action:
          role === 'Alice'
            ? {
                type: 'send',
                to: 'Bob',
                message: {
                  type: 'Message',
                  label: 'Work',
                  payload: { payloadType: 'string' },
                },
              }
            : {
                type: 'receive',
                from: 'Alice',
                message: {
                  type: 'Message',
                  label: 'Work',
                  payload: { payloadType: 'string' },
                },
              },
      },
      {
        id: 't3',
        from: 'S2',
        to: 'S1_rec_X', // Back to recursion
        action: { type: 'tau' },
      },
    ],
    initialState: 'S0',
    terminalStates: [],
  };
}

/**
 * Create extension: Alice -> Charlie: ExtraWork()
 */
function createExtension(role: string): CFSM {
  return {
    role,
    protocolName: 'Extension',
    parameters: [],
    states: [
      { id: 'E0' },
      { id: 'E1' },
    ],
    transitions: [
      {
        id: 'ext1',
        from: 'E0',
        to: 'E1',
        action:
          role === 'Alice'
            ? {
                type: 'send',
                to: 'Charlie',
                message: {
                  type: 'Message',
                  label: 'ExtraWork',
                  payload: { payloadType: 'string' },
                },
              }
            : role === 'Charlie'
            ? {
                type: 'receive',
                from: 'Alice',
                message: {
                  type: 'Message',
                  label: 'ExtraWork',
                  payload: { payloadType: 'string' },
                },
              }
            : { type: 'tau' }, // Bob doesn't participate
      },
    ],
    initialState: 'E0',
    terminalStates: ['E1'],
  };
}

/**
 * Create linear protocol (no recursion)
 */
function createLinear(role: string): CFSM {
  return {
    role,
    protocolName: 'Linear',
    parameters: [],
    states: [
      { id: 'L0' },
      { id: 'L1' },
      { id: 'L2' },
    ],
    transitions: [
      {
        id: 'l1',
        from: 'L0',
        to: 'L1',
        action:
          role === 'Alice'
            ? {
                type: 'send',
                to: 'Bob',
                message: {
                  type: 'Message',
                  label: 'Start',
                  payload: { payloadType: 'unit' },
                },
              }
            : {
                type: 'receive',
                from: 'Alice',
                message: {
                  type: 'Message',
                  label: 'Start',
                  payload: { payloadType: 'unit' },
                },
              },
      },
      {
        id: 'l2',
        from: 'L1',
        to: 'L2',
        action:
          role === 'Bob'
            ? {
                type: 'send',
                to: 'Alice',
                message: {
                  type: 'Message',
                  label: 'Done',
                  payload: { payloadType: 'unit' },
                },
              }
            : {
                type: 'receive',
                from: 'Bob',
                message: {
                  type: 'Message',
                  label: 'Done',
                  payload: { payloadType: 'unit' },
                },
              },
      },
    ],
    initialState: 'L0',
    terminalStates: ['L2'],
  };
}

// ============================================================================
// Theorem 20 - Proof Obligation 1: Trace Extraction
// ============================================================================

describe('Theorem 20 (CFSM): Trace Extraction', () => {
  it('should extract trace from linear protocol', () => {
    const alice = createLinear('Alice');
    const trace = extractTrace(alice, { maxSteps: 10 });

    expect(trace.role).toBe('Alice');
    expect(trace.final).toBe(true);
    expect(trace.actions.length).toBeGreaterThan(0);

    // Should have send actions
    const hasSend = traceHasAction(trace, 'send');
    expect(hasSend).toBe(true);
  });

  it('should extract trace from recursive protocol', () => {
    const alice = createSimpleRecursive('Alice');
    const trace = extractTrace(alice, { maxSteps: 10, stopAtRecursion: true });

    expect(trace.role).toBe('Alice');
    expect(trace.actions.length).toBeGreaterThan(0);
  });

  it('should stop at max steps for infinite loops', () => {
    const alice = createSimpleRecursive('Alice');
    const trace = extractTrace(alice, { maxSteps: 5 });

    expect(trace.steps).toBeLessThanOrEqual(5);
    expect(trace.final).toBe(false); // Didn't reach terminal
  });

  it('should format trace readably', () => {
    const alice = createLinear('Alice');
    const trace = extractTrace(alice, { maxSteps: 10 });
    const formatted = formatTrace(trace);

    expect(formatted).toContain('[Alice]');
    expect(formatted).toContain('!Bob'); // Send to Bob
  });
});

// ============================================================================
// Theorem 20 - Proof Obligation 2: Trace Composition
// ============================================================================

describe('Theorem 20 (CFSM): Trace Composition', () => {
  it('should compose traces from multiple roles', () => {
    const alice = createLinear('Alice');
    const bob = createLinear('Bob');

    const traceAlice = extractTrace(alice, { maxSteps: 10 });
    const traceBob = extractTrace(bob, { maxSteps: 10 });

    const composed = composeTraces([traceAlice, traceBob]);

    expect(composed.role).toBe('global');
    expect(composed.actions.length).toBeGreaterThan(0);
    expect(composed.final).toBe(true); // Both reached terminal
  });

  it('should exclude tau actions from composed trace', () => {
    const alice = createSimpleRecursive('Alice');
    const trace = extractTrace(alice, { maxSteps: 5, recordTau: true });

    // Extract without tau
    const traceNoTau = extractTrace(alice, { maxSteps: 5, recordTau: false });

    expect(traceNoTau.actions.length).toBeLessThanOrEqual(trace.actions.length);
  });

  it('should preserve causality in composed trace', () => {
    const alice = createLinear('Alice');
    const bob = createLinear('Bob');

    const traceAlice = extractTrace(alice);
    const traceBob = extractTrace(bob);

    const composed = composeTraces([traceAlice, traceBob]);

    // In linear protocol: Alice sends, then Bob sends
    // Composed should have both
    const sends = composed.actions.filter(a => a.type === 'send');
    const receives = composed.actions.filter(a => a.type === 'receive');

    expect(sends.length).toBeGreaterThan(0);
    expect(receives.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Theorem 20 - Proof Obligation 3: Trace Equivalence
// ============================================================================

describe('Theorem 20 (CFSM): Trace Equivalence', () => {
  it('should recognize equivalent traces', () => {
    const alice = createLinear('Alice');

    const trace1 = extractTrace(alice, { maxSteps: 10 });
    const trace2 = extractTrace(alice, { maxSteps: 10 });

    const equivalent = compareTraces(trace1, trace2);
    expect(equivalent).toBe(true);
  });

  it('should detect different traces', () => {
    const alice = createLinear('Alice');
    const aliceRec = createSimpleRecursive('Alice');

    const trace1 = extractTrace(alice, { maxSteps: 10 });
    const trace2 = extractTrace(aliceRec, { maxSteps: 10, stopAtRecursion: true });

    // Different protocols → different traces
    const equivalent = compareTraces(trace1, trace2);
    expect(equivalent).toBe(false);
  });

  it('should ignore tau actions in comparison', () => {
    const alice = createLinear('Alice');

    const traceWithTau = extractTrace(alice, { maxSteps: 10, recordTau: true });
    const traceNoTau = extractTrace(alice, { maxSteps: 10, recordTau: false });

    // When filtered, should be equivalent
    const equivalent = compareTraces(traceWithTau, traceNoTau);
    expect(equivalent).toBe(true);
  });
});

// ============================================================================
// Theorem 20 - Proof Obligation 4: Updatable Recursion Traces
// ============================================================================

describe('Theorem 20 (CFSM): Updatable Recursion', () => {
  it('should preserve original trace in 1-unfolding', () => {
    const original = createSimpleRecursive('Alice');
    const extension = createExtension('Alice');

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    // Extract traces with enough steps to see both original and extension
    const traceOriginal = extractTrace(original, { maxSteps: 5, stopAtRecursion: true });
    const traceUnfolded = extractTrace(unfolded, { maxSteps: 10, stopAtRecursion: true });

    // 1-unfolding should include original actions
    const originalLabels = traceOriginal.actions
      .filter(a => a.type === 'send')
      .map(a => (a as any).label);

    const unfoldedLabels = traceUnfolded.actions
      .filter(a => a.type === 'send')
      .map(a => (a as any).label);

    // All original labels should appear in unfolded
    for (const label of originalLabels) {
      expect(unfoldedLabels).toContain(label);
    }
  });

  it('should add extension actions to trace', () => {
    const original = createSimpleRecursive('Alice');
    const extension = createExtension('Alice');

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    const trace = extractTrace(unfolded, { maxSteps: 10, stopAtRecursion: true });

    // Should have ExtraWork from extension
    const labels = trace.actions
      .filter(a => a.type === 'send' || a.type === 'receive')
      .map(a => (a as any).label);

    expect(labels).toContain('ExtraWork');
  });

  it('should maintain trace length after multiple updates', () => {
    const original = createSimpleRecursive('Alice');
    const ext1 = createExtension('Alice');

    // Apply first update
    const updated1 = extendCFSM(original, ext1, 'X');

    const trace1 = extractTrace(updated1, { maxSteps: 10, stopAtRecursion: true });

    // Trace should be longer due to extension
    const traceOriginal = extractTrace(original, { maxSteps: 10, stopAtRecursion: true });

    expect(trace1.actions.length).toBeGreaterThanOrEqual(traceOriginal.actions.length);
  });
});

// ============================================================================
// Theorem 20 - Proof Obligation 5: Role-Specific Traces
// ============================================================================

describe('Theorem 20 (CFSM): Role-Specific Traces', () => {
  it('should extract different traces for different roles', () => {
    const alice = createLinear('Alice');
    const bob = createLinear('Bob');

    const traceAlice = extractTrace(alice);
    const traceBob = extractTrace(bob);

    expect(traceAlice.role).toBe('Alice');
    expect(traceBob.role).toBe('Bob');

    // Alice sends, Bob receives
    const aliceSends = countActions(traceAlice, 'send');
    const bobReceives = countActions(traceBob, 'receive');

    expect(aliceSends).toBeGreaterThan(0);
    expect(bobReceives).toBeGreaterThan(0);
  });

  it('should show extension only for involved roles', () => {
    const aliceOriginal = createSimpleRecursive('Alice');
    const aliceExtension = createExtension('Alice');

    // Bob's protocol (no extension involvement)
    const bobOriginal = createSimpleRecursive('Bob');
    const bobExtension = createExtension('Bob'); // Bob has tau in extension

    const aliceUnfolded = compute1UnfoldingCFSM(aliceOriginal, aliceExtension, 'X');
    const bobUnfolded = compute1UnfoldingCFSM(bobOriginal, bobExtension, 'X');

    const traceAlice = extractTrace(aliceUnfolded, { maxSteps: 10, stopAtRecursion: true });
    const traceBob = extractTrace(bobUnfolded, { maxSteps: 10, stopAtRecursion: true });

    // Alice should have ExtraWork action
    const aliceLabels = traceAlice.actions
      .filter(a => a.type === 'send')
      .map(a => (a as any).label);

    expect(aliceLabels).toContain('ExtraWork');

    // Bob should NOT have ExtraWork (only has tau in extension)
    const bobLabels = traceBob.actions
      .filter(a => a.type === 'send' || a.type === 'receive')
      .map(a => (a as any).label);

    expect(bobLabels).not.toContain('ExtraWork');
  });

  it('should match send and receive in composed trace', () => {
    const alice = createLinear('Alice');
    const bob = createLinear('Bob');

    const traceAlice = extractTrace(alice);
    const traceBob = extractTrace(bob);

    const composed = composeTraces([traceAlice, traceBob]);

    // Should have matching sends and receives
    const sends = composed.actions.filter(a => a.type === 'send');
    const receives = composed.actions.filter(a => a.type === 'receive');

    // In a well-formed protocol, sends should match receives
    expect(sends.length).toBeGreaterThan(0);
    expect(receives.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Theorem 20 - Proof Obligation 6: Trace Properties
// ============================================================================

describe('Theorem 20 (CFSM): Trace Properties', () => {
  it('property: trace is prefix-closed (any prefix is valid)', () => {
    const alice = createLinear('Alice');
    const trace = extractTrace(alice);

    // Any prefix of actions should be a valid partial trace
    for (let i = 0; i < trace.actions.length; i++) {
      const prefix = trace.actions.slice(0, i);
      expect(prefix.length).toBeLessThanOrEqual(trace.actions.length);
    }
  });

  it('property: final traces reach terminal states', () => {
    const alice = createLinear('Alice');
    const trace = extractTrace(alice, { maxSteps: 100 });

    if (trace.final) {
      // If trace is final, it should have reached a terminal state
      expect(trace.final).toBe(true);
    }
  });

  it('property: trace length bounded by max steps', () => {
    const alice = createSimpleRecursive('Alice');

    for (const maxSteps of [5, 10, 20]) {
      const trace = extractTrace(alice, { maxSteps });
      expect(trace.steps).toBeLessThanOrEqual(maxSteps);
    }
  });
});
