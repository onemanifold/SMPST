/**
 * Test utilities for CFSM projection assertions
 */
import type { CFSM, SendAction, ReceiveAction, CFSMAction } from '../types';

// ============================================================================
// Transition Finders
// ============================================================================

/**
 * Find first transition with specific action type
 */
export function findTransitionWithAction(
  cfsm: CFSM,
  actionType: 'send' | 'receive' | 'tau' | 'choice'
): ReturnType<typeof cfsm.transitions.find> {
  return cfsm.transitions.find(t => t.action && t.action.type === actionType);
}

/**
 * Find all transitions with specific action type
 */
export function findTransitionsWithAction(
  cfsm: CFSM,
  actionType: 'send' | 'receive' | 'tau' | 'choice'
) {
  return cfsm.transitions.filter(t => t.action && t.action.type === actionType);
}

/**
 * Find transitions with specific action and label
 */
export function findTransitionsByLabel(
  cfsm: CFSM,
  actionType: 'send' | 'receive',
  label: string
) {
  return cfsm.transitions.filter(t => {
    if (!t.action || t.action.type !== actionType) return false;
    return (t.action as SendAction | ReceiveAction).label === label;
  });
}

// ============================================================================
// Boolean Assertions
// ============================================================================

/**
 * Check if CFSM has send action with specific label
 */
export function hasSendAction(cfsm: CFSM, label: string, to?: string): boolean {
  return cfsm.transitions.some(t => {
    if (!t.action || t.action.type !== 'send') return false;
    const action = t.action as SendAction;
    return action.label === label && (!to || action.to === to);
  });
}

/**
 * Check if CFSM has receive action with specific label
 */
export function hasReceiveAction(cfsm: CFSM, label: string, from?: string): boolean {
  return cfsm.transitions.some(t => {
    if (!t.action || t.action.type !== 'receive') return false;
    const action = t.action as ReceiveAction;
    return action.label === label && (!from || action.from === from);
  });
}

/**
 * Check if CFSM has any action of given type
 */
export function hasActionType(cfsm: CFSM, actionType: CFSMAction['type']): boolean {
  return cfsm.transitions.some(t => t.action && t.action.type === actionType);
}

// ============================================================================
// Graph Analysis
// ============================================================================

/**
 * Detect cycles in CFSM using DFS
 */
export function hasCycle(cfsm: CFSM): boolean {
  const adjList = new Map<string, string[]>();
  for (const t of cfsm.transitions) {
    if (!adjList.has(t.from)) adjList.set(t.from, []);
    adjList.get(t.from)!.push(t.to);
  }

  function dfs(state: string, visited: Set<string>, recStack: Set<string>): boolean {
    visited.add(state);
    recStack.add(state);

    const neighbors = adjList.get(state) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, visited, recStack)) return true;
      } else if (recStack.has(neighbor)) {
        return true; // Back edge found - cycle!
      }
    }

    recStack.delete(state);
    return false;
  }

  const visited = new Set<string>();
  for (const state of cfsm.states) {
    if (!visited.has(state.id)) {
      if (dfs(state.id, visited, new Set())) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get all reachable states from initial state
 */
export function getReachableStates(cfsm: CFSM): Set<string> {
  const reachable = new Set<string>();
  const queue = [cfsm.initialState];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const outgoing = cfsm.transitions.filter(t => t.from === current);
    for (const t of outgoing) {
      if (!reachable.has(t.to)) {
        queue.push(t.to);
      }
    }
  }

  return reachable;
}

/**
 * Count actions by type
 */
export function countActionsByType(cfsm: CFSM): Record<string, number> {
  const counts: Record<string, number> = { send: 0, receive: 0, tau: 0, choice: 0 };
  for (const t of cfsm.transitions) {
    if (t.action) {
      counts[t.action.type] = (counts[t.action.type] || 0) + 1;
    }
  }
  return counts;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Verify CFSM has proper structure
 */
export function assertValidCFSMStructure(cfsm: CFSM): void {
  if (!cfsm.role) throw new Error('CFSM must have a role');
  if (cfsm.states.length === 0) throw new Error('CFSM must have states');
  if (!cfsm.initialState) throw new Error('CFSM must have initial state');
  if (cfsm.terminalStates.length === 0) throw new Error('CFSM must have terminal states');
  if (!cfsm.states.some(s => s.id === cfsm.initialState)) {
    throw new Error('Initial state must be in states array');
  }
}

/**
 * Verify message duality between two CFSMs
 */
export function assertMessageDuality(
  senderCFSM: CFSM,
  receiverCFSM: CFSM,
  messageLabel: string
): void {
  const sendTransitions = findTransitionsByLabel(senderCFSM, 'send', messageLabel);
  const recvTransitions = findTransitionsByLabel(receiverCFSM, 'receive', messageLabel);

  if (sendTransitions.length === 0) {
    throw new Error(`Sender CFSM missing send transition for ${messageLabel}`);
  }
  if (recvTransitions.length === 0) {
    throw new Error(`Receiver CFSM missing receive transition for ${messageLabel}`);
  }
  if (sendTransitions.length !== recvTransitions.length) {
    throw new Error(`Send/receive count mismatch for ${messageLabel}`);
  }
}
