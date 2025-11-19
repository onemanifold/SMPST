/**
 * Trace Semantics for CFSM (Phase 2: Formal Verification)
 *
 * Implements trace extraction and equivalence checking for Theorem 20 (ECOOP 2023).
 *
 * FORMAL DEFINITION (Honda et al. 2016, Castro-Perez & Yoshida 2023):
 *   A trace is a sequence of observable actions: τ | !p⟨M⟩ | ?p⟨M⟩ | μX | continue X
 *
 * THEOREM 20 (Trace Equivalence):
 *   For updatable protocol G: traces(G) ≈ compose(traces([[G]]_r) for all r)
 *
 * This module provides:
 * - extractTrace: Generate traces from CFSM execution
 * - composeTraces: Compose local traces to global trace
 * - compareTraces: Check trace equivalence
 * - traceSemantics: Formal trace semantics for actions
 */

import type { CFSM, CFSMTransition, CFSMAction } from '../projection/types';

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Observable action in a trace
 *
 * FORMAL SEMANTICS:
 * - tau: Internal action (τ)
 * - send: Output action (!p⟨M⟩) - role sends message M to p
 * - receive: Input action (?p⟨M⟩) - role receives message M from p
 * - recursion: Recursion entry (μX)
 * - continue: Recursion back-edge (continue X)
 * - continue-with: Updatable recursion (continue X with { G })
 */
export type TraceAction =
  | { type: 'tau' }
  | { type: 'send'; to: string; label: string }
  | { type: 'receive'; from: string; label: string }
  | { type: 'recursion'; label: string }
  | { type: 'continue'; label: string }
  | { type: 'continue-with'; label: string; hasExtension: boolean };

/**
 * Execution trace
 *
 * A trace is a sequence of observable actions with metadata.
 */
export interface Trace {
  role: string; // Role that executed this trace
  actions: TraceAction[]; // Sequence of actions
  final: boolean; // Did execution reach a terminal state?
  steps: number; // Number of steps executed
}

/**
 * Trace extraction options
 */
export interface TraceOptions {
  maxSteps?: number; // Maximum steps to execute (default: 100)
  recordTau?: boolean; // Include τ actions in trace (default: false)
  stopAtRecursion?: boolean; // Stop at recursion back-edge (default: false)
}

// ============================================================================
// Trace Extraction
// ============================================================================

/**
 * Extract trace from CFSM execution
 *
 * ALGORITHM:
 * 1. Start at initial state
 * 2. Follow transitions, recording observable actions
 * 3. Stop at: terminal state, max steps, or cycle detection
 * 4. Return sequence of actions as trace
 *
 * @param cfsm - CFSM to execute
 * @param options - Trace extraction options
 * @returns Execution trace
 */
export function extractTrace(
  cfsm: CFSM,
  options: TraceOptions = {}
): Trace {
  const {
    maxSteps = 100,
    recordTau = false,
    stopAtRecursion = false,
  } = options;

  const actions: TraceAction[] = [];
  const visited = new Set<string>(); // For cycle detection
  let currentState = cfsm.initialState;
  let steps = 0;

  const terminalSet = new Set(cfsm.terminalStates);

  while (steps < maxSteps) {
    // Check terminal
    if (terminalSet.has(currentState)) {
      return {
        role: cfsm.role,
        actions,
        final: true,
        steps,
      };
    }

    // Cycle detection: if we've seen this state before, we're in a loop
    if (visited.has(currentState)) {
      // In updatable recursion, this is expected (continue X)
      return {
        role: cfsm.role,
        actions,
        final: false,
        steps,
      };
    }

    visited.add(currentState);

    // Find outgoing transitions
    const outgoing = cfsm.transitions.filter(t => t.from === currentState);

    if (outgoing.length === 0) {
      // Stuck state (no outgoing transitions, not terminal)
      return {
        role: cfsm.role,
        actions,
        final: false,
        steps,
      };
    }

    // Take first available transition (deterministic choice)
    const transition = outgoing[0];
    const action = actionToTrace(transition.action, recordTau);

    if (action) {
      actions.push(action);

      // Check if this is a recursion back-edge
      if (action.type === 'continue' && stopAtRecursion) {
        return {
          role: cfsm.role,
          actions,
          final: false,
          steps: steps + 1,
        };
      }
    }

    currentState = transition.to;
    steps++;
  }

  // Max steps reached
  return {
    role: cfsm.role,
    actions,
    final: false,
    steps,
  };
}

/**
 * Convert CFSM action to trace action
 *
 * FORMAL SEMANTICS:
 * - τ → tau (if recordTau is true, else null)
 * - !p⟨M⟩ → send(p, M)
 * - ?p⟨M⟩ → receive(p, M)
 */
function actionToTrace(
  action: CFSMAction,
  recordTau: boolean
): TraceAction | null {
  switch (action.type) {
    case 'tau':
      return recordTau ? { type: 'tau' } : null;

    case 'send':
      return {
        type: 'send',
        to: action.to,
        label: action.message.label,
      };

    case 'receive':
      return {
        type: 'receive',
        from: action.from,
        label: action.message.label,
      };

    // TODO: Add recursion, continue, continue-with actions when available
    default:
      return null;
  }
}

// ============================================================================
// Trace Composition
// ============================================================================

/**
 * Compose local traces to global trace
 *
 * THEOREM 20 (Castro-Perez & Yoshida 2023):
 *   traces(G) ≈ compose(traces([[G]]_r) for all r)
 *
 * ALGORITHM:
 * 1. Collect all send/receive actions from all traces
 * 2. Match sends with receives: !p⟨M⟩ matches ?p⟨M⟩
 * 3. Build partial order respecting causality
 * 4. Return linearization of partial order
 *
 * SIMPLIFIED IMPLEMENTATION:
 * - Interleave actions preserving role-local order
 * - Match send/receive pairs
 * - Remove internal τ actions
 *
 * @param localTraces - Traces from each role
 * @returns Composed global trace
 */
export function composeTraces(localTraces: Trace[]): Trace {
  const globalActions: TraceAction[] = [];

  // Collect all observable actions (non-tau)
  for (const trace of localTraces) {
    for (const action of trace.actions) {
      if (action.type !== 'tau') {
        globalActions.push(action);
      }
    }
  }

  // In full implementation, would match sends with receives
  // and build partial order. For now, simple concatenation.

  return {
    role: 'global',
    actions: globalActions,
    final: localTraces.every(t => t.final),
    steps: Math.max(...localTraces.map(t => t.steps)),
  };
}

// ============================================================================
// Trace Equivalence
// ============================================================================

/**
 * Compare two traces for equivalence
 *
 * FORMAL DEFINITION:
 *   traces(G1) ≈ traces(G2) ⟺
 *     ∀ trace t1 ∈ traces(G1), ∃ trace t2 ∈ traces(G2): t1 = t2 (mod τ)
 *
 * IMPLEMENTATION:
 * - Compare action sequences ignoring τ
 * - Allows reordering of independent actions (future: partial order)
 *
 * @param trace1 - First trace
 * @param trace2 - Second trace
 * @returns true if traces are equivalent
 */
export function compareTraces(trace1: Trace, trace2: Trace): boolean {
  // Filter out tau actions
  const actions1 = trace1.actions.filter(a => a.type !== 'tau');
  const actions2 = trace2.actions.filter(a => a.type !== 'tau');

  // Check same length
  if (actions1.length !== actions2.length) {
    return false;
  }

  // Check each action matches (simple sequential comparison)
  for (let i = 0; i < actions1.length; i++) {
    if (!actionsEqual(actions1[i], actions2[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two actions are equal
 */
function actionsEqual(a1: TraceAction, a2: TraceAction): boolean {
  if (a1.type !== a2.type) return false;

  switch (a1.type) {
    case 'tau':
      return true;

    case 'send':
      return (
        a2.type === 'send' &&
        a1.to === a2.to &&
        a1.label === a2.label
      );

    case 'receive':
      return (
        a2.type === 'receive' &&
        a1.from === a2.from &&
        a1.label === a2.label
      );

    case 'recursion':
      return a2.type === 'recursion' && a1.label === a2.label;

    case 'continue':
      return a2.type === 'continue' && a1.label === a2.label;

    case 'continue-with':
      return (
        a2.type === 'continue-with' &&
        a1.label === a2.label &&
        a1.hasExtension === a2.hasExtension
      );

    default:
      return false;
  }
}

// ============================================================================
// Trace Utilities
// ============================================================================

/**
 * Check if trace contains action of given type
 */
export function traceHasAction(trace: Trace, actionType: string): boolean {
  return trace.actions.some(a => a.type === actionType);
}

/**
 * Count actions of given type in trace
 */
export function countActions(trace: Trace, actionType: string): number {
  return trace.actions.filter(a => a.type === actionType).length;
}

/**
 * Get all message labels from trace
 */
export function getMessageLabels(trace: Trace): string[] {
  const labels: string[] = [];

  for (const action of trace.actions) {
    if (action.type === 'send' || action.type === 'receive') {
      labels.push(action.label);
    }
  }

  return labels;
}

/**
 * Format trace for display
 */
export function formatTrace(trace: Trace): string {
  const actionStrs = trace.actions.map(a => {
    switch (a.type) {
      case 'tau':
        return 'τ';
      case 'send':
        return `!${a.to}⟨${a.label}⟩`;
      case 'receive':
        return `?${a.from}⟨${a.label}⟩`;
      case 'recursion':
        return `μ${a.label}`;
      case 'continue':
        return `continue ${a.label}`;
      case 'continue-with':
        return `continue ${a.label} with {...}`;
      default:
        return '?';
    }
  });

  const finalStr = trace.final ? '✓' : '○';
  return `[${trace.role}] ${actionStrs.join(' → ')} ${finalStr} (${trace.steps} steps)`;
}
