/**
 * Definition 14: Safe Protocol Update - CFSM Level Tests
 *
 * Tests for CFSM-level safe update verification (Phase 1).
 * Complements the CFG-level tests with runtime validation.
 *
 * Test categories:
 * 1. 1-unfolding computation
 * 2. Combining operator ♦
 * 3. Safe update verification
 * 4. Well-formedness properties
 * 5. Unsafe update detection
 */

import { describe, it, expect } from 'vitest';
import type { CFSM } from '../../../core/projection/types';
import {
  compute1UnfoldingCFSM,
  combineProtocolsCFSM,
  checkSafeUpdateCFSM,
} from '../../../core/verification/dmst/safe-update-cfsm';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create simple recursive CFSM
 * States: S0 -> S1_rec_X -> S2 -> S1_rec_X (loop)
 */
function createRecursiveCFSM(role: string = 'Alice'): CFSM {
  return {
    role,
    protocolName: 'RecursiveProtocol',
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
        action: {
          type: 'send',
          to: 'Bob',
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
        to: 'S1_rec_X', // Back-edge
        action: { type: 'tau' },
      },
    ],
    initialState: 'S0',
    terminalStates: [], // Infinite loop
  };
}

/**
 * Create extension CFSM (to be added via continue-with)
 * States: E0 -> E1 (terminal)
 */
function createExtensionCFSM(role: string = 'Alice'): CFSM {
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
        action: {
          type: 'send',
          to: 'Charlie',
          message: {
            type: 'Message',
            label: 'ExtraWork',
            payload: { payloadType: 'string' },
          },
        },
      },
    ],
    initialState: 'E0',
    terminalStates: ['E1'],
  };
}

/**
 * Create simple linear CFSM (no recursion)
 * States: S0 -> S1 -> S2 (terminal)
 */
function createLinearCFSM(role: string = 'Alice'): CFSM {
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
        action: { type: 'tau' },
      },
      {
        id: 'l2',
        from: 'L1',
        to: 'L2',
        action: { type: 'tau' },
      },
    ],
    initialState: 'L0',
    terminalStates: ['L2'],
  };
}

/**
 * Create non-deterministic CFSM (for negative testing)
 * States: S0 with two transitions with same action (ambiguous)
 */
function createNonDeterministicCFSM(): CFSM {
  return {
    role: 'Alice',
    protocolName: 'NonDeterministic',
    parameters: [],
    states: [
      { id: 'ND0' },
      { id: 'ND1' },
      { id: 'ND2' },
    ],
    transitions: [
      {
        id: 'nd1',
        from: 'ND0',
        to: 'ND1',
        action: { type: 'tau' }, // Duplicate action
      },
      {
        id: 'nd2',
        from: 'ND0',
        to: 'ND2',
        action: { type: 'tau' }, // Duplicate action
      },
    ],
    initialState: 'ND0',
    terminalStates: ['ND1', 'ND2'],
  };
}

/**
 * Create disconnected CFSM (for negative testing)
 * States: S0 -> S1, S2 (unreachable)
 */
function createDisconnectedCFSM(): CFSM {
  return {
    role: 'Alice',
    protocolName: 'Disconnected',
    parameters: [],
    states: [
      { id: 'D0' },
      { id: 'D1' },
      { id: 'D2' }, // Unreachable!
    ],
    transitions: [
      {
        id: 'd1',
        from: 'D0',
        to: 'D1',
        action: { type: 'tau' },
      },
      // No transition to D2
    ],
    initialState: 'D0',
    terminalStates: ['D1', 'D2'],
  };
}

/**
 * Create deadlocked CFSM (for negative testing)
 * States: S0 -> S1 (non-terminal, no outgoing transitions)
 */
function createDeadlockedCFSM(): CFSM {
  return {
    role: 'Alice',
    protocolName: 'Deadlocked',
    parameters: [],
    states: [
      { id: 'DL0' },
      { id: 'DL1' }, // Non-terminal, no outgoing transitions
    ],
    transitions: [
      {
        id: 'dl1',
        from: 'DL0',
        to: 'DL1',
        action: { type: 'tau' },
      },
      // DL1 has no outgoing transitions but is not terminal
    ],
    initialState: 'DL0',
    terminalStates: [], // DL1 not marked as terminal
  };
}

// ============================================================================
// Tests: 1-Unfolding Computation
// ============================================================================

describe('Definition 14 (CFSM): 1-Unfolding Computation', () => {
  it('should compute 1-unfolding for recursive CFSM', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    // Should have states from both original and extension
    expect(unfolded.states.length).toBeGreaterThan(original.states.length);

    // Should have original + extension + bridge transitions
    expect(unfolded.transitions.length).toBeGreaterThan(original.transitions.length);

    // Initial state should be preserved
    expect(unfolded.initialState).toBe(original.initialState);

    // Terminal states should be preserved
    expect(unfolded.terminalStates).toEqual(original.terminalStates);
  });

  it('should redirect back-edges through extension', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    // Find the transition that was a back-edge (t3: S2 -> S1_rec_X)
    // It should now go to extension entry instead
    const originalBackEdge = original.transitions.find(t => t.id === 't3');
    expect(originalBackEdge).toBeDefined();
    expect(originalBackEdge!.to).toBe('S1_rec_X');

    // In unfolded version, this should be redirected
    const unfoldedBackEdge = unfolded.transitions.find(
      t => t.id === 't3' && t.from === 'S2'
    );

    expect(unfoldedBackEdge).toBeDefined();
    expect(unfoldedBackEdge!.to).not.toBe('S1_rec_X'); // Redirected!
    expect(unfoldedBackEdge!.to).toMatch(/^unfold_/); // Goes to extension
  });

  it('should create bridge transitions from extension back to recursion point', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    // Should have bridge transitions connecting extension terminals to recursion point
    const bridgeTransitions = unfolded.transitions.filter(t =>
      t.id.includes('bridge') && t.to === 'S1_rec_X'
    );

    expect(bridgeTransitions.length).toBeGreaterThan(0);
  });

  it('should throw error if recursion variable not found', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    expect(() => compute1UnfoldingCFSM(original, extension, 'Y')).toThrow(
      /recursion variable.*not found/i
    );
  });

  it('should preserve extension actions in 1-unfolding', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    // Extension has a send to Charlie - should be present in unfolded version
    const extensionActions = unfolded.transitions.filter(
      t =>
        t.action.type === 'send' &&
        (t.action as any).to === 'Charlie'
    );

    expect(extensionActions.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tests: Combining Operator ♦
// ============================================================================

describe('Definition 14 (CFSM): Combining Operator ♦', () => {
  it('should combine two linear CFSMs', () => {
    const g1 = createLinearCFSM('Alice');
    const g2 = createExtensionCFSM('Alice');

    const combined = combineProtocolsCFSM(g1, g2);

    // Product automaton should have |G1| × |G2| states
    expect(combined.states.length).toBe(g1.states.length * g2.states.length);

    // Should have transitions for both G1 and G2 advancements
    expect(combined.transitions.length).toBeGreaterThan(0);

    // Initial state should be (g1.initial, g2.initial)
    expect(combined.initialState).toBeDefined();
    expect(combined.initialState).toMatch(/combine/);
  });

  it('should create terminal states only when both CFSMs reach terminals', () => {
    const g1 = createLinearCFSM('Alice');
    const g2 = createExtensionCFSM('Alice');

    const combined = combineProtocolsCFSM(g1, g2);

    // Terminals: {L2} × {E1} = 1 terminal state
    expect(combined.terminalStates.length).toBe(
      g1.terminalStates.length * g2.terminalStates.length
    );
  });

  it('should allow interleaving of actions from both CFSMs', () => {
    const g1 = createLinearCFSM('Alice');
    const g2 = createExtensionCFSM('Alice');

    const combined = combineProtocolsCFSM(g1, g2);

    // Should have transitions advancing G1 while G2 stays same
    const g1Advancements = combined.transitions.filter(t => t.id.includes('g1'));
    expect(g1Advancements.length).toBeGreaterThan(0);

    // Should have transitions advancing G2 while G1 stays same
    const g2Advancements = combined.transitions.filter(t => t.id.includes('g2'));
    expect(g2Advancements.length).toBeGreaterThan(0);
  });

  it('should preserve role in combined CFSM', () => {
    const g1 = createLinearCFSM('Alice');
    const g2 = createExtensionCFSM('Alice');

    const combined = combineProtocolsCFSM(g1, g2);

    expect(combined.role).toBe('Alice');
  });

  it('should throw error if roles mismatch', () => {
    const g1 = createLinearCFSM('Alice');
    const g2 = createExtensionCFSM('Bob');

    expect(() => combineProtocolsCFSM(g1, g2)).toThrow(/role mismatch/i);
  });

  it('should throw error if either CFSM is null', () => {
    const g1 = createLinearCFSM('Alice');

    // @ts-expect-error - testing runtime validation
    expect(() => combineProtocolsCFSM(null, g1)).toThrow(/both protocols/i);

    // @ts-expect-error - testing runtime validation
    expect(() => combineProtocolsCFSM(g1, null)).toThrow(/both protocols/i);
  });
});

// ============================================================================
// Tests: Safe Update Verification
// ============================================================================

describe('Definition 14 (CFSM): Safe Update Verification', () => {
  it('should verify safe update (all checks pass)', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');
    const result = checkSafeUpdateCFSM(unfolded);

    expect(result.isSafe).toBe(true);
    expect(result.isConnected).toBe(true);
    expect(result.isDeterministic).toBe(true);
    expect(result.hasNoRaces).toBe(true);
    expect(result.canProgress).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect non-connected 1-unfolding', () => {
    const disconnected = createDisconnectedCFSM();
    const result = checkSafeUpdateCFSM(disconnected);

    expect(result.isSafe).toBe(false);
    expect(result.isConnected).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('connected'))).toBe(true);
  });

  it('should detect non-deterministic 1-unfolding', () => {
    const nonDeterministic = createNonDeterministicCFSM();
    const result = checkSafeUpdateCFSM(nonDeterministic);

    expect(result.isSafe).toBe(false);
    expect(result.isDeterministic).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('deterministic'))).toBe(true);
  });

  it('should detect deadlock in 1-unfolding', () => {
    const deadlocked = createDeadlockedCFSM();
    const result = checkSafeUpdateCFSM(deadlocked);

    expect(result.isSafe).toBe(false);
    expect(result.canProgress).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('progress') || e.includes('deadlock'))).toBe(true);
  });

  it('should pass for simple linear CFSM', () => {
    const linear = createLinearCFSM();
    const result = checkSafeUpdateCFSM(linear);

    expect(result.isSafe).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================================
// Tests: Well-Formedness Properties
// ============================================================================

describe('Definition 14 (CFSM): Well-Formedness Properties', () => {
  it('property: 1-unfolding preserves initial state', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    expect(unfolded.initialState).toBe(original.initialState);
  });

  it('property: 1-unfolding preserves terminal states', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    expect(unfolded.terminalStates).toEqual(original.terminalStates);
  });

  it('property: 1-unfolding preserves role', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    expect(unfolded.role).toBe(original.role);
  });

  it('property: combining operator is commutative for disjoint CFSMs', () => {
    const g1 = createLinearCFSM('Alice');
    const g2 = createExtensionCFSM('Alice');

    const combined1 = combineProtocolsCFSM(g1, g2);
    const combined2 = combineProtocolsCFSM(g2, g1);

    // Should have same number of states (commutativity)
    expect(combined1.states.length).toBe(combined2.states.length);

    // Should have same number of transitions
    expect(combined1.transitions.length).toBe(combined2.transitions.length);
  });

  it('property: safe update implies all well-formedness checks pass', () => {
    const original = createRecursiveCFSM();
    const extension = createExtensionCFSM();

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');
    const result = checkSafeUpdateCFSM(unfolded);

    // If safe, all individual properties must hold
    if (result.isSafe) {
      expect(result.isConnected).toBe(true);
      expect(result.isDeterministic).toBe(true);
      expect(result.hasNoRaces).toBe(true);
      expect(result.canProgress).toBe(true);
    }
  });
});

// ============================================================================
// Tests: Unsafe Update Detection
// ============================================================================

describe('Definition 14 (CFSM): Unsafe Update Detection', () => {
  it('should reject update creating disconnected CFSM', () => {
    // Create a scenario where extension creates unreachable states
    const disconnected = createDisconnectedCFSM();
    const result = checkSafeUpdateCFSM(disconnected);

    expect(result.isSafe).toBe(false);
    expect(result.isConnected).toBe(false);
  });

  it('should reject update creating non-deterministic choices', () => {
    const nonDeterministic = createNonDeterministicCFSM();
    const result = checkSafeUpdateCFSM(nonDeterministic);

    expect(result.isSafe).toBe(false);
    expect(result.isDeterministic).toBe(false);
  });

  it('should reject update creating deadlock', () => {
    const deadlocked = createDeadlockedCFSM();
    const result = checkSafeUpdateCFSM(deadlocked);

    expect(result.isSafe).toBe(false);
    expect(result.canProgress).toBe(false);
  });

  it('should provide diagnostic errors for unsafe updates', () => {
    const deadlocked = createDeadlockedCFSM();
    const result = checkSafeUpdateCFSM(deadlocked);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every(e => typeof e === 'string')).toBe(true);
  });
});

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('Definition 14 (CFSM): Edge Cases', () => {
  it('should handle extension with multiple terminals', () => {
    const original = createRecursiveCFSM();
    const extension: CFSM = {
      role: 'Alice',
      protocolName: 'MultiTerminal',
      parameters: [],
      states: [
        { id: 'MT0' },
        { id: 'MT1' },
        { id: 'MT2' },
      ],
      transitions: [
        {
          id: 'mt1',
          from: 'MT0',
          to: 'MT1',
          action: { type: 'tau' },
        },
        {
          id: 'mt2',
          from: 'MT0',
          to: 'MT2',
          action: { type: 'tau' },
        },
      ],
      initialState: 'MT0',
      terminalStates: ['MT1', 'MT2'], // Multiple terminals
    };

    const unfolded = compute1UnfoldingCFSM(original, extension, 'X');

    // Should create bridge transitions for all terminals
    const bridgeTransitions = unfolded.transitions.filter(
      t => t.id.includes('bridge') && t.to === 'S1_rec_X'
    );

    expect(bridgeTransitions.length).toBe(extension.terminalStates.length);
  });

  it('should handle CFSM with no recursion points', () => {
    const linear = createLinearCFSM();
    const extension = createExtensionCFSM();

    // Linear CFSM has no recursion variable
    expect(() => compute1UnfoldingCFSM(linear, extension, 'X')).toThrow();
  });

  it('should handle empty extension (no states)', () => {
    const original = createRecursiveCFSM();
    const emptyExtension: CFSM = {
      role: 'Alice',
      protocolName: 'Empty',
      parameters: [],
      states: [],
      transitions: [],
      initialState: '',
      terminalStates: [],
    };

    // Empty extension means no states to add - result is essentially original
    const unfolded = compute1UnfoldingCFSM(original, emptyExtension, 'X');

    // Should not add any states from extension (it has none)
    expect(unfolded.states.length).toBe(original.states.length);
  });
});
