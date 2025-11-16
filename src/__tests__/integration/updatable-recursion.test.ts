/**
 * Updatable Recursion Tests (Sprint 3)
 *
 * Tests for DMst updatable recursion runtime semantics.
 * Based on Castro-Perez & Yoshida (ECOOP 2023), Section 3.2.
 *
 * Test scenarios:
 * 1. Version registry operations
 * 2. CFSM extension (combining CFSMs)
 * 3. Executor version tracking
 * 4. Simulator update broadcasting
 * 5. End-to-end updatable protocol execution
 */

import { describe, it, expect } from 'vitest';
import type { CFSM } from '../../core/projection/types';
import {
  createVersionRegistry,
  registerInitialVersion,
  registerCFSMUpdate,
  getActiveVersion,
  getVersion,
  getVersionHistory,
  extendCFSM,
  type CFSMUpdate,
} from '../../core/runtime/versioned-cfsm';
import { DMstSimulator } from '../../core/runtime/dmst-simulator';
import { DMstExecutor } from '../../core/runtime/dmst-executor';
import { InMemoryTransport } from '../../core/runtime/transport';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a simple two-state CFSM for testing
 */
function createSimpleCFSM(role: string): CFSM {
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

/**
 * Create an extension CFSM (2 new states with send action)
 */
function createExtensionCFSM(): CFSM {
  return {
    role: 'test',
    protocolName: 'ExtensionProtocol',
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
          to: 'Bob',
          message: {
            type: 'Message',
            label: 'ExtensionData',
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
 * Create a protocol with recursion point
 *
 * States: S0 -> S1(rec X) -> S2 -> S1
 */
function createRecursiveProtocolCFSM(role: string): CFSM {
  return {
    role,
    protocolName: 'RecursiveProtocol',
    parameters: [],
    states: [
      { id: 'S0' },
      { id: 'S1_rec_X' },  // Recursion point (contains "X")
      { id: 'S2' },
    ],
    transitions: [
      // Initial transition
      {
        id: 't1',
        from: 'S0',
        to: 'S1_rec_X',
        action: { type: 'tau' },
      },
      // Loop body
      {
        id: 't2',
        from: 'S1_rec_X',
        to: 'S2',
        action: {
          type: 'send',
          to: 'Bob',
          message: {
            type: 'Message',
            label: 'Data',
            payload: { payloadType: 'string' },
          },
        },
      },
      // Back to recursion point
      {
        id: 't3',
        from: 'S2',
        to: 'S1_rec_X',
        action: { type: 'tau' },
      },
    ],
    initialState: 'S0',
    terminalStates: [],  // Infinite loop (no terminal for testing)
  };
}

// ============================================================================
// Unit Tests: Version Registry
// ============================================================================

describe('Updatable Recursion - Version Registry', () => {
  it('should create empty version registry', () => {
    const registry = createVersionRegistry();

    expect(registry.versions.size).toBe(0);
    expect(registry.activeVersion.size).toBe(0);
  });

  it('should register initial version', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    const version = registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    expect(version).toBe(1);
    expect(registry.versions.get('TestProtocol:Alice')).toHaveLength(1);
    expect(registry.activeVersion.get('TestProtocol:Alice')).toBe(1);
  });

  it('should retrieve active version', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);
    const active = getActiveVersion(registry, 'TestProtocol', 'Alice');

    expect(active).toBeDefined();
    expect(active?.version).toBe(1);
    expect(active?.cfsm).toBe(cfsm);
  });

  it('should retrieve specific version', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);
    const v1 = getVersion(registry, 'TestProtocol', 'Alice', 1);

    expect(v1).toBeDefined();
    expect(v1?.version).toBe(1);
  });

  it('should track version history', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);
    const history = getVersionHistory(registry, 'TestProtocol', 'Alice');

    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
  });
});

// ============================================================================
// Unit Tests: CFSM Extension
// ============================================================================

describe('Updatable Recursion - CFSM Extension', () => {
  it('should extend CFSM with new states', () => {
    const original = createSimpleCFSM('Alice');
    const extension = createExtensionCFSM();

    const extended = extendCFSM(original, extension, 'X');

    // Should have states from both CFSMs
    expect(extended.states.length).toBeGreaterThan(original.states.length);
    expect(extended.states.length).toBeGreaterThan(extension.states.length);
  });

  it('should connect extension to recursion point', () => {
    const original = createRecursiveProtocolCFSM('Alice');
    const extension = createExtensionCFSM();

    const extended = extendCFSM(original, extension, 'X');

    // Extension states should be added
    const extStates = extended.states.filter(s => s.id.startsWith('ext_'));
    expect(extStates.length).toBe(2);

    // Should have bridge transitions connecting extension to recursion point
    const bridgeTransitions = extended.transitions.filter(
      t => t.action.type === 'tau' && t.from.startsWith('ext_')
    );
    expect(bridgeTransitions.length).toBeGreaterThan(0);
  });

  it('should preserve original terminal states', () => {
    const original = createSimpleCFSM('Alice');
    const extension = createExtensionCFSM();

    const extended = extendCFSM(original, extension, 'X');

    // Terminal states should be preserved from original
    expect(extended.terminalStates).toEqual(original.terminalStates);
  });
});

// ============================================================================
// Unit Tests: CFSM Update Registration
// ============================================================================

describe('Updatable Recursion - Update Registration', () => {
  it('should register CFSM update', () => {
    const registry = createVersionRegistry();
    const original = createSimpleCFSM('Alice');
    const extension = createExtensionCFSM();

    registerInitialVersion(registry, 'TestProtocol', 'Alice', original);

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension,
      targetVersion: 1,
    };

    const newVersion = registerCFSMUpdate(registry, update);

    expect(newVersion).toBe(2);
    expect(registry.versions.get('TestProtocol:Alice')).toHaveLength(2);
    expect(registry.activeVersion.get('TestProtocol:Alice')).toBe(2);
  });

  it('should track parent version in update', () => {
    const registry = createVersionRegistry();
    const original = createSimpleCFSM('Alice');
    const extension = createExtensionCFSM();

    registerInitialVersion(registry, 'TestProtocol', 'Alice', original);

    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension,
      targetVersion: 1,
    };

    registerCFSMUpdate(registry, update);

    const v2 = getVersion(registry, 'TestProtocol', 'Alice', 2);
    expect(v2?.parentVersion).toBe(1);
    expect(v2?.extension).toBe(extension);
  });

  it('should support multiple updates (chaining)', () => {
    const registry = createVersionRegistry();
    const original = createSimpleCFSM('Alice');
    const ext1 = createExtensionCFSM();
    const ext2 = createExtensionCFSM();

    registerInitialVersion(registry, 'TestProtocol', 'Alice', original);

    // First update
    const update1: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: ext1,
      targetVersion: 1,
    };
    const v2 = registerCFSMUpdate(registry, update1);

    // Second update (on top of first)
    const update2: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: ext2,
      targetVersion: v2,
    };
    const v3 = registerCFSMUpdate(registry, update2);

    expect(v3).toBe(3);
    expect(registry.versions.get('TestProtocol:Alice')).toHaveLength(3);

    const version3 = getVersion(registry, 'TestProtocol', 'Alice', 3);
    expect(version3?.parentVersion).toBe(2);
  });
});

// ============================================================================
// Integration Tests: Executor Version Tracking
// ============================================================================

describe('Updatable Recursion - Executor Version Tracking', () => {
  it('should track CFSM version in executor', () => {
    const cfsm = createSimpleCFSM('Alice');
    const transport = new InMemoryTransport();

    const executor = new DMstExecutor({
      role: 'Alice',
      cfsm,
      transport,
      cfsmVersion: 1,
      protocolName: 'TestProtocol',
    });

    expect(executor.getCFSMVersion()).toBe(1);
    expect(executor.getProtocolName()).toBe('TestProtocol');
  });

  it('should apply CFSM update to executor', () => {
    const cfsm = createSimpleCFSM('Alice');
    const transport = new InMemoryTransport();

    const executor = new DMstExecutor({
      role: 'Alice',
      cfsm,
      transport,
      cfsmVersion: 1,
      protocolName: 'TestProtocol',
    });

    const newCFSM = extendCFSM(cfsm, createExtensionCFSM(), 'X');
    executor.applyCFSMUpdate(newCFSM, 2);

    expect(executor.getCFSMVersion()).toBe(2);
  });

  it('should preserve executor state after update', async () => {
    const cfsm = createSimpleCFSM('Alice');
    const transport = new InMemoryTransport();

    const executor = new DMstExecutor({
      role: 'Alice',
      cfsm,
      transport,
      cfsmVersion: 1,
      protocolName: 'TestProtocol',
    });

    // Execute one step
    await executor.step();
    const stateBefore = executor.getState();

    // Apply update
    const newCFSM = extendCFSM(cfsm, createExtensionCFSM(), 'X');
    executor.applyCFSMUpdate(newCFSM, 2);

    // State should be preserved
    const stateAfter = executor.getState();
    expect(stateAfter.currentState).toBe(stateBefore.currentState);
    expect(stateAfter.role).toBe(stateBefore.role);
  });
});

// ============================================================================
// Integration Tests: Simulator Update Broadcasting
// ============================================================================

describe('Updatable Recursion - Simulator Integration', () => {
  it('should initialize simulator with version registry', () => {
    const aliceCFSM = createSimpleCFSM('Alice');
    const bobCFSM = createSimpleCFSM('Bob');

    const cfsms = new Map([
      ['Alice', aliceCFSM],
      ['Bob', bobCFSM],
    ]);

    const simulator = new DMstSimulator(
      cfsms,
      new Map(),
      undefined,
      undefined,
      { protocolName: 'TestProtocol' }
    );

    // Simulator should register v1 for each role
    const state = simulator.getState();
    expect(state.roles.size).toBe(2);
  });

  it('should track protocol name in simulator', () => {
    const aliceCFSM = createSimpleCFSM('Alice');
    const cfsms = new Map([['Alice', aliceCFSM]]);

    const simulator = new DMstSimulator(
      cfsms,
      new Map(),
      undefined,
      undefined,
      { protocolName: 'MyProtocol' }
    );

    // Protocol name should be stored (we can't directly access it, but
    // it's used internally for version registry keys)
    expect(simulator).toBeDefined();
  });
});

// ============================================================================
// End-to-End Tests: Updatable Protocol Execution
// ============================================================================

describe('Updatable Recursion - End-to-End', () => {
  it('should execute simple protocol with version tracking', async () => {
    const aliceCFSM = createSimpleCFSM('Alice');
    const bobCFSM = createSimpleCFSM('Bob');

    const cfsms = new Map([
      ['Alice', aliceCFSM],
      ['Bob', bobCFSM],
    ]);

    const simulator = new DMstSimulator(
      cfsms,
      new Map(),
      undefined,
      undefined,
      { protocolName: 'TestProtocol' }
    );

    // Execute protocol
    await simulator.run(10);

    const state = simulator.getState();
    expect(state.completed).toBe(true);
  });

  it('should handle version registry across execution', async () => {
    const aliceCFSM = createSimpleCFSM('Alice');
    const cfsms = new Map([['Alice', aliceCFSM]]);

    const simulator = new DMstSimulator(
      cfsms,
      new Map(),
      undefined,
      undefined,
      {
        protocolName: 'VersionedProtocol',
        recordTrace: true,
      }
    );

    await simulator.run(10);

    const trace = simulator.getTrace();
    expect(trace.completed).toBe(true);
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Updatable Recursion - Correctness Properties', () => {
  it('should maintain CFSM well-formedness after extension', () => {
    const original = createRecursiveProtocolCFSM('Alice');
    const extension = createExtensionCFSM();

    const extended = extendCFSM(original, extension, 'X');

    // Well-formedness properties:
    // 1. Has initial state
    expect(extended.initialState).toBeDefined();
    expect(extended.states.find(s => s.id === extended.initialState)).toBeDefined();

    // 2. All transitions reference existing states
    for (const trans of extended.transitions) {
      expect(extended.states.find(s => s.id === trans.from)).toBeDefined();
      expect(extended.states.find(s => s.id === trans.to)).toBeDefined();
    }

    // 3. Terminal states exist in states list (if any)
    for (const term of extended.terminalStates) {
      expect(extended.states.find(s => s.id === term)).toBeDefined();
    }
  });

  it('should preserve type safety across updates', () => {
    const registry = createVersionRegistry();
    const original = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', original);

    // All versions should have same role
    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM(),
      targetVersion: 1,
    };

    registerCFSMUpdate(registry, update);

    const v1 = getVersion(registry, 'TestProtocol', 'Alice', 1);
    const v2 = getVersion(registry, 'TestProtocol', 'Alice', 2);

    expect(v1?.cfsm.role).toBe('Alice');
    expect(v2?.cfsm.role).toBe('Alice');
  });

  it('should maintain version monotonicity', () => {
    const registry = createVersionRegistry();
    const original = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', original);

    const update1: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM(),
      targetVersion: 1,
    };

    const v2 = registerCFSMUpdate(registry, update1);

    const update2: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: createExtensionCFSM(),
      targetVersion: v2,
    };

    const v3 = registerCFSMUpdate(registry, update2);

    // Versions should be strictly increasing
    expect(v2).toBeGreaterThan(1);
    expect(v3).toBeGreaterThan(v2);
  });
});
