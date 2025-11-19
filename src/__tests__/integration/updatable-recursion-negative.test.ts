/**
 * Negative Tests: Updatable Recursion (Sprint 3 - Phase 1)
 *
 * Tests for error conditions and invalid update scenarios.
 * These tests ensure the system correctly rejects malformed or unsafe updates.
 *
 * Test categories:
 * 1. Invalid recursion variable references
 * 2. Malformed CFSM structures
 * 3. Version conflicts and stale updates
 * 4. Concurrent conflicting updates
 * 5. Invalid extension structures
 * 6. Role mismatches
 * 7. Empty or null inputs
 */

import { describe, it, expect } from 'vitest';
import type { CFSM } from '../../core/projection/types';
import {
  createVersionRegistry,
  registerInitialVersion,
  registerCFSMUpdate,
  extendCFSM,
  type CFSMUpdate,
} from '../../core/runtime/versioned-cfsm';

// ============================================================================
// Test Fixtures
// ============================================================================

function createValidCFSM(role: string): CFSM {
  return {
    role,
    protocolName: 'TestProtocol',
    parameters: [],
    states: [
      { id: 'S0' },
      { id: 'S1' },
    ],
    transitions: [
      {
        id: 't1',
        from: 'S0',
        to: 'S1',
        action: { type: 'tau' },
      },
    ],
    initialState: 'S0',
    terminalStates: ['S1'],
  };
}

function createRecursiveCFSM(role: string): CFSM {
  return {
    role,
    protocolName: 'RecProtocol',
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
        action: { type: 'tau' },
      },
      {
        id: 't3',
        from: 'S2',
        to: 'S1_rec_X',
        action: { type: 'tau' },
      },
    ],
    initialState: 'S0',
    terminalStates: [],
  };
}

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
        action: { type: 'tau' },
      },
    ],
    initialState: 'E0',
    terminalStates: ['E1'],
  };
}

// ============================================================================
// Negative Tests: Invalid Recursion Variables
// ============================================================================

describe('Negative: Invalid Recursion Variables', () => {
  it('should reject update to non-existent recursion variable', () => {
    const original = createRecursiveCFSM('Alice');
    const extension = createExtensionCFSM('Alice');

    // Original has recursion var "X", trying to update "Y"
    expect(() => extendCFSM(original, extension, 'Y')).toThrow(/recursion/i);
  });

  it('should reject empty recursion variable name', () => {
    const original = createRecursiveCFSM('Alice');
    const extension = createExtensionCFSM('Alice');

    expect(() => extendCFSM(original, extension, '')).toThrow();
  });

  it('should reject null recursion variable', () => {
    const original = createRecursiveCFSM('Alice');
    const extension = createExtensionCFSM('Alice');

    // @ts-expect-error - testing runtime validation
    expect(() => extendCFSM(original, extension, null)).toThrow();
  });

  it('should reject undefined recursion variable', () => {
    const original = createRecursiveCFSM('Alice');
    const extension = createExtensionCFSM('Alice');

    // @ts-expect-error - testing runtime validation
    expect(() => extendCFSM(original, extension, undefined)).toThrow();
  });
});

// ============================================================================
// Negative Tests: Malformed CFSM Structures
// ============================================================================

describe('Negative: Malformed CFSM Structures', () => {
  it('should reject extension with no states', () => {
    const original = createRecursiveCFSM('Alice');
    const malformedExtension: CFSM = {
      role: 'Alice',
      protocolName: 'Bad',
      parameters: [],
      states: [], // EMPTY!
      transitions: [],
      initialState: 'E0', // Doesn't exist
      terminalStates: [],
    };

    expect(() => extendCFSM(original, malformedExtension, 'X')).toThrow(/state/i);
  });

  it('should reject extension with dangling transition (invalid from)', () => {
    const original = createRecursiveCFSM('Alice');
    const malformedExtension: CFSM = {
      role: 'Alice',
      protocolName: 'Bad',
      parameters: [],
      states: [{ id: 'E0' }],
      transitions: [
        {
          id: 't1',
          from: 'NONEXISTENT', // Invalid!
          to: 'E0',
          action: { type: 'tau' },
        },
      ],
      initialState: 'E0',
      terminalStates: [],
    };

    expect(() => extendCFSM(original, malformedExtension, 'X')).toThrow(/transition/i);
  });

  it('should reject extension with dangling transition (invalid to)', () => {
    const original = createRecursiveCFSM('Alice');
    const malformedExtension: CFSM = {
      role: 'Alice',
      protocolName: 'Bad',
      parameters: [],
      states: [{ id: 'E0' }],
      transitions: [
        {
          id: 't1',
          from: 'E0',
          to: 'NONEXISTENT', // Invalid!
          action: { type: 'tau' },
        },
      ],
      initialState: 'E0',
      terminalStates: [],
    };

    expect(() => extendCFSM(original, malformedExtension, 'X')).toThrow(/transition/i);
  });

  it('should reject extension with invalid initial state', () => {
    const original = createRecursiveCFSM('Alice');
    const malformedExtension: CFSM = {
      role: 'Alice',
      protocolName: 'Bad',
      parameters: [],
      states: [{ id: 'E0' }],
      transitions: [],
      initialState: 'NONEXISTENT', // Not in states!
      terminalStates: [],
    };

    expect(() => extendCFSM(original, malformedExtension, 'X')).toThrow(/initial state/i);
  });

  it('should reject extension with invalid terminal state', () => {
    const original = createRecursiveCFSM('Alice');
    const malformedExtension: CFSM = {
      role: 'Alice',
      protocolName: 'Bad',
      parameters: [],
      states: [{ id: 'E0' }],
      transitions: [],
      initialState: 'E0',
      terminalStates: ['NONEXISTENT'], // Not in states!
    };

    expect(() => extendCFSM(original, malformedExtension, 'X')).toThrow(/terminal state/i);
  });
});

// ============================================================================
// Negative Tests: Version Conflicts
// ============================================================================

describe('Negative: Version Conflicts', () => {
  it('should reject update from non-existent version', () => {
    const registry = createVersionRegistry();
    const cfsm = createValidCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM('Alice'),
      targetVersion: 999, // Doesn't exist!
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/version.*not found/i);
  });

  it('should reject update with negative version number', () => {
    const registry = createVersionRegistry();
    const cfsm = createValidCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM('Alice'),
      targetVersion: -1, // Invalid!
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/version/i);
  });

  it('should reject update to non-existent protocol', () => {
    const registry = createVersionRegistry();

    const update: CFSMUpdate = {
      protocolName: 'NonExistent', // Never registered!
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM('Alice'),
      targetVersion: 1,
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/protocol.*not found/i);
  });

  it('should reject update to non-existent role', () => {
    const registry = createVersionRegistry();
    const cfsm = createValidCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Bob', // Never registered!
      recursionVar: 'X',
      extension: createExtensionCFSM('Bob'), // Matching role name
      targetVersion: 1,
    };

    // Should fail because Bob was never registered in the protocol
    expect(() => registerCFSMUpdate(registry, update)).toThrow(/not found/i);
  });
});

// ============================================================================
// Negative Tests: Role Mismatches
// ============================================================================

describe('Negative: Role Mismatches', () => {
  it('should reject extension with mismatched role name', () => {
    const registry = createVersionRegistry();
    const aliceCFSM = createValidCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', aliceCFSM);

    const bobExtension = createExtensionCFSM('Bob'); // Different role!

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: bobExtension, // Bob's CFSM for Alice's role!
      targetVersion: 1,
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/role.*mismatch/i);
  });
});

// ============================================================================
// Negative Tests: Empty/Null Inputs
// ============================================================================

describe('Negative: Empty and Null Inputs', () => {
  it('should reject null original CFSM', () => {
    const extension = createExtensionCFSM('Alice');

    // @ts-expect-error - testing runtime validation
    expect(() => extendCFSM(null, extension, 'X')).toThrow();
  });

  it('should reject null extension CFSM', () => {
    const original = createRecursiveCFSM('Alice');

    // @ts-expect-error - testing runtime validation
    expect(() => extendCFSM(original, null, 'X')).toThrow();
  });

  it('should reject empty protocol name in update', () => {
    const registry = createVersionRegistry();

    const update: CFSMUpdate = {
      protocolName: '', // Empty!
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM('Alice'),
      targetVersion: 1,
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/protocol.*name/i);
  });

  it('should reject empty role name in update', () => {
    const registry = createVersionRegistry();

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: '', // Empty!
      recursionVar: 'X',
      extension: createExtensionCFSM('Alice'),
      targetVersion: 1,
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/role.*name/i);
  });

  it('should reject empty recursion variable in update', () => {
    const registry = createVersionRegistry();
    const cfsm = createValidCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: '', // Empty!
      extension: createExtensionCFSM('Alice'),
      targetVersion: 1,
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/recursion/i);
  });
});
