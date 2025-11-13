/**
 * Protocol Registry Tests
 *
 * Comprehensive test suite for protocol registry with formal correctness validation.
 *
 * Test Categories:
 * 1. Basic Resolution
 * 2. Dependency Validation
 * 3. Circular Dependency Detection
 * 4. Role Mapping Validation
 * 5. Error Handling
 * 6. Edge Cases
 */

import { describe, it, expect } from 'vitest';
import {
  ProtocolRegistry,
  createProtocolRegistry,
  ProtocolNotFoundError,
  CircularDependencyError,
  RoleMismatchError,
} from '../protocol-registry/registry';
import type { Module, GlobalProtocolDeclaration } from '../ast/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createModule(protocols: GlobalProtocolDeclaration[]): Module {
  return {
    type: 'Module',
    declarations: protocols,
  };
}

function createProtocol(
  name: string,
  roles: string[],
  body: any[] = []
): GlobalProtocolDeclaration {
  return {
    type: 'GlobalProtocolDeclaration',
    name,
    parameters: [],
    roles: roles.map(r => ({ type: 'RoleDeclaration', name: r })),
    body,
  };
}

function createDoStatement(protocolName: string, roles: string[]) {
  return {
    type: 'Do',
    protocol: protocolName,
    roleArguments: roles,
  };
}

// ============================================================================
// Basic Resolution Tests
// ============================================================================

describe('Protocol Registry - Basic Resolution', () => {
  it('should resolve a protocol by name', () => {
    const protocol = createProtocol('Test', ['A', 'B']);
    const module = createModule([protocol]);
    const registry = createProtocolRegistry(module);

    const resolved = registry.resolve('Test');

    expect(resolved).toBe(protocol);
    expect(resolved.name).toBe('Test');
    expect(resolved.roles.length).toBe(2);
  });

  it('should check protocol existence', () => {
    const protocol = createProtocol('Test', ['A', 'B']);
    const module = createModule([protocol]);
    const registry = createProtocolRegistry(module);

    expect(registry.has('Test')).toBe(true);
    expect(registry.has('NonExistent')).toBe(false);
  });

  it('should return all protocol names', () => {
    const p1 = createProtocol('Protocol1', ['A', 'B']);
    const p2 = createProtocol('Protocol2', ['C', 'D']);
    const p3 = createProtocol('Protocol3', ['E', 'F']);
    const module = createModule([p1, p2, p3]);
    const registry = createProtocolRegistry(module);

    const names = registry.getProtocolNames();

    expect(names).toHaveLength(3);
    expect(names).toContain('Protocol1');
    expect(names).toContain('Protocol2');
    expect(names).toContain('Protocol3');
  });

  it('should throw ProtocolNotFoundError for missing protocol', () => {
    const module = createModule([]);
    const registry = createProtocolRegistry(module);

    expect(() => registry.resolve('NonExistent')).toThrow(ProtocolNotFoundError);
    expect(() => registry.resolve('NonExistent')).toThrow(
      'Protocol "NonExistent" not found'
    );
  });

  it('should handle empty module', () => {
    const module = createModule([]);
    const registry = createProtocolRegistry(module);

    expect(registry.getProtocolNames()).toHaveLength(0);
    expect(registry.has('anything')).toBe(false);
  });
});

// ============================================================================
// Dependency Extraction Tests
// ============================================================================

describe('Protocol Registry - Dependency Extraction', () => {
  it('should extract direct dependencies from do statements', () => {
    const subProtocol = createProtocol('SubProtocol', ['A', 'B']);
    const mainProtocol = createProtocol('Main', ['A', 'B'], [
      createDoStatement('SubProtocol', ['A', 'B']),
    ]);

    const module = createModule([mainProtocol, subProtocol]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Main');

    expect(deps).toHaveLength(1);
    expect(deps).toContain('SubProtocol');
  });

  it('should extract multiple dependencies', () => {
    const auth = createProtocol('Auth', ['A', 'B']);
    const data = createProtocol('Data', ['A', 'B']);
    const main = createProtocol('Main', ['A', 'B'], [
      createDoStatement('Auth', ['A', 'B']),
      createDoStatement('Data', ['A', 'B']),
    ]);

    const module = createModule([main, auth, data]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Main');

    expect(deps).toHaveLength(2);
    expect(deps).toContain('Auth');
    expect(deps).toContain('Data');
  });

  it('should extract dependencies from nested choice', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const main = createProtocol('Main', ['A', 'B'], [
      {
        type: 'Choice',
        at: 'A',
        branches: [
          {
            type: 'ChoiceBranch',
            label: 'opt1',
            body: [createDoStatement('Sub', ['A', 'B'])],
          },
          {
            type: 'ChoiceBranch',
            label: 'opt2',
            body: [],
          },
        ],
      },
    ]);

    const module = createModule([main, sub]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Main');

    expect(deps).toContain('Sub');
  });

  it('should extract dependencies from parallel composition', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const main = createProtocol('Main', ['A', 'B'], [
      {
        type: 'Parallel',
        branches: [
          {
            type: 'ParallelBranch',
            body: [createDoStatement('Sub', ['A', 'B'])],
          },
          {
            type: 'ParallelBranch',
            body: [],
          },
        ],
      },
    ]);

    const module = createModule([main, sub]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Main');

    expect(deps).toContain('Sub');
  });

  it('should extract dependencies from recursion', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const main = createProtocol('Main', ['A', 'B'], [
      {
        type: 'Recursion',
        label: 'Loop',
        body: [createDoStatement('Sub', ['A', 'B'])],
      },
    ]);

    const module = createModule([main, sub]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Main');

    expect(deps).toContain('Sub');
  });

  it('should handle protocol with no dependencies', () => {
    const protocol = createProtocol('Simple', ['A', 'B'], [
      {
        type: 'MessageTransfer',
        from: 'A',
        to: 'B',
        message: { type: 'Message', label: 'msg' },
      },
    ]);

    const module = createModule([protocol]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Simple');

    expect(deps).toHaveLength(0);
  });

  it('should deduplicate repeated dependencies', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const main = createProtocol('Main', ['A', 'B'], [
      createDoStatement('Sub', ['A', 'B']),
      createDoStatement('Sub', ['A', 'B']), // Same protocol twice
      createDoStatement('Sub', ['A', 'B']),
    ]);

    const module = createModule([main, sub]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Main');

    // Should only appear once despite multiple invocations
    expect(deps).toHaveLength(1);
    expect(deps).toContain('Sub');
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Protocol Registry - Dependency Validation', () => {
  it('should validate when all dependencies exist', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const main = createProtocol('Main', ['A', 'B'], [
      createDoStatement('Sub', ['A', 'B']),
    ]);

    const module = createModule([main, sub]);
    const registry = createProtocolRegistry(module);

    const result = registry.validateDependencies();

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing dependency', () => {
    const main = createProtocol('Main', ['A', 'B'], [
      createDoStatement('MissingProtocol', ['A', 'B']),
    ]);

    const module = createModule([main]);

    // Should throw on construction (eager validation)
    expect(() => createProtocolRegistry(module)).toThrow(ProtocolNotFoundError);
    expect(() => createProtocolRegistry(module)).toThrow(
      'Protocol "MissingProtocol" not found (referenced by "Main")'
    );
  });

  it('should validate complex dependency chain', () => {
    const p1 = createProtocol('P1', ['A', 'B']);
    const p2 = createProtocol('P2', ['A', 'B'], [createDoStatement('P1', ['A', 'B'])]);
    const p3 = createProtocol('P3', ['A', 'B'], [createDoStatement('P2', ['A', 'B'])]);
    const main = createProtocol('Main', ['A', 'B'], [
      createDoStatement('P3', ['A', 'B']),
    ]);

    const module = createModule([main, p3, p2, p1]);
    const registry = createProtocolRegistry(module);

    const result = registry.validateDependencies();

    expect(result.valid).toBe(true);
  });

  it('should handle multiple protocols with dependencies', () => {
    const shared = createProtocol('Shared', ['A', 'B']);
    const p1 = createProtocol('P1', ['A', 'B'], [createDoStatement('Shared', ['A', 'B'])]);
    const p2 = createProtocol('P2', ['A', 'B'], [createDoStatement('Shared', ['A', 'B'])]);

    const module = createModule([shared, p1, p2]);
    const registry = createProtocolRegistry(module);

    const result = registry.validateDependencies();

    expect(result.valid).toBe(true);
    expect(registry.getDependencies('P1')).toContain('Shared');
    expect(registry.getDependencies('P2')).toContain('Shared');
  });
});

// ============================================================================
// Circular Dependency Detection Tests
// ============================================================================

describe('Protocol Registry - Circular Dependency Detection', () => {
  it('should detect direct circular dependency (A → A)', () => {
    const p1 = createProtocol('P1', ['A', 'B'], [
      createDoStatement('P1', ['A', 'B']), // Self-reference
    ]);

    const module = createModule([p1]);

    expect(() => createProtocolRegistry(module)).toThrow(CircularDependencyError);
    expect(() => createProtocolRegistry(module)).toThrow(/Circular dependency/);
  });

  it('should detect simple cycle (A → B → A)', () => {
    const p1 = createProtocol('P1', ['A', 'B'], [createDoStatement('P2', ['A', 'B'])]);
    const p2 = createProtocol('P2', ['A', 'B'], [createDoStatement('P1', ['A', 'B'])]);

    const module = createModule([p1, p2]);

    expect(() => createProtocolRegistry(module)).toThrow(CircularDependencyError);
  });

  it('should detect longer cycle (A → B → C → A)', () => {
    const p1 = createProtocol('P1', ['A', 'B'], [createDoStatement('P2', ['A', 'B'])]);
    const p2 = createProtocol('P2', ['A', 'B'], [createDoStatement('P3', ['A', 'B'])]);
    const p3 = createProtocol('P3', ['A', 'B'], [createDoStatement('P1', ['A', 'B'])]);

    const module = createModule([p1, p2, p3]);

    expect(() => createProtocolRegistry(module)).toThrow(CircularDependencyError);
  });

  it('should allow DAG without cycles', () => {
    // Diamond dependency: Main → A,B → Shared
    const shared = createProtocol('Shared', ['X', 'Y']);
    const a = createProtocol('A', ['X', 'Y'], [createDoStatement('Shared', ['X', 'Y'])]);
    const b = createProtocol('B', ['X', 'Y'], [createDoStatement('Shared', ['X', 'Y'])]);
    const main = createProtocol('Main', ['X', 'Y'], [
      createDoStatement('A', ['X', 'Y']),
      createDoStatement('B', ['X', 'Y']),
    ]);

    const module = createModule([main, a, b, shared]);

    // Should not throw - DAG is valid
    expect(() => createProtocolRegistry(module)).not.toThrow();

    const registry = createProtocolRegistry(module);
    const result = registry.validateDependencies();

    expect(result.valid).toBe(true);
  });

  it('should detect cycle in complex graph', () => {
    // A → B → C
    // ↑       ↓
    // └───────┘
    const a = createProtocol('A', ['X', 'Y'], [createDoStatement('B', ['X', 'Y'])]);
    const b = createProtocol('B', ['X', 'Y'], [createDoStatement('C', ['X', 'Y'])]);
    const c = createProtocol('C', ['X', 'Y'], [createDoStatement('A', ['X', 'Y'])]);

    const module = createModule([a, b, c]);

    expect(() => createProtocolRegistry(module)).toThrow(CircularDependencyError);
  });
});

// ============================================================================
// Role Mapping Tests
// ============================================================================

describe('Protocol Registry - Role Mapping', () => {
  it('should create valid role mapping', () => {
    const sub = createProtocol('Sub', ['Client', 'Server']);
    const main = createProtocol('Main', ['Alice', 'Bob']);

    const module = createModule([main, sub]);
    const registry = createProtocolRegistry(module);

    const mapping = registry.createRoleMapping('Sub', ['Alice', 'Bob']);

    expect(mapping.mapping.get('Client')).toBe('Alice');
    expect(mapping.mapping.get('Server')).toBe('Bob');
    expect(mapping.reverse.get('Alice')).toBe('Client');
    expect(mapping.reverse.get('Bob')).toBe('Server');
  });

  it('should validate role count match', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const module = createModule([sub]);
    const registry = createProtocolRegistry(module);

    const validation = registry.validateRoleMapping('Sub', ['X', 'Y']);

    expect(validation.valid).toBe(true);
  });

  it('should detect role count mismatch (too few)', () => {
    const sub = createProtocol('Sub', ['A', 'B', 'C']);
    const module = createModule([sub]);
    const registry = createProtocolRegistry(module);

    const validation = registry.validateRoleMapping('Sub', ['X', 'Y']); // Only 2 roles

    expect(validation.valid).toBe(false);
    expect(validation.errors[0].type).toBe('role-mismatch');
    expect(validation.errors[0].message).toContain('Expected 3 roles, got 2');
  });

  it('should detect role count mismatch (too many)', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const module = createModule([sub]);
    const registry = createProtocolRegistry(module);

    const validation = registry.validateRoleMapping('Sub', ['X', 'Y', 'Z']); // Too many

    expect(validation.valid).toBe(false);
    expect(validation.errors[0].type).toBe('role-mismatch');
  });

  it('should throw RoleMismatchError when creating invalid mapping', () => {
    const sub = createProtocol('Sub', ['A', 'B']);
    const module = createModule([sub]);
    const registry = createProtocolRegistry(module);

    expect(() => registry.createRoleMapping('Sub', ['X'])).toThrow(RoleMismatchError);
    expect(() => registry.createRoleMapping('Sub', ['X'])).toThrow(
      'Role count mismatch in "Sub": expected 2, got 1'
    );
  });

  it('should handle empty role lists', () => {
    const sub = createProtocol('Sub', []);
    const module = createModule([sub]);
    const registry = createProtocolRegistry(module);

    const mapping = registry.createRoleMapping('Sub', []);

    expect(mapping.mapping.size).toBe(0);
    expect(mapping.reverse.size).toBe(0);
  });

  it('should preserve role order in mapping', () => {
    const sub = createProtocol('Sub', ['First', 'Second', 'Third']);
    const module = createModule([sub]);
    const registry = createProtocolRegistry(module);

    const mapping = registry.createRoleMapping('Sub', ['A', 'B', 'C']);

    expect(mapping.mapping.get('First')).toBe('A');
    expect(mapping.mapping.get('Second')).toBe('B');
    expect(mapping.mapping.get('Third')).toBe('C');
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Protocol Registry - Edge Cases', () => {
  it('should handle protocol with only local declarations', () => {
    // Module with local protocol only (should be ignored)
    const module: Module = {
      type: 'Module',
      declarations: [
        {
          type: 'LocalProtocolDeclaration',
          name: 'LocalOnly',
          parameters: [],
          role: 'A',
          selfRole: 'A',
          body: [],
        } as any,
      ],
    };

    const registry = createProtocolRegistry(module);

    expect(registry.getProtocolNames()).toHaveLength(0);
  });

  it('should handle mixed module declarations', () => {
    const global = createProtocol('Global', ['A', 'B']);

    const module: Module = {
      type: 'Module',
      declarations: [
        { type: 'ImportDeclaration', modulePath: 'foo' } as any,
        { type: 'TypeDeclaration', name: 'MyType' } as any,
        global,
        { type: 'LocalProtocolDeclaration', name: 'Local' } as any,
      ],
    };

    const registry = createProtocolRegistry(module);

    expect(registry.getProtocolNames()).toHaveLength(1);
    expect(registry.has('Global')).toBe(true);
  });

  it('should handle protocol with complex nested structure', () => {
    const leaf = createProtocol('Leaf', ['A', 'B']);
    const mid = createProtocol('Mid', ['A', 'B'], [
      {
        type: 'Choice',
        at: 'A',
        branches: [
          {
            type: 'ChoiceBranch',
            label: 'b1',
            body: [
              {
                type: 'Parallel',
                branches: [
                  {
                    type: 'ParallelBranch',
                    body: [
                      {
                        type: 'Recursion',
                        label: 'Loop',
                        body: [createDoStatement('Leaf', ['A', 'B'])],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const module = createModule([mid, leaf]);
    const registry = createProtocolRegistry(module);

    const deps = registry.getDependencies('Mid');
    expect(deps).toContain('Leaf');
  });

  it('should handle protocol names with special characters', () => {
    const protocol = createProtocol('Protocol_v2.0', ['A', 'B']);
    const module = createModule([protocol]);
    const registry = createProtocolRegistry(module);

    expect(registry.has('Protocol_v2.0')).toBe(true);
    expect(registry.resolve('Protocol_v2.0').name).toBe('Protocol_v2.0');
  });

  it('should be immutable after construction', () => {
    const protocol = createProtocol('Test', ['A', 'B']);
    const module = createModule([protocol]);
    const registry = createProtocolRegistry(module);

    // Get protocol names
    const names1 = registry.getProtocolNames();
    const names2 = registry.getProtocolNames();

    // Should be different array instances (defensive copy)
    expect(names1).not.toBe(names2);
    expect(names1).toEqual(names2);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Protocol Registry - Integration', () => {
  it('should handle realistic protocol suite', () => {
    // Realistic example: Auth → Shared, Main → Auth + Data, Data → Shared
    const shared = createProtocol('SharedUtils', ['A', 'B']);
    const auth = createProtocol('Authentication', ['Client', 'Server'], [
      createDoStatement('SharedUtils', ['Client', 'Server']),
    ]);
    const data = createProtocol('DataTransfer', ['Sender', 'Receiver'], [
      createDoStatement('SharedUtils', ['Sender', 'Receiver']),
    ]);
    const main = createProtocol('MainProtocol', ['Alice', 'Bob'], [
      createDoStatement('Authentication', ['Alice', 'Bob']),
      createDoStatement('DataTransfer', ['Alice', 'Bob']),
    ]);

    const module = createModule([main, auth, data, shared]);
    const registry = createProtocolRegistry(module);

    // Validate structure
    expect(registry.getProtocolNames()).toHaveLength(4);

    // Validate dependencies
    expect(registry.getDependencies('MainProtocol')).toEqual(
      expect.arrayContaining(['Authentication', 'DataTransfer'])
    );
    expect(registry.getDependencies('Authentication')).toContain('SharedUtils');
    expect(registry.getDependencies('DataTransfer')).toContain('SharedUtils');
    expect(registry.getDependencies('SharedUtils')).toHaveLength(0);

    // Validate all dependencies exist
    const result = registry.validateDependencies();
    expect(result.valid).toBe(true);
  });
});
