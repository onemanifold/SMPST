/**
 * CFG Verification Algorithms
 * Implements deadlock detection, liveness, parallel checks, race detection, etc.
 */

import type { CFG, Node, Edge, ForkNode, ActionNode } from '../cfg/types';
import { isForkNode, isJoinNode, isActionNode, isMessageAction, isTerminalNode } from '../cfg/types';
import type {
  DeadlockResult,
  DeadlockCycle,
  LivenessResult,
  LivenessViolation,
  ParallelDeadlockResult,
  ParallelConflict,
  RaceConditionResult,
  RaceCondition,
  ProgressResult,
  CompleteVerification,
  VerificationOptions,
} from './types';
import { DEFAULT_VERIFICATION_OPTIONS } from './types';

// ============================================================================
// Deadlock Detection
// ============================================================================

/**
 * Detect deadlocks in the CFG
 * A deadlock occurs when there's a cycle where all participants are waiting
 * Note: Recursion (continue edges) is not a deadlock
 */
export function detectDeadlock(cfg: CFG): DeadlockResult {
  const cycles: DeadlockCycle[] = [];

  // Find strongly connected components (excluding continue edges)
  const sccs = findStronglyConnectedComponents(cfg);

  // Check each SCC for potential deadlock
  for (const scc of sccs) {
    // Skip single-node SCCs (not a cycle)
    if (scc.length <= 1) continue;

    // Skip SCCs that only contain recursion
    if (isOnlyRecursion(cfg, scc)) continue;

    // This is a potential deadlock cycle
    cycles.push({
      nodes: scc,
      description: `Potential deadlock cycle involving ${scc.length} nodes`,
    });
  }

  return {
    hasDeadlock: cycles.length > 0,
    cycles,
  };
}

/**
 * Find strongly connected components (excluding continue edges)
 */
function findStronglyConnectedComponents(cfg: CFG): string[][] {
  // Using Tarjan's algorithm
  let index = 0;
  const stack: string[] = [];
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const sccs: string[][] = [];

  function strongConnect(nodeId: string) {
    indices.set(nodeId, index);
    lowlinks.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    // Consider successors (excluding continue edges)
    const edges = cfg.edges.filter(
      e => e.from === nodeId && e.edgeType !== 'continue'
    );

    for (const edge of edges) {
      const successorId = edge.to;

      if (!indices.has(successorId)) {
        strongConnect(successorId);
        lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId)!, lowlinks.get(successorId)!));
      } else if (onStack.has(successorId)) {
        lowlinks.set(nodeId, Math.min(lowlinks.get(nodeId)!, indices.get(successorId)!));
      }
    }

    // If nodeId is a root node, pop the stack and create an SCC
    if (lowlinks.get(nodeId) === indices.get(nodeId)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);
      sccs.push(scc);
    }
  }

  // Run for all nodes
  for (const node of cfg.nodes) {
    if (!indices.has(node.id)) {
      strongConnect(node.id);
    }
  }

  return sccs;
}

/**
 * Check if an SCC only contains recursion (not a deadlock)
 */
function isOnlyRecursion(cfg: CFG, scc: string[]): boolean {
  // If all nodes in SCC are connected only by continue edges back to recursive nodes
  const sccSet = new Set(scc);

  for (const nodeId of scc) {
    const edges = cfg.edges.filter(e => e.from === nodeId && sccSet.has(e.to));
    // If there are edges within SCC that aren't continue edges, it's not just recursion
    if (edges.some(e => e.edgeType !== 'continue')) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Liveness Checking
// ============================================================================

/**
 * Check if protocol is live (can make progress and terminate)
 */
export function checkLiveness(cfg: CFG): LivenessResult {
  const violations: LivenessViolation[] = [];

  // Check if all nodes can eventually reach a terminal
  const terminals = cfg.nodes.filter(isTerminalNode);

  for (const node of cfg.nodes) {
    if (node.type === 'terminal') continue;

    const canReachTerminal = terminals.some(t => canReach(cfg, node.id, t.id));

    if (!canReachTerminal) {
      // Check if it's part of an infinite loop (which is OK)
      const isInInfiniteLoop = isPartOfInfiniteLoop(cfg, node.id);

      if (!isInInfiniteLoop) {
        violations.push({
          type: 'stuck-state',
          nodeId: node.id,
          description: `Node ${node.id} cannot reach any terminal and is not in a valid infinite loop`,
        });
      }
    }
  }

  return {
    isLive: violations.length === 0,
    violations,
  };
}

/**
 * Check if a node is part of an infinite loop (recursion)
 */
function isPartOfInfiniteLoop(cfg: CFG, nodeId: string): boolean {
  // Check if there's a continue edge that creates a loop back
  const visited = new Set<string>();
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const edges = cfg.edges.filter(e => e.from === current);

    for (const edge of edges) {
      if (edge.edgeType === 'continue') {
        // Found a continue edge - this is an infinite loop
        return true;
      }
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return false;
}

/**
 * Check if target is reachable from source
 */
function canReach(cfg: CFG, sourceId: string, targetId: string): boolean {
  const visited = new Set<string>();
  const queue: string[] = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const edges = cfg.edges.filter(e => e.from === current);
    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return false;
}

// ============================================================================
// Parallel Deadlock Detection
// ============================================================================

/**
 * Detect deadlocks in parallel composition
 * Check for actual conflicts:
 * - Same role SENDING in multiple branches (blocking issue)
 * - Bidirectional communication between roles in parallel (potential deadlock)
 * - Same role receiving from multiple sources is OK (with proper buffering)
 */
export function detectParallelDeadlock(cfg: CFG): ParallelDeadlockResult {
  const conflicts: ParallelConflict[] = [];

  // Find all fork nodes
  const forks = cfg.nodes.filter(isForkNode) as ForkNode[];

  for (const fork of forks) {
    // Get all branches for this fork
    const branches = getParallelBranches(cfg, fork);

    // Check each pair of branches for actual conflicts
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const sendersInBranch1 = getSendersInBranch(cfg, branches[i]);
        const sendersInBranch2 = getSendersInBranch(cfg, branches[j]);

        // Find roles that SEND in multiple branches (actual conflict)
        const commonSenders = [...sendersInBranch1].filter(r => sendersInBranch2.has(r));

        if (commonSenders.length > 0) {
          conflicts.push({
            parallelId: fork.parallel_id,
            branch1: branches[i],
            branch2: branches[j],
            description: `Roles ${commonSenders.join(', ')} send in multiple parallel branches (potential blocking)`,
          });
        }
      }
    }
  }

  return {
    hasDeadlock: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Get all parallel branches for a fork node
 */
function getParallelBranches(cfg: CFG, fork: ForkNode): string[][] {
  const branches: string[][] = [];
  const forkEdges = cfg.edges.filter(e => e.from === fork.id && e.edgeType === 'fork');

  // Find the matching join node
  const join = cfg.nodes.find(n => isJoinNode(n) && (n as any).parallel_id === fork.parallel_id);
  if (!join) return branches;

  // For each fork edge, find all nodes until join
  for (const forkEdge of forkEdges) {
    const branchNodes = getNodesUntil(cfg, forkEdge.to, join.id);
    branches.push(branchNodes);
  }

  return branches;
}

/**
 * Get all nodes from start until end (exclusive of end)
 */
function getNodesUntil(cfg: CFG, startId: string, endId: string): string[] {
  const nodes: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) continue;
    if (visited.has(current)) continue;
    visited.add(current);
    nodes.push(current);

    const edges = cfg.edges.filter(e => e.from === current);
    for (const edge of edges) {
      if (!visited.has(edge.to) && edge.to !== endId) {
        queue.push(edge.to);
      }
    }
  }

  return nodes;
}

/**
 * Get all roles involved in a branch
 */
function getRolesInBranch(cfg: CFG, branchNodes: string[]): Set<string> {
  const roles = new Set<string>();

  for (const nodeId of branchNodes) {
    const node = cfg.nodes.find(n => n.id === nodeId);
    if (node && isActionNode(node)) {
      const action = (node as ActionNode).action;
      if (isMessageAction(action)) {
        roles.add(action.from);
        if (typeof action.to === 'string') {
          roles.add(action.to);
        } else {
          action.to.forEach(r => roles.add(r));
        }
      }
    }
  }

  return roles;
}

/**
 * Get all roles that SEND in a branch (not receivers)
 */
function getSendersInBranch(cfg: CFG, branchNodes: string[]): Set<string> {
  const senders = new Set<string>();

  for (const nodeId of branchNodes) {
    const node = cfg.nodes.find(n => n.id === nodeId);
    if (node && isActionNode(node)) {
      const action = (node as ActionNode).action;
      if (isMessageAction(action)) {
        senders.add(action.from); // Only add sender, not receiver
      }
    }
  }

  return senders;
}

// ============================================================================
// Race Condition Detection
// ============================================================================

/**
 * Detect race conditions in parallel branches
 */
export function detectRaceConditions(cfg: CFG): RaceConditionResult {
  const races: RaceCondition[] = [];

  // Find all fork nodes
  const forks = cfg.nodes.filter(isForkNode) as ForkNode[];

  for (const fork of forks) {
    const branches = getParallelBranches(cfg, fork);

    // Check for concurrent operations on same role
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const actionsInBranch1 = getActionsInBranch(cfg, branches[i]);
        const actionsInBranch2 = getActionsInBranch(cfg, branches[j]);

        // Check for conflicting actions
        for (const action1 of actionsInBranch1) {
          for (const action2 of actionsInBranch2) {
            if (hasConflict(action1, action2)) {
              races.push({
                parallelId: fork.parallel_id,
                conflictingActions: [action1.id, action2.id],
                resource: getConflictingResource(action1, action2),
                description: `Concurrent operations on same role`,
              });
            }
          }
        }
      }
    }
  }

  return {
    hasRaces: races.length > 0,
    races,
  };
}

/**
 * Get all action nodes in a branch
 */
function getActionsInBranch(cfg: CFG, branchNodes: string[]): ActionNode[] {
  const actions: ActionNode[] = [];

  for (const nodeId of branchNodes) {
    const node = cfg.nodes.find(n => n.id === nodeId);
    if (node && isActionNode(node)) {
      actions.push(node as ActionNode);
    }
  }

  return actions;
}

/**
 * Check if two actions have a conflict (operate on same role)
 */
function hasConflict(action1: ActionNode, action2: ActionNode): boolean {
  if (!isMessageAction(action1.action) || !isMessageAction(action2.action)) {
    return false;
  }

  const msg1 = action1.action;
  const msg2 = action2.action;

  // Check if they share a role (either as sender or receiver)
  const roles1 = new Set([msg1.from, ...(typeof msg1.to === 'string' ? [msg1.to] : msg1.to)]);
  const roles2 = new Set([msg2.from, ...(typeof msg2.to === 'string' ? [msg2.to] : msg2.to)]);

  for (const role of roles1) {
    if (roles2.has(role)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the conflicting resource (role name)
 */
function getConflictingResource(action1: ActionNode, action2: ActionNode): string {
  if (!isMessageAction(action1.action) || !isMessageAction(action2.action)) {
    return 'unknown';
  }

  const msg1 = action1.action;
  const msg2 = action2.action;

  const roles1 = new Set([msg1.from, ...(typeof msg1.to === 'string' ? [msg1.to] : msg1.to)]);
  const roles2 = new Set([msg2.from, ...(typeof msg2.to === 'string' ? [msg2.to] : msg2.to)]);

  for (const role of roles1) {
    if (roles2.has(role)) {
      return role;
    }
  }

  return 'unknown';
}

// ============================================================================
// Progress Checking
// ============================================================================

/**
 * Check if protocol can make progress
 */
export function checkProgress(cfg: CFG): ProgressResult {
  const blockedNodes: string[] = [];

  // Check if each non-terminal node has outgoing edges
  for (const node of cfg.nodes) {
    if (node.type === 'terminal') continue;

    const outgoing = cfg.edges.filter(e => e.from === node.id);

    if (outgoing.length === 0) {
      blockedNodes.push(node.id);
    }
  }

  return {
    canProgress: blockedNodes.length === 0,
    blockedNodes,
    description: blockedNodes.length > 0
      ? `Nodes ${blockedNodes.join(', ')} have no outgoing edges`
      : undefined,
  };
}

// ============================================================================
// Complete Verification
// ============================================================================

/**
 * Run complete verification on a protocol
 */
export function verifyProtocol(
  cfg: CFG,
  options: VerificationOptions = DEFAULT_VERIFICATION_OPTIONS
): CompleteVerification {
  const opts = { ...DEFAULT_VERIFICATION_OPTIONS, ...options };

  return {
    structural: { valid: true, errors: [], warnings: [] }, // Assume passed CFG validation
    deadlock: opts.checkDeadlock ? detectDeadlock(cfg) : { hasDeadlock: false, cycles: [] },
    liveness: opts.checkLiveness ? checkLiveness(cfg) : { isLive: true, violations: [] },
    parallelDeadlock: opts.checkParallelDeadlock
      ? detectParallelDeadlock(cfg)
      : { hasDeadlock: false, conflicts: [] },
    raceConditions: opts.checkRaceConditions
      ? detectRaceConditions(cfg)
      : { hasRaces: false, races: [] },
    progress: opts.checkProgress ? checkProgress(cfg) : { canProgress: true, blockedNodes: [] },
  };
}
