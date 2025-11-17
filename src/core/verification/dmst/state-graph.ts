/**
 * State Graph Builder for DMst Protocols
 *
 * Builds reachable state graphs from CFG to verify:
 * - Deadlock-freedom: All reachable states can progress or terminate
 * - Liveness: No stuck states in protocol execution
 * - Progress: Protocol can reach completion
 *
 * Used by Theorem 23 (Deadlock-Freedom) verification.
 */

import type { CFG, Node, Edge } from '../../cfg/types';
import { isTerminalNode, isActionNode } from '../../cfg/types';

// ============================================================================
// State Graph Types
// ============================================================================

export interface StateGraph {
  /**
   * Initial state of the protocol
   */
  initialState: string;

  /**
   * All reachable states from initial state
   */
  reachableStates: Set<string>;

  /**
   * Terminal states (protocol completed)
   */
  terminalStates: Set<string>;

  /**
   * Transitions between states
   * Map from state ID to array of successor state IDs
   */
  transitions: Map<string, string[]>;

  /**
   * Actions associated with each transition
   * Map from "fromState->toState" to action label
   */
  actions: Map<string, string>;
}

/**
 * Result of deadlock-freedom verification via state graph
 */
export interface DeadlockFreedomResult {
  /**
   * True if protocol is deadlock-free
   * (all reachable states are terminal or have enabled actions)
   */
  isDeadlockFree: boolean;

  /**
   * States that are stuck (not terminal, no outgoing transitions)
   */
  stuckStates: string[];

  /**
   * Total number of reachable states
   */
  totalStates: number;

  /**
   * Reason for deadlock (if any)
   */
  reason?: string;
}

// ============================================================================
// State Graph Construction
// ============================================================================

/**
 * Build state graph from CFG.
 *
 * Performs reachability analysis starting from initial node,
 * collecting all reachable states and their transitions.
 *
 * @param cfg - Control Flow Graph of protocol
 * @returns State graph with reachability information
 */
export function buildStateGraph(cfg: CFG): StateGraph {
  const initialState = cfg.initialNode;
  const reachableStates = new Set<string>();
  const terminalStates = new Set<string>();
  const transitions = new Map<string, string[]>();
  const actions = new Map<string, string>();

  // DFS to explore all reachable states
  const visited = new Set<string>();
  const stack: string[] = [initialState];

  while (stack.length > 0) {
    const currentState = stack.pop()!;

    if (visited.has(currentState)) {
      continue;
    }
    visited.add(currentState);
    reachableStates.add(currentState);

    // Find node for this state
    const node = cfg.nodes.find(n => n.id === currentState);
    if (!node) {
      continue;
    }

    // Check if terminal
    if (isTerminalNode(node)) {
      terminalStates.add(currentState);
      continue;
    }

    // Find all outgoing edges (excluding continue edges for deadlock detection)
    const outgoing = cfg.edges.filter(
      e => e.from === currentState && e.edgeType !== 'continue'
    );

    // Record transitions
    if (outgoing.length > 0) {
      const successors = outgoing.map(e => e.to);
      transitions.set(currentState, successors);

      // Record action labels
      if (isActionNode(node)) {
        const actionNode = node as any;
        const action = actionNode.action;
        for (const edge of outgoing) {
          const key = `${currentState}->${edge.to}`;
          actions.set(key, action.kind || 'action');
        }
      }

      // Add successors to stack
      for (const successor of successors) {
        if (!visited.has(successor)) {
          stack.push(successor);
        }
      }
    }
  }

  return {
    initialState,
    reachableStates,
    terminalStates,
    transitions,
    actions,
  };
}

// ============================================================================
// Deadlock-Freedom Verification
// ============================================================================

/**
 * Verify deadlock-freedom using state graph.
 *
 * A protocol is deadlock-free if every reachable state either:
 * 1. Is a terminal state (protocol completed), OR
 * 2. Has at least one outgoing transition (can make progress)
 *
 * @param stateGraph - State graph from buildStateGraph()
 * @returns Deadlock-freedom verification result
 */
export function verifyDeadlockFreedom(
  stateGraph: StateGraph
): DeadlockFreedomResult {
  const stuckStates: string[] = [];

  // Check each reachable state
  for (const state of stateGraph.reachableStates) {
    const isTerminal = stateGraph.terminalStates.has(state);
    const hasOutgoing =
      stateGraph.transitions.has(state) &&
      stateGraph.transitions.get(state)!.length > 0;

    // State is stuck if not terminal and no outgoing transitions
    if (!isTerminal && !hasOutgoing) {
      stuckStates.push(state);
    }
  }

  const isDeadlockFree = stuckStates.length === 0;
  const totalStates = stateGraph.reachableStates.size;

  let reason: string | undefined;
  if (!isDeadlockFree) {
    reason = `Found ${stuckStates.length} stuck state(s): ${stuckStates.join(', ')}`;
  }

  return {
    isDeadlockFree,
    stuckStates,
    totalStates,
    reason,
  };
}

/**
 * Check if protocol can reach completion.
 *
 * A protocol can complete if there exists a path from initial state
 * to at least one terminal state.
 *
 * @param stateGraph - State graph
 * @returns True if protocol can reach a terminal state
 */
export function canComplete(stateGraph: StateGraph): boolean {
  // If there are no terminal states, cannot complete
  if (stateGraph.terminalStates.size === 0) {
    return false;
  }

  // BFS from initial state to find path to any terminal state
  const visited = new Set<string>();
  const queue: string[] = [stateGraph.initialState];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    // Check if we reached a terminal state
    if (stateGraph.terminalStates.has(current)) {
      return true;
    }

    // Add successors
    const successors = stateGraph.transitions.get(current) || [];
    for (const successor of successors) {
      if (!visited.has(successor)) {
        queue.push(successor);
      }
    }
  }

  return false;
}

/**
 * Find all states from which terminal states are unreachable.
 *
 * These are "dead-end" states that cannot lead to protocol completion.
 *
 * @param stateGraph - State graph
 * @returns Set of dead-end state IDs
 */
export function findDeadEndStates(stateGraph: StateGraph): Set<string> {
  const deadEnds = new Set<string>();

  // For each non-terminal state, check if terminal is reachable
  for (const state of stateGraph.reachableStates) {
    if (stateGraph.terminalStates.has(state)) {
      continue; // Terminal states are not dead ends
    }

    // BFS from this state to find terminal
    const visited = new Set<string>();
    const queue: string[] = [state];
    let foundTerminal = false;

    while (queue.length > 0 && !foundTerminal) {
      const current = queue.shift()!;

      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (stateGraph.terminalStates.has(current)) {
        foundTerminal = true;
        break;
      }

      const successors = stateGraph.transitions.get(current) || [];
      for (const successor of successors) {
        if (!visited.has(successor)) {
          queue.push(successor);
        }
      }
    }

    if (!foundTerminal) {
      deadEnds.add(state);
    }
  }

  return deadEnds;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all enabled actions at a given state.
 *
 * Returns the set of possible next actions from this state.
 *
 * @param stateGraph - State graph
 * @param state - Current state ID
 * @returns Array of action labels
 */
export function getEnabledActions(
  stateGraph: StateGraph,
  state: string
): string[] {
  const successors = stateGraph.transitions.get(state) || [];
  const actions: string[] = [];

  for (const successor of successors) {
    const key = `${state}->${successor}`;
    const action = stateGraph.actions.get(key);
    if (action) {
      actions.push(action);
    }
  }

  return actions;
}

/**
 * Compute strongly connected components in state graph.
 *
 * SCCs represent cycles in the protocol execution.
 * Used for advanced deadlock detection.
 *
 * @param stateGraph - State graph
 * @returns Array of SCCs (each SCC is an array of state IDs)
 */
export function findStronglyConnectedComponents(
  stateGraph: StateGraph
): string[][] {
  // Tarjan's algorithm
  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const sccs: string[][] = [];

  function strongConnect(state: string): void {
    indices.set(state, index);
    lowlinks.set(state, index);
    index++;
    stack.push(state);
    onStack.add(state);

    // Consider successors
    const successors = stateGraph.transitions.get(state) || [];
    for (const successor of successors) {
      if (!indices.has(successor)) {
        strongConnect(successor);
        lowlinks.set(state, Math.min(lowlinks.get(state)!, lowlinks.get(successor)!));
      } else if (onStack.has(successor)) {
        lowlinks.set(state, Math.min(lowlinks.get(state)!, indices.get(successor)!));
      }
    }

    // If state is a root node, pop the stack and create an SCC
    if (lowlinks.get(state) === indices.get(state)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== state);
      sccs.push(scc);
    }
  }

  // Run for all reachable states
  for (const state of stateGraph.reachableStates) {
    if (!indices.has(state)) {
      strongConnect(state);
    }
  }

  return sccs;
}
