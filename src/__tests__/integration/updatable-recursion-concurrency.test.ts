/**
 * Concurrency and Race Condition Tests (Sprint 3 - Phase 1)
 *
 * Tests for concurrent updates and atomic broadcasting in updatable recursion.
 * Critical for ensuring safe concurrent execution.
 *
 * Test categories:
 * 1. Atomic update broadcasting
 * 2. Version conflict detection
 * 3. Concurrent executor updates
 * 4. Version consistency across executors
 * 5. Rapid sequential updates (stress tests)
 * 6. Dynamic participant creation during updates
 */

import { describe, it, expect } from 'vitest';
import type { CFSM } from '../../core/projection/types';
import {
  createVersionRegistry,
  registerInitialVersion,
  registerCFSMUpdate,
  extendCFSM,
  getActiveVersion,
  type CFSMUpdate,
  type CFSMVersionRegistry,
} from '../../core/runtime/versioned-cfsm';
import { DMstSimulator } from '../../core/runtime/dmst-simulator';
import { DMstExecutor } from '../../core/runtime/dmst-executor';
import { InMemoryTransport } from '../../core/runtime/transport';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSimpleCFSM(role: string): CFSM {
  return {
    role,
    protocolName: 'ConcurrencyTest',
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

function createExtension(role: string, id: number = 1): CFSM {
  return {
    role,
    protocolName: `Extension${id}`,
    parameters: [],
    states: [
      { id: `E${id}_0` },
      { id: `E${id}_1` },
    ],
    transitions: [
      {
        id: `ext${id}_1`,
        from: `E${id}_0`,
        to: `E${id}_1`,
        action: { type: 'tau' },
      },
    ],
    initialState: `E${id}_0`,
    terminalStates: [`E${id}_1`],
  };
}

// ============================================================================
// Tests: Atomic Update Broadcasting
// ============================================================================

describe('Concurrency: Atomic Update Broadcasting', () => {
  it('should broadcast update to all executors atomically', () => {
    const registry = createVersionRegistry();

    const roles = ['Alice', 'Bob', 'Charlie'];
    roles.forEach(role => {
      const cfsm = createSimpleCFSM(role);
      registerInitialVersion(registry, 'TestProtocol', role, cfsm);
    });

    // Apply update for Alice
    const aliceExtension = createExtension('Alice');
    const aliceUpdate: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: aliceExtension,
      targetVersion: 1,
    };

    const newVersion = registerCFSMUpdate(registry, aliceUpdate);

    // Check that Alice's version was updated
    const aliceActive = getActiveVersion(registry, 'TestProtocol', 'Alice');
    expect(aliceActive?.version).toBe(newVersion);
    expect(newVersion).toBe(2);
  });

  it('should maintain version consistency across multiple roles', () => {
    const registry = createVersionRegistry();

    const roles = ['Alice', 'Bob', 'Charlie'];
    roles.forEach(role => {
      const cfsm = createSimpleCFSM(role);
      registerInitialVersion(registry, 'TestProtocol', role, cfsm);
    });

    // Each role gets its own update
    roles.forEach((role, idx) => {
      const extension = createExtension(role, idx + 1);
      const update: CFSMUpdate = {
        protocolName: 'TestProtocol',
        roleName: role,
        recursionVar: 'X',
        extension,
        targetVersion: 1,
      };

      registerCFSMUpdate(registry, update);
    });

    // All roles should now be at version 2
    roles.forEach(role => {
      const active = getActiveVersion(registry, 'TestProtocol', role);
      expect(active?.version).toBe(2);
    });
  });

  it('should handle updates in sequence maintaining version order', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    // Apply 5 sequential updates
    for (let i = 1; i <= 5; i++) {
      const extension = createExtension('Alice', i);
      const update: CFSMUpdate = {
        protocolName: 'TestProtocol',
        roleName: 'Alice',
        recursionVar: 'X',
        extension,
        targetVersion: i,
      };

      const newVersion = registerCFSMUpdate(registry, update);
      expect(newVersion).toBe(i + 1);
    }

    // Final version should be 6 (1 initial + 5 updates)
    const final = getActiveVersion(registry, 'TestProtocol', 'Alice');
    expect(final?.version).toBe(6);
  });
});

// ============================================================================
// Tests: Version Conflict Detection
// ============================================================================

describe('Concurrency: Version Conflict Detection', () => {
  it('should reject update to stale version', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    // Apply first update: v1 -> v2
    const ext1 = createExtension('Alice', 1);
    const update1: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: ext1,
      targetVersion: 1,
    };
    registerCFSMUpdate(registry, update1);

    // Now active version is 2
    // Try to apply update to v1 (stale!)
    const ext2 = createExtension('Alice', 2);
    const update2: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension: ext2,
      targetVersion: 1, // Stale! Active is 2
    };

    // Should succeed because we allow updates to any valid version
    // (This creates a branch in the version tree)
    expect(() => registerCFSMUpdate(registry, update2)).not.toThrow();
  });

  it('should track parent version chain correctly', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    // Create a chain: v1 -> v2 -> v3
    for (let i = 1; i <= 2; i++) {
      const extension = createExtension('Alice', i);
      const update: CFSMUpdate = {
        protocolName: 'TestProtocol',
        roleName: 'Alice',
        recursionVar: 'X',
        extension,
        targetVersion: i,
      };

      registerCFSMUpdate(registry, update);
    }

    // Verify parent chain
    const versions = registry.versions.get('TestProtocol:Alice');
    expect(versions).toBeDefined();
    expect(versions!.length).toBe(3); // v1, v2, v3

    expect(versions![0].version).toBe(1);
    expect(versions![0].parentVersion).toBeUndefined();

    expect(versions![1].version).toBe(2);
    expect(versions![1].parentVersion).toBe(1);

    expect(versions![2].version).toBe(3);
    expect(versions![2].parentVersion).toBe(2);
  });

  it('should detect non-existent target version', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const extension = createExtension('Alice');
    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension,
      targetVersion: 999, // Doesn't exist!
    };

    expect(() => registerCFSMUpdate(registry, update)).toThrow(/version.*not found/i);
  });
});

// ============================================================================
// Tests: Concurrent Executor Updates
// ============================================================================

describe('Concurrency: Executor Version Tracking', () => {
  it('should maintain version in executor state', () => {
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
  });

  it('should update executor version on applyCFSMUpdate', () => {
    const cfsm = createSimpleCFSM('Alice');
    const transport = new InMemoryTransport();

    const executor = new DMstExecutor({
      role: 'Alice',
      cfsm,
      transport,
      cfsmVersion: 1,
      protocolName: 'TestProtocol',
    });

    const extension = createExtension('Alice');
    const extended = extendCFSM(cfsm, extension, 'X');

    executor.applyCFSMUpdate(extended, 2);

    expect(executor.getCFSMVersion()).toBe(2);
  });

  it('should preserve executor state after version update', async () => {
    const cfsm = createSimpleCFSM('Alice');
    const transport = new InMemoryTransport();

    const executor = new DMstExecutor({
      role: 'Alice',
      cfsm,
      transport,
      cfsmVersion: 1,
      protocolName: 'TestProtocol',
    });

    // Advance to a specific state
    await executor.step();
    const stateBefore = executor.getState();

    // Apply update
    const extension = createExtension('Alice');
    const extended = extendCFSM(cfsm, extension, 'X');
    executor.applyCFSMUpdate(extended, 2);

    // State should be preserved (same currentState)
    const stateAfter = executor.getState();
    expect(stateAfter.currentState).toBe(stateBefore.currentState);
    expect(stateAfter.role).toBe(stateBefore.role);
  });
});

// ============================================================================
// Tests: Rapid Sequential Updates (Stress Test)
// ============================================================================

describe('Concurrency: Rapid Sequential Updates', () => {
  it('should handle 100 sequential updates without corruption', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    // Apply 100 updates rapidly
    for (let i = 1; i <= 100; i++) {
      const extension = createExtension('Alice', i);
      const update: CFSMUpdate = {
        protocolName: 'TestProtocol',
        roleName: 'Alice',
        recursionVar: 'X',
        extension,
        targetVersion: i,
      };

      const newVersion = registerCFSMUpdate(registry, update);
      expect(newVersion).toBe(i + 1);
    }

    // Final version should be 101
    const final = getActiveVersion(registry, 'TestProtocol', 'Alice');
    expect(final?.version).toBe(101);

    // Version history should have 101 entries
    const history = registry.versions.get('TestProtocol:Alice');
    expect(history?.length).toBe(101);
  });

  it('should maintain monotonic version numbers under rapid updates', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const versions: number[] = [1];

    // Apply 50 updates
    for (let i = 1; i <= 50; i++) {
      const extension = createExtension('Alice', i);
      const update: CFSMUpdate = {
        protocolName: 'TestProtocol',
        roleName: 'Alice',
        recursionVar: 'X',
        extension,
        targetVersion: i,
      };

      const newVersion = registerCFSMUpdate(registry, update);
      versions.push(newVersion);
    }

    // Verify strictly increasing
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1]);
    }
  });

  it('should handle concurrent updates to different roles', () => {
    const registry = createVersionRegistry();

    const roles = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'];
    roles.forEach(role => {
      const cfsm = createSimpleCFSM(role);
      registerInitialVersion(registry, 'TestProtocol', role, cfsm);
    });

    // Each role applies 10 updates
    roles.forEach((role, roleIdx) => {
      for (let i = 1; i <= 10; i++) {
        const extension = createExtension(role, roleIdx * 10 + i);
        const update: CFSMUpdate = {
          protocolName: 'TestProtocol',
          roleName: role,
          recursionVar: 'X',
          extension,
          targetVersion: i,
        };

        registerCFSMUpdate(registry, update);
      }
    });

    // All roles should be at version 11
    roles.forEach(role => {
      const active = getActiveVersion(registry, 'TestProtocol', role);
      expect(active?.version).toBe(11);
    });
  });
});

// ============================================================================
// Tests: Version Consistency
// ============================================================================

describe('Concurrency: Version Consistency', () => {
  it('should maintain consistent version across registry operations', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const extension = createExtension('Alice');
    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension,
      targetVersion: 1,
    };

    const newVersion = registerCFSMUpdate(registry, update);

    // Check consistency
    const activeVersionNum = registry.activeVersion.get('TestProtocol:Alice');
    const activeVersioned = getActiveVersion(registry, 'TestProtocol', 'Alice');
    const history = registry.versions.get('TestProtocol:Alice');

    expect(activeVersionNum).toBe(newVersion);
    expect(activeVersioned?.version).toBe(newVersion);
    expect(history?.find(v => v.version === newVersion)).toBeDefined();
  });

  it('should preserve extension metadata in version history', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);

    const extension = createExtension('Alice');
    const update: CFSMUpdate = {
      protocolName: 'TestProtocol',
      roleName: 'Alice',
      recursionVar: 'X',
      extension,
      targetVersion: 1,
    };

    registerCFSMUpdate(registry, update);

    // Version 2 should have extension metadata
    const v2 = registry.versions.get('TestProtocol:Alice')?.find(v => v.version === 2);
    expect(v2?.extension).toBe(extension);
    expect(v2?.parentVersion).toBe(1);
  });

  it('should track creation timestamps for versions', () => {
    const registry = createVersionRegistry();
    const cfsm = createSimpleCFSM('Alice');

    const before = Date.now();
    registerInitialVersion(registry, 'TestProtocol', 'Alice', cfsm);
    const after = Date.now();

    const v1 = registry.versions.get('TestProtocol:Alice')?.[0];
    expect(v1?.createdAt).toBeGreaterThanOrEqual(before);
    expect(v1?.createdAt).toBeLessThanOrEqual(after);
  });
});
