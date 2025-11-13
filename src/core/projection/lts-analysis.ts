/**
 * LTS Analysis Helper Functions for CFSM Theorem Testing
 *
 * This module provides pure functions for analyzing CFSM properties using
 * only LTS (Labeled Transition System) primitives: states and transitions.
 *
 * FORMAL BASIS:
 * A CFSM is an LTS M = (Q, q₀, A, →) where:
 * - Q: states
 * - q₀: initial state
 * - A: actions {send, receive, tau}
 * - →: transition relation Q × A × Q
 *
 * All theorem properties (completeness, soundness, composability) can be
 * expressed using these primitives. NO CFG structure is needed.
 *
 * @reference Deniélou, P.-M., & Yoshida, N. (2012). Multiparty Session Types
 *            Meet Communicating Automata. ESOP 2012.
 * @module lts-analysis
 */

import type { CFSM, CFSMTransition, CFSMAction } from './types';

// ============================================================================
// BRANCHING ANALYSIS
// ============================================================================

/**
 * Find states with multiple outgoing transitions (branching points)
 *
 * FORMAL DEFINITION:
 * A state q ∈ Q is a branching point if:
 *   |{(q, a, q') ∈ → | a ≠ τ}| > 1
 *
 * In session types, branching represents CHOICE:
 * - Internal choice: sender decides which branch to take
 * - External choice: receiver reacts to sender's choice
 *
 * EXAMPLE:
 *   choice at Client {
 *     Client -> Server: Login();
 *   } or {
 *     Client -> Server: Register();
 *   }
 *
 * Projects to Client CFSM with branching state:
 *   q₀ --!Login--> q₁
 *   q₀ --!Register--> q₂
 *
 * WHY EXCLUDE TAU:
 * Tau transitions represent internal/silent moves that don't correspond
 * to observable actions. True choice involves observable actions only.
 *
 * @param cfsm - CFSM to analyze
 * @returns Array of state IDs that are branching points
 *
 * @tutorial For teaching: A branching state is like a fork in the road.
 *           The protocol can go multiple different ways from here, and
 *           each path represents a different choice in the protocol.
 */
export function findBranchingStates(cfsm: CFSM): string[] {
  const branchingStates: string[] = [];

  for (const state of cfsm.states) {
    // Count non-tau outgoing transitions
    const outgoing = cfsm.transitions.filter(t =>
      t.from === state.id && t.action.type !== 'tau'
    );

    // If multiple observable actions possible, this is a branch point
    if (outgoing.length > 1) {
      branchingStates.push(state.id);
    }
  }

  return branchingStates;
}

/**
 * Find states with multiple incoming transitions (merge points)
 *
 * FORMAL DEFINITION:
 * A state q ∈ Q is a merge point if:
 *   |{(q', a, q) ∈ → | a ≠ τ}| > 1
 *
 * Merge points represent where different choice branches reconverge.
 *
 * EXAMPLE:
 *   choice at Client {
 *     Client -> Server: A();
 *     Server -> Client: Response();
 *   } or {
 *     Client -> Server: B();
 *     Server -> Client: Response();
 *   }
 *
 * Both branches end with Response, so they merge at the state after Response.
 *
 * @param cfsm - CFSM to analyze
 * @returns Array of state IDs that are merge points
 *
 * @tutorial For teaching: A merge point is where multiple paths come back
 *           together. Think of it as paths converging after a fork.
 */
export function findMergeStates(cfsm: CFSM): string[] {
  const mergeStates: string[] = [];

  for (const state of cfsm.states) {
    // Count non-tau incoming transitions
    const incoming = cfsm.transitions.filter(t =>
      t.to === state.id && t.action.type !== 'tau'
    );

    // If multiple paths lead here, this is a merge point
    if (incoming.length > 1) {
      mergeStates.push(state.id);
    }
  }

  return mergeStates;
}

// ============================================================================
// RECURSION ANALYSIS
// ============================================================================

/**
 * Detect cycles in CFSM transition graph (recursion)
 *
 * FORMAL DEFINITION:
 * A CFSM has a cycle if there exists a path:
 *   q₀ →* q →+ q  (where →* is zero-or-more transitions, →+ is one-or-more)
 *
 * In session types, cycles represent RECURSION:
 *   rec X { ... continue X; }
 *
 * ALGORITHM: Depth-First Search with recursion stack
 * - visited: states we've seen (for termination)
 * - recStack: states currently on DFS path (for cycle detection)
 * - Back-edge: transition to state in recStack = cycle found
 *
 * WHY THIS WORKS:
 * A back-edge (u, v) where v is an ancestor of u in DFS tree
 * indicates a cycle from v to v through u.
 *
 * @param cfsm - CFSM to analyze
 * @returns true if CFSM contains any cycles
 *
 * @tutorial For teaching: Imagine walking through the protocol states.
 *           If you ever arrive at a state you're currently visiting
 *           (in your current path), you've found a loop/recursion.
 */
export function hasCycles(cfsm: CFSM): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  const dfs = (stateId: string): boolean => {
    visited.add(stateId);
    recStack.add(stateId);

    // Check all outgoing transitions
    const outgoing = cfsm.transitions.filter(t => t.from === stateId);
    for (const trans of outgoing) {
      const nextState = trans.to;

      // Haven't visited yet? Recurse
      if (!visited.has(nextState)) {
        if (dfs(nextState)) {
          return true; // Cycle found in subtree
        }
      }
      // Already on recursion stack? Back-edge = cycle!
      else if (recStack.has(nextState)) {
        return true;
      }
    }

    // Done exploring from this state, remove from recursion stack
    recStack.delete(stateId);
    return false;
  };

  // Start DFS from initial state
  return dfs(cfsm.initialState);
}

/**
 * Find all back-edges (transitions that form cycles)
 *
 * FORMAL DEFINITION:
 * A transition (q, a, q') is a back-edge if q' is visited before q
 * in a depth-first traversal starting from q₀.
 *
 * Back-edges correspond to "continue" statements in session types that
 * jump back to recursion entry points.
 *
 * IMPLEMENTATION:
 * Uses state ordering from BFS traversal. If target state has lower
 * order than source state, it's likely a back-edge.
 *
 * @param cfsm - CFSM to analyze
 * @returns Array of transitions that are back-edges
 *
 * @tutorial For teaching: A back-edge is like a "goto" that jumps
 *           backwards in the protocol flow, creating a loop.
 */
export function findBackEdges(cfsm: CFSM): CFSMTransition[] {
  // Assign order to states based on BFS from initial state
  const stateOrder = new Map<string, number>();
  const queue = [cfsm.initialState];
  const visited = new Set<string>();
  let order = 0;

  while (queue.length > 0) {
    const stateId = queue.shift()!;
    if (visited.has(stateId)) continue;
    visited.add(stateId);

    stateOrder.set(stateId, order++);

    // Add successors to queue
    const outgoing = cfsm.transitions.filter(t => t.from === stateId);
    for (const trans of outgoing) {
      if (!visited.has(trans.to)) {
        queue.push(trans.to);
      }
    }
  }

  // Find transitions where target has lower order than source
  const backEdges: CFSMTransition[] = [];
  for (const trans of cfsm.transitions) {
    const fromOrder = stateOrder.get(trans.from) ?? Infinity;
    const toOrder = stateOrder.get(trans.to) ?? Infinity;

    // Back-edge: points to earlier state
    if (toOrder <= fromOrder && toOrder !== Infinity) {
      backEdges.push(trans);
    }
  }

  return backEdges;
}

// ============================================================================
// TRACE ANALYSIS
// ============================================================================

/**
 * Extract all possible execution traces from CFSM
 *
 * FORMAL DEFINITION:
 * A trace is a sequence of actions a₁, a₂, ..., aₙ such that:
 *   q₀ --a₁--> q₁ --a₂--> ... --aₙ--> qₙ ∈ Q_term
 *
 * where Q_term is the set of terminal states.
 *
 * TRACE SEMANTICS:
 * The behavior of a protocol is characterized by its set of traces.
 * Two protocols are equivalent if they have the same traces.
 *
 * LIMITATION:
 * For CFSMs with cycles, there are infinitely many traces.
 * This function returns traces up to a bounded depth.
 *
 * @param cfsm - CFSM to analyze
 * @param maxDepth - Maximum trace length (default: 10)
 * @returns Array of traces (each trace is an array of actions)
 *
 * @tutorial For teaching: A trace is one possible "execution" of the protocol.
 *           If you run the protocol, the sequence of actions you perform
 *           is a trace. Different runs give different traces.
 */
export function extractTraces(
  cfsm: CFSM,
  maxDepth: number = 10
): CFSMAction[][] {
  const traces: CFSMAction[][] = [];

  const dfs = (stateId: string, currentTrace: CFSMAction[], depth: number) => {
    // Reached terminal state? Save this trace
    if (cfsm.terminalStates.includes(stateId)) {
      traces.push([...currentTrace]);
      return;
    }

    // Max depth reached? Stop
    if (depth >= maxDepth) {
      return;
    }

    // Explore each outgoing transition
    const outgoing = cfsm.transitions.filter(t => t.from === stateId);
    for (const trans of outgoing) {
      // Add action to trace (skip tau for observable traces)
      if (trans.action.type !== 'tau') {
        currentTrace.push(trans.action);
      }

      // Recurse
      dfs(trans.to, currentTrace, depth + 1);

      // Backtrack
      if (trans.action.type !== 'tau') {
        currentTrace.pop();
      }
    }
  };

  dfs(cfsm.initialState, [], 0);
  return traces;
}

// ============================================================================
// REACHABILITY ANALYSIS
// ============================================================================

/**
 * Check if terminal states are reachable from initial state
 *
 * FORMAL DEFINITION:
 * A CFSM has progress if:
 *   ∀ reachable states q, ∃ path from q to some q_term ∈ Q_term
 *
 * WELL-FORMEDNESS:
 * A well-formed CFSM must have progress (no deadlocks).
 * If some state cannot reach a terminal, the protocol can get stuck.
 *
 * @param cfsm - CFSM to analyze
 * @returns true if all reachable states can reach a terminal state
 *
 * @tutorial For teaching: This checks "can the protocol finish?".
 *           If there's a path to a terminal state, the protocol can
 *           complete successfully. If not, it gets stuck (deadlock).
 */
export function canReachTerminal(cfsm: CFSM): boolean {
  // BFS from initial state
  const visited = new Set<string>();
  const queue = [cfsm.initialState];

  while (queue.length > 0) {
    const stateId = queue.shift()!;
    if (visited.has(stateId)) continue;
    visited.add(stateId);

    // Found a terminal state?
    if (cfsm.terminalStates.includes(stateId)) {
      return true;
    }

    // Add successors
    const outgoing = cfsm.transitions.filter(t => t.from === stateId);
    for (const trans of outgoing) {
      if (!visited.has(trans.to)) {
        queue.push(trans.to);
      }
    }
  }

  // No terminal state reachable
  return false;
}

// ============================================================================
// DETERMINISM ANALYSIS
// ============================================================================

/**
 * Check if choices are deterministic (no ambiguous labels)
 *
 * FORMAL DEFINITION (Choice Determinism):
 * For any state q with multiple outgoing transitions:
 *   (q, a₁, q₁), (q, a₂, q₂) ∈ → ⟹ label(a₁) ≠ label(a₂)
 *
 * where label(a) extracts the message label from action a.
 *
 * WHY THIS MATTERS:
 * In a choice, each branch must be distinguishable by its first action.
 * Otherwise, the receiver cannot determine which branch was taken.
 *
 * EXAMPLE (NON-DETERMINISTIC - BAD):
 *   choice at Server {
 *     Server -> Client: Data(int);
 *   } or {
 *     Server -> Client: Data(string);
 *   }
 *
 * Both branches have label "Data" - client cannot distinguish!
 *
 * EXAMPLE (DETERMINISTIC - GOOD):
 *   choice at Server {
 *     Server -> Client: Option1();
 *   } or {
 *     Server -> Client: Option2();
 *   }
 *
 * Different labels - client can tell them apart.
 *
 * @param cfsm - CFSM to analyze
 * @returns true if all choices have distinct labels
 *
 * @tutorial For teaching: At each choice point, every option must have
 *           a unique "name" (label) so you can tell which one was chosen.
 *           Like restaurant menu items - they need distinct names!
 */
export function isChoiceDeterministic(cfsm: CFSM): boolean {
  // Find all branching states
  const branchingStates = findBranchingStates(cfsm);

  for (const stateId of branchingStates) {
    // Get all outgoing non-tau transitions
    const outgoing = cfsm.transitions.filter(
      t => t.from === stateId && t.action.type !== 'tau'
    );

    // Extract labels
    const labels = outgoing.map(t => {
      const action = t.action;
      if (action.type === 'send' || action.type === 'receive') {
        return action.label;
      }
      return null;
    }).filter(l => l !== null);

    // Check for duplicates
    const uniqueLabels = new Set(labels);
    if (labels.length !== uniqueLabels.size) {
      return false; // Duplicate labels = non-deterministic
    }
  }

  return true;
}

// ============================================================================
// ACTION COUNTING (for completeness tests)
// ============================================================================

/**
 * Count transitions with specific action type and label
 *
 * USED FOR: Theorem 4.7 (Projection Completeness)
 *
 * Completeness states: Every action in global type appears in ≥1 projection.
 * We verify this by counting send/receive actions in projected CFSMs.
 *
 * @param cfsm - CFSM to analyze
 * @param actionType - Type of action to count ('send' or 'receive')
 * @param label - Message label to match
 * @returns Number of matching transitions
 *
 * @tutorial For teaching: This counts how many times a specific action
 *           appears in the protocol. Like counting how many times you
 *           send a "Login" message in the protocol.
 */
export function countActions(
  cfsm: CFSM,
  actionType: 'send' | 'receive',
  label?: string
): number {
  return cfsm.transitions.filter(t => {
    if (t.action.type !== actionType) return false;
    if (label === undefined) return true;
    return (t.action as any).label === label;
  }).length;
}

/**
 * Get all unique message labels in CFSM
 *
 * @param cfsm - CFSM to analyze
 * @returns Set of all message labels used
 */
export function getMessageLabels(cfsm: CFSM): Set<string> {
  const labels = new Set<string>();

  for (const trans of cfsm.transitions) {
    const action = trans.action;
    if (action.type === 'send' || action.type === 'receive') {
      labels.add(action.label);
    }
  }

  return labels;
}
