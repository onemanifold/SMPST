/**
 * Debug Utilities for CFSM Testing and Development
 *
 * These utilities help debug CFSM projection issues by providing:
 * - Human-readable CFSM visualization
 * - Detailed inspection of CFG/CFSM structures
 * - Comparison and diff tools
 * - Trace verification helpers
 *
 * Usage in tests:
 * ```typescript
 * const { cfsm, debug } = createDebugCFSM(protocol, 'A');
 * console.log(debug.visualize());
 * expect(debug.findTransition('s0', 'send:Msg')).toBeDefined();
 * ```
 */

import type { CFG, Node, Edge } from '../core/cfg/types';
import type { CFSM, CFSMState, CFSMTransition, CFSMAction } from '../core/projection/types';
import type { CompleteVerification } from '../core/verification/types';
import { parse } from '../core/parser/parser';
import { buildCFG } from '../core/cfg/builder';
import { verifyProtocol } from '../core/verification/verifier';
import { project, projectAll } from '../core/projection/projector';

// ============================================================================
// Types
// ============================================================================

export interface DebugCFSM {
  cfsm: CFSM;
  debug: DebugInfo;
  helpers: DebugHelpers;
}

export interface DebugInfo {
  cfgSummary: CFGSummary;
  verification: CompleteVerification;
  transitionTable: TransitionTable;
  stateSummary: StateSummary;
  visualize: () => string;
  visualizeCFG: () => string;
}

export interface DebugHelpers {
  findTransition: (from: string, actionPattern: string) => CFSMTransition | undefined;
  findTransitionsFrom: (stateId: string) => CFSMTransition[];
  findTransitionsTo: (stateId: string) => CFSMTransition[];
  getReachableStates: (from: string) => string[];
  detectCycles: () => string[][];
  verifyTrace: (trace: CFSMAction[]) => { valid: boolean; error?: string };
}

export interface CFGSummary {
  nodeCount: number;
  edgeCount: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
  roles: string[];
  nodes: Array<{ id: string; type: string }>;
  edges: Array<{ id: string; from: string; to: string; type: string }>;
}

export interface TransitionTable {
  rows: Array<{
    id: string;
    from: string;
    action: string;
    to: string;
  }>;
}

export interface StateSummary {
  total: number;
  initial: string;
  terminals: string[];
  reachable: string[];
  unreachable: string[];
}

// ============================================================================
// Main Debug Function
// ============================================================================

/**
 * Create a debuggable CFSM with full context
 *
 * This is the primary entry point for debugging CFSM issues.
 * Returns CFSM plus comprehensive debug info and helper functions.
 */
export function createDebugCFSM(protocolSource: string, role: string): DebugCFSM {
  // Parse and build CFG
  const ast = parse(protocolSource);
  const cfg = buildCFG(ast.declarations[0]);

  // Verify protocol
  const verification = verifyProtocol(cfg);

  // Project to CFSM
  const cfsm = project(cfg, role);

  // Build debug info
  const cfgSummary = summarizeCFG(cfg);
  const transitionTable = buildTransitionTable(cfsm);
  const stateSummary = summarizeStates(cfsm);

  // Build helpers
  const helpers = createHelpers(cfsm);

  return {
    cfsm,
    debug: {
      cfgSummary,
      verification,
      transitionTable,
      stateSummary,
      visualize: () => visualizeCFSM(cfsm),
      visualizeCFG: () => visualizeCFG(cfg),
    },
    helpers,
  };
}

// ============================================================================
// CFG Summary
// ============================================================================

function summarizeCFG(cfg: CFG): CFGSummary {
  const nodeTypes: Record<string, number> = {};
  const edgeTypes: Record<string, number> = {};

  // Count node types
  for (const node of cfg.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }

  // Count edge types
  for (const edge of cfg.edges) {
    edgeTypes[edge.edgeType] = (edgeTypes[edge.edgeType] || 0) + 1;
  }

  return {
    nodeCount: cfg.nodes.length,
    edgeCount: cfg.edges.length,
    nodeTypes,
    edgeTypes,
    roles: cfg.roles,
    nodes: cfg.nodes.map(n => ({ id: n.id, type: n.type })),
    edges: cfg.edges.map(e => ({ id: e.id, from: e.from, to: e.to, type: e.edgeType })),
  };
}

// ============================================================================
// State Summary
// ============================================================================

function summarizeStates(cfsm: CFSM): StateSummary {
  const reachable = computeReachableStates(cfsm, cfsm.initialState);
  const allStateIds = new Set(cfsm.states.map(s => s.id));
  const unreachable = Array.from(allStateIds).filter(id => !reachable.has(id));

  return {
    total: cfsm.states.length,
    initial: cfsm.initialState,
    terminals: cfsm.terminalStates,
    reachable: Array.from(reachable),
    unreachable,
  };
}

function computeReachableStates(cfsm: CFSM, from: string): Set<string> {
  const reachable = new Set<string>();
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const outgoing = cfsm.transitions.filter(t => t.from === current);
    for (const trans of outgoing) {
      queue.push(trans.to);
    }
  }

  return reachable;
}

// ============================================================================
// Transition Table
// ============================================================================

function buildTransitionTable(cfsm: CFSM): TransitionTable {
  return {
    rows: cfsm.transitions.map(t => ({
      id: t.id,
      from: t.from,
      action: formatAction(t.action),
      to: t.to,
    })),
  };
}

function formatAction(action: CFSMAction): string {
  if (!action) return 'τ';

  switch (action.type) {
    case 'send':
      return `!${action.to}⟨${action.label}⟩`;
    case 'receive':
      return `?${action.from}⟨${action.label}⟩`;
    case 'tau':
      return 'τ';
    case 'choice':
      return `⊕(${action.branch})`;
    default:
      return '?';
  }
}

// ============================================================================
// Visualization (ASCII Art)
// ============================================================================

/**
 * Visualize CFSM as ASCII art
 *
 * Example output:
 * ```
 * CFSM for role: Client
 *
 * [s0:initial] --[!Server⟨Request⟩]--> [s1] --[?Server⟨Response⟩]--> [s2:terminal]
 * ```
 */
export function visualizeCFSM(cfsm: CFSM): string {
  const lines: string[] = [];

  lines.push(`CFSM for role: ${cfsm.role}`);
  lines.push('');
  lines.push(`Initial: ${cfsm.initialState}`);
  lines.push(`Terminal: ${cfsm.terminalStates.join(', ')}`);
  lines.push('');

  // States
  lines.push(`States (${cfsm.states.length}):`);
  for (const state of cfsm.states) {
    const label = state.label ? ` (${state.label})` : '';
    lines.push(`  ${state.id}${label}`);
  }
  lines.push('');

  // Transitions
  lines.push(`Transitions (${cfsm.transitions.length}):`);
  for (const trans of cfsm.transitions) {
    const action = formatAction(trans.action);
    lines.push(`  ${trans.from} --[${action}]--> ${trans.to}`);
  }

  return lines.join('\n');
}

/**
 * Visualize CFG structure
 */
export function visualizeCFG(cfg: CFG): string {
  const lines: string[] = [];

  lines.push(`CFG for protocol: ${cfg.protocolName || 'unnamed'}`);
  lines.push(`Roles: ${cfg.roles.join(', ')}`);
  lines.push('');

  // Nodes
  lines.push(`Nodes (${cfg.nodes.length}):`);
  for (const node of cfg.nodes) {
    let desc = `  ${node.id}: ${node.type}`;
    if (node.type === 'action' && 'action' in node) {
      const action = (node as any).action;
      if (action && 'from' in action && 'to' in action) {
        desc += ` [${action.from} → ${action.to}: ${action.label}]`;
      }
    }
    lines.push(desc);
  }
  lines.push('');

  // Edges
  lines.push(`Edges (${cfg.edges.length}):`);
  for (const edge of cfg.edges) {
    lines.push(`  ${edge.from} --[${edge.edgeType}]--> ${edge.to}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

function createHelpers(cfsm: CFSM): DebugHelpers {
  return {
    findTransition: (from: string, actionPattern: string) => {
      return cfsm.transitions.find(t =>
        t.from === from && formatAction(t.action).includes(actionPattern)
      );
    },

    findTransitionsFrom: (stateId: string) => {
      return cfsm.transitions.filter(t => t.from === stateId);
    },

    findTransitionsTo: (stateId: string) => {
      return cfsm.transitions.filter(t => t.to === stateId);
    },

    getReachableStates: (from: string) => {
      return Array.from(computeReachableStates(cfsm, from));
    },

    detectCycles: () => {
      return detectCyclesInCFSM(cfsm);
    },

    verifyTrace: (trace: CFSMAction[]) => {
      return verifyExecutionTrace(cfsm, trace);
    },
  };
}

/**
 * Detect cycles in CFSM using DFS
 */
function detectCyclesInCFSM(cfsm: CFSM): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack: string[] = [];

  function dfs(stateId: string): boolean {
    visited.add(stateId);
    recStack.push(stateId);

    const outgoing = cfsm.transitions.filter(t => t.from === stateId);
    for (const trans of outgoing) {
      const target = trans.to;

      if (!visited.has(target)) {
        if (dfs(target)) return true;
      } else if (recStack.includes(target)) {
        // Found cycle
        const cycleStart = recStack.indexOf(target);
        const cycle = recStack.slice(cycleStart);
        cycles.push(cycle);
      }
    }

    recStack.pop();
    return false;
  }

  // Start DFS from initial state
  dfs(cfsm.initialState);

  return cycles;
}

/**
 * Verify that a sequence of actions is valid in the CFSM
 */
function verifyExecutionTrace(cfsm: CFSM, trace: CFSMAction[]): { valid: boolean; error?: string } {
  let currentState = cfsm.initialState;

  for (let i = 0; i < trace.length; i++) {
    const action = trace[i];
    const actionStr = formatAction(action);

    // Find transition with this action from current state
    const transition = cfsm.transitions.find(t =>
      t.from === currentState && formatAction(t.action) === actionStr
    );

    if (!transition) {
      return {
        valid: false,
        error: `No transition from ${currentState} with action ${actionStr}`,
      };
    }

    currentState = transition.to;
  }

  return { valid: true };
}

// ============================================================================
// Snapshot Formatting
// ============================================================================

/**
 * Generate human-readable snapshot of CFSM
 * Use with vitest snapshots: expect(snapshotCFSM(cfsm)).toMatchSnapshot()
 */
export function snapshotCFSM(cfsm: CFSM): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push(`CFSM SNAPSHOT: ${cfsm.role}`);
  lines.push('═'.repeat(60));
  lines.push('');

  lines.push(`Initial State: ${cfsm.initialState}`);
  lines.push(`Terminal States: ${cfsm.terminalStates.join(', ')}`);
  lines.push('');

  lines.push(`States (${cfsm.states.length}):`);
  lines.push('─'.repeat(40));
  for (const state of cfsm.states) {
    const label = state.label ? ` │ label: ${state.label}` : '';
    lines.push(`  ${state.id}${label}`);
  }
  lines.push('');

  lines.push(`Transitions (${cfsm.transitions.length}):`);
  lines.push('─'.repeat(40));
  for (const trans of cfsm.transitions) {
    const action = formatAction(trans.action);
    lines.push(`  ${trans.from} --[${action}]--> ${trans.to}`);
  }
  lines.push('');
  lines.push('═'.repeat(60));

  return lines.join('\n');
}

/**
 * Compare two CFSMs and find differences
 */
export interface CFSMDiff {
  missingStates: string[];
  extraStates: string[];
  missingTransitions: string[];
  extraTransitions: string[];
  actionMismatches: Array<{
    transitionId: string;
    expected: string;
    actual: string;
  }>;
}

export function diffCFSM(expected: CFSM, actual: CFSM): CFSMDiff {
  const expectedStates = new Set(expected.states.map(s => s.id));
  const actualStates = new Set(actual.states.map(s => s.id));

  const missingStates = Array.from(expectedStates).filter(id => !actualStates.has(id));
  const extraStates = Array.from(actualStates).filter(id => !expectedStates.has(id));

  const expectedTrans = new Set(expected.transitions.map(t => `${t.from}->${t.to}`));
  const actualTrans = new Set(actual.transitions.map(t => `${t.from}->${t.to}`));

  const missingTransitions = Array.from(expectedTrans).filter(t => !actualTrans.has(t));
  const extraTransitions = Array.from(actualTrans).filter(t => !expectedTrans.has(t));

  const actionMismatches: CFSMDiff['actionMismatches'] = [];
  for (const expTrans of expected.transitions) {
    const actTrans = actual.transitions.find(t =>
      t.from === expTrans.from && t.to === expTrans.to
    );
    if (actTrans) {
      const expAction = formatAction(expTrans.action);
      const actAction = formatAction(actTrans.action);
      if (expAction !== actAction) {
        actionMismatches.push({
          transitionId: `${expTrans.from}->${expTrans.to}`,
          expected: expAction,
          actual: actAction,
        });
      }
    }
  }

  return {
    missingStates,
    extraStates,
    missingTransitions,
    extraTransitions,
    actionMismatches,
  };
}

// ============================================================================
// CLI Inspector (for manual debugging)
// ============================================================================

/**
 * CLI-friendly inspector for debugging CFSM issues
 *
 * Usage:
 * ```typescript
 * const inspector = new CFSMInspector();
 * const report = inspector.inspect(protocolSource, 'Client');
 * console.log(report);
 * ```
 */
export class CFSMInspector {
  inspect(protocolSource: string, role: string) {
    const { cfsm, debug, helpers } = createDebugCFSM(protocolSource, role);

    const cycles = helpers.detectCycles();
    const reachable = helpers.getReachableStates(cfsm.initialState);

    return {
      role,
      summary: {
        states: cfsm.states.length,
        transitions: cfsm.transitions.length,
        hasCycles: cycles.length > 0,
        cycleCount: cycles.length,
        reachableStates: reachable.length,
        unreachableStates: cfsm.states.length - reachable.length,
      },
      verification: {
        isValid: debug.verification.structural.isValid,
        hasDeadlock: debug.verification.deadlock.hasCycles,
        errors: this.extractErrors(debug.verification),
      },
      visualization: debug.visualize(),
      cfgVisualization: debug.visualizeCFG(),
      cycles,
      transitionTable: debug.transitionTable.rows,
    };
  }

  private extractErrors(verification: CompleteVerification): string[] {
    const errors: string[] = [];

    if (!verification.structural.isValid) {
      errors.push('Structural validation failed');
    }
    if (verification.deadlock.hasCycles) {
      errors.push(`Deadlock detected: ${verification.deadlock.cycles.length} cycles`);
    }
    if (verification.race.hasRaces) {
      errors.push(`Race conditions detected: ${verification.race.races.length} races`);
    }

    return errors;
  }
}
