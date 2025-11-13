/**
 * Protocol Registry and Resolution System
 *
 * Provides dependency injection and modular protocol management for sub-protocol support.
 *
 * Design Principles:
 * - Loose coupling: Protocols registered by interface, not implementation
 * - Immutable: Registry is immutable after creation
 * - Type-safe: Full TypeScript types for protocol resolution
 * - Testable: Registry can be easily mocked for testing
 *
 * Formal Properties:
 * - No circular dependencies allowed
 * - All referenced protocols must be resolvable
 * - Role counts must match at invocation site
 */

import type { GlobalProtocolDeclaration, Module } from '../ast/types';
import { buildCFG } from '../cfg/builder';
import type { CFG } from '../cfg/types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Protocol registry interface (for DI)
 */
export interface IProtocolRegistry {
  /**
   * Resolve a protocol by name
   * @throws {ProtocolNotFoundError} if protocol doesn't exist
   */
  resolve(name: string): GlobalProtocolDeclaration;

  /**
   * Check if protocol exists
   */
  has(name: string): boolean;

  /**
   * Get all protocol names
   */
  getProtocolNames(): string[];

  /**
   * Validate protocol dependencies (no circular refs)
   * @throws {CircularDependencyError} if circular dependency found
   */
  validateDependencies(): ValidationResult;

  /**
   * Get dependency graph (protocol name → dependencies)
   */
  getDependencies(name: string): string[];
}

/**
 * Protocol metadata
 */
export interface ProtocolMetadata {
  name: string;
  roles: string[];
  dependencies: string[]; // Names of protocols referenced via 'do'
  verified?: boolean;
  cfg?: CFG; // Cached CFG
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  type: 'not-found' | 'circular-dependency' | 'role-mismatch';
  protocolName: string;
  message: string;
  referencedBy?: string;
  details?: any;
}

/**
 * Role mapping for sub-protocol invocation
 */
export interface RoleMapping {
  /**
   * Maps sub-protocol formal roles to actual roles
   * Example: { "Client" => "Alice", "Server" => "Bob" }
   */
  mapping: Map<string, string>;

  /**
   * Reverse mapping (actual → formal)
   */
  reverse: Map<string, string>;
}

// ============================================================================
// Errors
// ============================================================================

export class ProtocolNotFoundError extends Error {
  constructor(
    public readonly protocolName: string,
    public readonly referencedBy?: string
  ) {
    super(
      `Protocol "${protocolName}" not found${
        referencedBy ? ` (referenced by "${referencedBy}")` : ''
      }`
    );
    this.name = 'ProtocolNotFoundError';
  }
}

export class CircularDependencyError extends Error {
  constructor(
    public readonly cycle: string[]
  ) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class RoleMismatchError extends Error {
  constructor(
    public readonly protocol: string,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(
      `Role count mismatch in "${protocol}": expected ${expected}, got ${actual}`
    );
    this.name = 'RoleMismatchError';
  }
}

// ============================================================================
// Protocol Registry Implementation
// ============================================================================

/**
 * Immutable protocol registry
 *
 * Thread-safe and suitable for concurrent simulation.
 */
export class ProtocolRegistry implements IProtocolRegistry {
  private protocols: Map<string, GlobalProtocolDeclaration>;
  private metadata: Map<string, ProtocolMetadata>;
  private dependencyGraph: Map<string, Set<string>>;

  /**
   * Create registry from module (optional)
   *
   * If no module provided, creates empty registry.
   * Use register() to add protocols manually.
   */
  constructor(module?: Module) {
    this.protocols = new Map();
    this.metadata = new Map();
    this.dependencyGraph = new Map();

    if (module) {
      // Extract all global protocols
      for (const decl of module.declarations) {
        if (decl.type === 'GlobalProtocolDeclaration') {
          this.register(decl.name, decl);
        }
      }

      // Validate on construction
      const validation = this.validateDependencies();
      if (!validation.valid) {
        const error = validation.errors[0];
        if (error.type === 'circular-dependency') {
          throw new CircularDependencyError(error.details.cycle);
        } else if (error.type === 'not-found') {
          throw new ProtocolNotFoundError(error.protocolName, error.referencedBy);
        }
      }
    }
  }

  /**
   * Register a protocol manually
   */
  register(name: string, decl: GlobalProtocolDeclaration): void {
    this.protocols.set(name, decl);

    // Extract dependencies (protocols referenced via 'do')
    const dependencies = this.extractDependencies(decl);

    this.metadata.set(name, {
      name: decl.name,
      roles: decl.roles.map(r => r.name),
      dependencies,
    });

    this.dependencyGraph.set(name, new Set(dependencies));
  }

  /**
   * Resolve protocol by name
   */
  resolve(name: string): GlobalProtocolDeclaration {
    const protocol = this.protocols.get(name);
    if (!protocol) {
      throw new ProtocolNotFoundError(name);
    }
    return protocol;
  }

  /**
   * Check if protocol exists
   */
  has(name: string): boolean {
    return this.protocols.has(name);
  }

  /**
   * Get all protocol names
   */
  getProtocolNames(): string[] {
    return Array.from(this.protocols.keys());
  }

  /**
   * Get protocol metadata
   */
  getMetadata(name: string): ProtocolMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * Get dependencies of a protocol
   */
  getDependencies(name: string): string[] {
    return Array.from(this.dependencyGraph.get(name) || []);
  }

  /**
   * Validate all dependencies
   */
  validateDependencies(): ValidationResult {
    const errors: ValidationError[] = [];

    // Check 1: All referenced protocols exist
    for (const [protocolName, deps] of this.dependencyGraph) {
      for (const dep of deps) {
        if (!this.has(dep)) {
          errors.push({
            type: 'not-found',
            protocolName: dep,
            referencedBy: protocolName,
            message: `Protocol "${dep}" not found (referenced by "${protocolName}")`,
          });
        }
      }
    }

    // Check 2: No circular dependencies (using DFS cycle detection)
    const cycles = this.detectCycles();
    for (const cycle of cycles) {
      errors.push({
        type: 'circular-dependency',
        protocolName: cycle[0],
        message: `Circular dependency: ${cycle.join(' → ')}`,
        details: { cycle },
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate role mapping for sub-protocol invocation
   */
  validateRoleMapping(
    subProtocolName: string,
    actualRoles: string[]
  ): ValidationResult {
    const errors: ValidationError[] = [];

    const subProtocol = this.resolve(subProtocolName);
    const expectedCount = subProtocol.roles.length;
    const actualCount = actualRoles.length;

    if (expectedCount !== actualCount) {
      errors.push({
        type: 'role-mismatch',
        protocolName: subProtocolName,
        message: `Expected ${expectedCount} roles, got ${actualCount}`,
        details: {
          expected: subProtocol.roles.map(r => r.name),
          actual: actualRoles,
        },
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create role mapping for sub-protocol invocation
   */
  createRoleMapping(
    subProtocolName: string,
    actualRoles: string[]
  ): RoleMapping {
    const subProtocol = this.resolve(subProtocolName);

    // Validate first
    const validation = this.validateRoleMapping(subProtocolName, actualRoles);
    if (!validation.valid) {
      throw new RoleMismatchError(
        subProtocolName,
        subProtocol.roles.length,
        actualRoles.length
      );
    }

    // Create bidirectional mapping
    const mapping = new Map<string, string>();
    const reverse = new Map<string, string>();

    for (let i = 0; i < subProtocol.roles.length; i++) {
      const formalRole = subProtocol.roles[i].name;
      const actualRole = actualRoles[i];

      mapping.set(formalRole, actualRole);
      reverse.set(actualRole, formalRole);
    }

    return { mapping, reverse };
  }

  /**
   * Build CFG for protocol (with caching)
   */
  getCFG(protocolName: string): CFG {
    const meta = this.metadata.get(protocolName);
    if (!meta) {
      throw new ProtocolNotFoundError(protocolName);
    }

    // Return cached CFG if available
    if (meta.cfg) {
      return meta.cfg;
    }

    // Build and cache
    const protocol = this.resolve(protocolName);
    const cfg = buildCFG(protocol);

    meta.cfg = cfg;
    return cfg;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Extract protocol dependencies (via 'do' statements)
   */
  private extractDependencies(protocol: GlobalProtocolDeclaration): string[] {
    const deps = new Set<string>();

    const visit = (interactions: any[]): void => {
      for (const interaction of interactions) {
        if (interaction.type === 'Do') {
          deps.add(interaction.protocol);
        } else if (interaction.type === 'Choice') {
          for (const branch of interaction.branches) {
            visit(branch.body);
          }
        } else if (interaction.type === 'Parallel') {
          for (const branch of interaction.branches) {
            visit(branch.body);
          }
        } else if (interaction.type === 'Recursion') {
          visit(interaction.body);
        }
      }
    };

    visit(protocol.body);
    return Array.from(deps);
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const deps = this.dependencyGraph.get(node) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, path);
        } else if (recStack.has(dep)) {
          // Found cycle
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart).concat(dep);
          cycles.push(cycle);
        }
      }

      path.pop();
      recStack.delete(node);
    };

    for (const protocol of this.protocols.keys()) {
      if (!visited.has(protocol)) {
        dfs(protocol, []);
      }
    }

    return cycles;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create registry from parsed module
 */
export function createProtocolRegistry(module: Module): IProtocolRegistry {
  return new ProtocolRegistry(module);
}

/**
 * Create empty registry (for testing)
 */
export function createEmptyRegistry(): IProtocolRegistry {
  return new ProtocolRegistry({ type: 'Module', declarations: [] });
}
