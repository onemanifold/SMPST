/**
 * Safety API - Clean interface for frontend to check protocol safety
 *
 * This module provides a simple, high-level API for the frontend to:
 * 1. Parse Scribble protocols
 * 2. Check safety properties
 * 3. Get detailed violation information
 * 4. Execute protocols step-by-step
 *
 * Usage:
 * ```typescript
 * import { checkProtocolSafety, executeProtocol } from './core/safety-api';
 *
 * const result = checkProtocolSafety(protocolCode);
 * if (!result.safe) {
 *   console.log(result.violations);
 * }
 * ```
 */

import { parse } from './parser/parser';
import { buildCFG } from './cfg/builder';
import { projectAll } from './projection/projector';
import { BasicSafety } from './safety/safety-checker';
import { ContextReducer } from './safety/context-reducer';
import { createInitialContext } from './safety/utils';

import type {
  SafetyCheckResult,
  SafetyViolation,
  TypingContext,
  Communication,
} from './safety/types';
import type { CFSM } from './projection/types';

// ============================================================================
// Public API Types
// ============================================================================

/**
 * Result of parsing and checking a protocol
 */
export interface ProtocolCheckResult {
  /** Whether the protocol is safe */
  safe: boolean;

  /** Violations found (empty if safe) */
  violations: SafetyViolation[];

  /** Protocol metadata */
  protocol: {
    /** Protocol name */
    name: string;

    /** Role names */
    roles: string[];
  };

  /** State space metrics */
  metrics: {
    /** Number of states explored during safety check */
    statesExplored: number;

    /** Time taken for safety check (ms) */
    checkTime: number;

    /** Number of roles in protocol */
    roleCount: number;

    /** Total number of CFSM states across all roles */
    totalCFSMStates: number;
  };

  /** CFSMs for each role (for visualization) */
  cfsms: Map<string, CFSM>;
}

/**
 * Execution trace of a protocol
 */
export interface ProtocolTrace {
  /** Sequence of contexts from initial to final */
  contexts: TypingContext[];

  /** Communications that occurred */
  communications: Communication[];

  /** Whether execution reached terminal state */
  completed: boolean;

  /** Execution steps taken */
  steps: number;
}

/**
 * Error that can occur during parsing/checking
 */
export interface ProtocolError {
  /** Error type */
  type: 'parse' | 'projection' | 'safety' | 'execution';

  /** Human-readable message */
  message: string;

  /** Location in source code (if available) */
  location?: {
    line: number;
    column: number;
  };
}

// ============================================================================
// Main API Functions
// ============================================================================

/**
 * Check if a protocol is safe
 *
 * This is the main entry point for frontend safety checking.
 * Parses the protocol, projects to CFSMs, and runs safety check.
 *
 * @param protocolCode - Scribble protocol source code
 * @returns Check result with safety status and violations
 *
 * @example
 * ```typescript
 * const result = checkProtocolSafety(`
 *   protocol OAuth(role s, role c, role a) {
 *     choice at s {
 *       s -> c: login();
 *       c -> a: passwd(Str);
 *       a -> s: auth(Bool);
 *     } or {
 *       s -> c: cancel();
 *       c -> a: quit();
 *     }
 *   }
 * `);
 *
 * if (result.safe) {
 *   console.log('Protocol is safe!');
 * } else {
 *   console.log('Violations:', result.violations);
 * }
 * ```
 */
export function checkProtocolSafety(
  protocolCode: string
): ProtocolCheckResult | ProtocolError {
  try {
    // Parse protocol
    const ast = parse(protocolCode);

    if (!ast.declarations || ast.declarations.length === 0) {
      return {
        type: 'parse',
        message: 'No protocol declarations found',
      };
    }

    const protocolDecl = ast.declarations[0] as any;

    // Build CFG
    const cfg = buildCFG(protocolDecl);

    // Project to CFSMs
    const projectionResult = projectAll(cfg);

    if (projectionResult.errors.length > 0) {
      return {
        type: 'projection',
        message: `Projection errors: ${projectionResult.errors.map(e => e.message).join(', ')}`,
      };
    }

    const cfsms = projectionResult.cfsms;

    // Create initial context
    const context = createInitialContext(cfsms, protocolDecl.name);

    // Run safety check
    const checker = new BasicSafety();
    const safetyResult = checker.check(context);

    // Calculate metrics
    const totalCFSMStates = Array.from(cfsms.values()).reduce(
      (sum, cfsm) => sum + cfsm.states.length,
      0
    );

    return {
      safe: safetyResult.safe,
      violations: safetyResult.violations,
      protocol: {
        name: protocolDecl.name,
        roles: protocolDecl.roles.map((r: any) => r.name),
      },
      metrics: {
        statesExplored: safetyResult.diagnostics?.statesExplored || 0,
        checkTime: safetyResult.diagnostics?.checkTime || 0,
        roleCount: cfsms.size,
        totalCFSMStates,
      },
      cfsms,
    };
  } catch (error: any) {
    return {
      type: 'parse',
      message: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Execute a protocol step-by-step
 *
 * Useful for visualization and debugging. Returns the complete execution trace.
 *
 * @param protocolCode - Scribble protocol source code
 * @param maxSteps - Maximum steps to prevent infinite loops (default 1000)
 * @returns Execution trace or error
 *
 * @example
 * ```typescript
 * const trace = executeProtocol(protocolCode);
 * if ('type' in trace) {
 *   console.error('Error:', trace.message);
 * } else {
 *   console.log(`Executed ${trace.steps} steps`);
 *   trace.communications.forEach(c => {
 *     console.log(`${c.sender} -> ${c.receiver}: ${c.message}`);
 *   });
 * }
 * ```
 */
export function executeProtocol(
  protocolCode: string,
  maxSteps: number = 1000
): ProtocolTrace | ProtocolError {
  try {
    // Parse and project
    const ast = parse(protocolCode);

    if (!ast.declarations || ast.declarations.length === 0) {
      return {
        type: 'parse',
        message: 'No protocol declarations found',
      };
    }

    const protocolDecl = ast.declarations[0] as any;
    const cfg = buildCFG(protocolDecl);
    const projectionResult = projectAll(cfg);

    if (projectionResult.errors.length > 0) {
      return {
        type: 'projection',
        message: `Projection errors: ${projectionResult.errors.map(e => e.message).join(', ')}`,
      };
    }

    const cfsms = projectionResult.cfsms;
    const context = createInitialContext(cfsms, protocolDecl.name);

    // Execute protocol
    const reducer = new ContextReducer();
    const contexts: TypingContext[] = [context];
    const communications: Communication[] = [];

    let current = context;
    let steps = 0;

    while (!reducer.isTerminal(current) && steps < maxSteps) {
      const enabled = reducer.findEnabledCommunications(current);

      if (enabled.stuck) {
        return {
          type: 'execution',
          message: `Protocol stuck at step ${steps} (no enabled communications)`,
        };
      }

      // Pick first communication (deterministic for now)
      const comm = enabled.communications[0];
      communications.push(comm);

      current = reducer.reduceBy(current, comm);
      contexts.push(current);
      steps++;
    }

    if (steps >= maxSteps) {
      return {
        type: 'execution',
        message: `Execution exceeded maximum steps (${maxSteps})`,
      };
    }

    return {
      contexts,
      communications,
      completed: reducer.isTerminal(current),
      steps,
    };
  } catch (error: any) {
    return {
      type: 'parse',
      message: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Get CFSMs for a protocol without running safety check
 *
 * Useful for visualization.
 *
 * @param protocolCode - Scribble protocol source code
 * @returns Map of role → CFSM, or error
 */
export function getProtocolCFSMs(
  protocolCode: string
): Map<string, CFSM> | ProtocolError {
  try {
    const ast = parse(protocolCode);

    if (!ast.declarations || ast.declarations.length === 0) {
      return {
        type: 'parse',
        message: 'No protocol declarations found',
      };
    }

    const protocolDecl = ast.declarations[0] as any;
    const cfg = buildCFG(protocolDecl);
    const projectionResult = projectAll(cfg);

    if (projectionResult.errors.length > 0) {
      return {
        type: 'projection',
        message: `Projection errors: ${projectionResult.errors.map(e => e.message).join(', ')}`,
      };
    }

    return projectionResult.cfsms;
  } catch (error: any) {
    return {
      type: 'parse',
      message: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Check if a specific role's CFSM is safe in the context
 *
 * Advanced API for per-role safety checking.
 *
 * @param protocolCode - Scribble protocol source code
 * @param role - Role name to check
 * @returns CFSM for role or error
 */
export function getRoleCFSM(
  protocolCode: string,
  role: string
): CFSM | ProtocolError {
  const cfsmsOrError = getProtocolCFSMs(protocolCode);

  if ('type' in cfsmsOrError) {
    return cfsmsOrError;
  }

  const cfsm = cfsmsOrError.get(role);
  if (!cfsm) {
    return {
      type: 'projection',
      message: `Role '${role}' not found in protocol`,
    };
  }

  return cfsm;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a violation for display
 */
export function formatViolation(violation: SafetyViolation): string {
  const roles = violation.roles.join(', ');

  switch (violation.type) {
    case 'send-receive-mismatch':
      return `Send/receive mismatch: ${violation.message}`;

    case 'orphan-receive':
      return `Orphan receive: ${violation.message}`;

    case 'type-mismatch':
      return `Type mismatch: ${violation.message}`;

    case 'stuck-state':
      return `Stuck state: ${violation.message}`;

    default:
      return violation.message;
  }
}

/**
 * Format a communication for display
 */
export function formatCommunication(comm: Communication): string {
  return `${comm.sender} → ${comm.receiver}: ${comm.message}${
    comm.payloadType ? `(${comm.payloadType})` : ''
  }`;
}

/**
 * Get summary statistics for a protocol
 */
export function getProtocolStats(protocolCode: string): {
  roles: number;
  states: number;
  transitions: number;
} | ProtocolError {
  const cfsmsOrError = getProtocolCFSMs(protocolCode);

  if ('type' in cfsmsOrError) {
    return cfsmsOrError;
  }

  const cfsms = Array.from(cfsmsOrError.values());

  return {
    roles: cfsms.length,
    states: cfsms.reduce((sum, cfsm) => sum + cfsm.states.length, 0),
    transitions: cfsms.reduce((sum, cfsm) => sum + cfsm.transitions.length, 0),
  };
}
