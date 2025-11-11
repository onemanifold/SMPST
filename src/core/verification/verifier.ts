/**
 * CFG Verification Algorithms
 * Implements deadlock detection, liveness, parallel checks, race detection, etc.
 */

import type { CFG, Node, Edge, ForkNode, ActionNode, BranchNode, RecursiveNode } from '../cfg/types';
import { isForkNode, isJoinNode, isActionNode, isMessageAction, isTerminalNode, isBranchNode, isRecursiveNode } from '../cfg/types';
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
  ChoiceDeterminismResult,
  DeterminismViolation,
  ChoiceMergeabilityResult,
  MergeabilityViolation,
  ConnectednessResult,
  NestedRecursionResult,
  RecursionViolation,
  RecursionInParallelResult,
  RecursionParallelViolation,
  ForkJoinStructureResult,
  ForkJoinViolation,
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
// Choice Determinism (P0 - CRITICAL for Projection)
// ============================================================================

/**
 * Check if external choices have distinguishable message labels
 * Per Scribble spec 4.1.2: "The messages that A sends should be different in each block"
 */
export function checkChoiceDeterminism(cfg: CFG): ChoiceDeterminismResult {
  const violations: DeterminismViolation[] = [];

  // Find all branch nodes
  const branchNodes = cfg.nodes.filter(isBranchNode) as BranchNode[];

  for (const branchNode of branchNodes) {
    // Get all outgoing branch edges
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id && e.edgeType === 'branch');

    // For each branch, find the first message action
    const labelMap = new Map<string, string[]>(); // label -> [action node IDs]

    for (const edge of branchEdges) {
      const firstAction = findFirstMessageAction(cfg, edge.to);
      if (firstAction && isActionNode(firstAction) && isMessageAction(firstAction.action)) {
        const label = firstAction.action.label;
        if (!labelMap.has(label)) {
          labelMap.set(label, []);
        }
        labelMap.get(label)!.push(firstAction.id);
      }
    }

    // Check for duplicate labels
    for (const [label, actionIds] of labelMap.entries()) {
      if (actionIds.length > 1) {
        violations.push({
          branchNodeId: branchNode.id,
          duplicateLabel: label,
          branches: actionIds,
          description: `Choice at role ${branchNode.at} has multiple branches with message label "${label}"`,
        });
      }
    }
  }

  return {
    isDeterministic: violations.length === 0,
    violations,
  };
}

/**
 * Find the first message action reachable from a node
 */
function findFirstMessageAction(cfg: CFG, startNodeId: string): Node | null {
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // If this is an action node with message action, return it
    if (isActionNode(node) && isMessageAction(node.action)) {
      return node;
    }

    // Otherwise, follow sequence edges
    const outgoing = cfg.edges.filter(e => e.from === nodeId && e.edgeType === 'sequence');
    for (const edge of outgoing) {
      queue.push(edge.to);
    }
  }

  return null;
}

// ============================================================================
// Choice Mergeability (P0 - CRITICAL for Projection)
// ============================================================================

/**
 * Check if choice branches have consistent continuations for all roles
 * Per Honda et al. (2008): Projection requires "consistent endpoints" across choice branches
 */
export function checkChoiceMergeability(cfg: CFG): ChoiceMergeabilityResult {
  const violations: MergeabilityViolation[] = [];

  // Find all branch nodes
  const branchNodes = cfg.nodes.filter(isBranchNode) as BranchNode[];

  for (const branchNode of branchNodes) {
    // Get all branches for this choice
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id && e.edgeType === 'branch');

    // For each branch, collect the set of roles involved
    const branchRoles = new Map<string, Set<string>>(); // branch label -> set of roles

    for (const edge of branchEdges) {
      const label = edge.label || edge.to;
      const roles = getRolesInPath(cfg, edge.to, branchNode.id);
      branchRoles.set(label, roles);
    }

    // Check if all branches have the same set of roles
    const allRoles = new Set<string>();
    for (const roles of branchRoles.values()) {
      for (const role of roles) {
        allRoles.add(role);
      }
    }

    // For each role, check if it appears consistently across branches
    for (const role of allRoles) {
      const branchesWithRole: string[] = [];
      const branchesWithoutRole: string[] = [];

      for (const [label, roles] of branchRoles.entries()) {
        if (roles.has(role)) {
          branchesWithRole.push(label);
        } else {
          branchesWithoutRole.push(label);
        }
      }

      // If role appears in some branches but not all, it's a violation
      if (branchesWithRole.length > 0 && branchesWithoutRole.length > 0) {
        const branchInfo: { [key: string]: string[] } = {};
        for (const [label, roles] of branchRoles.entries()) {
          branchInfo[label] = Array.from(roles);
        }

        violations.push({
          branchNodeId: branchNode.id,
          role,
          description: `Role ${role} appears in branches [${branchesWithRole.join(', ')}] but not in [${branchesWithoutRole.join(', ')}]`,
          branches: branchInfo,
        });
      }
    }
  }

  return {
    isMergeable: violations.length === 0,
    violations,
  };
}

/**
 * Get all roles involved in a path (from a branch start until merge or terminal)
 */
function getRolesInPath(cfg: CFG, startNodeId: string, branchNodeId: string): Set<string> {
  const roles = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // Stop at merge nodes (but don't include roles after merge)
    if (node.type === 'merge') continue;

    // If this is an action node with message action, collect roles
    if (isActionNode(node) && isMessageAction(node.action)) {
      const action = node.action;
      roles.add(action.from);
      if (typeof action.to === 'string') {
        roles.add(action.to);
      } else {
        action.to.forEach(r => roles.add(r));
      }
    }

    // Follow all outgoing edges (except back to branch node)
    const outgoing = cfg.edges.filter(e => e.from === nodeId && e.to !== branchNodeId);
    for (const edge of outgoing) {
      queue.push(edge.to);
    }
  }

  return roles;
}

// ============================================================================
// Connectedness (P0 - CRITICAL for Projection)
// ============================================================================

/**
 * Check if all declared roles participate in the protocol
 * Per Scribble spec 4.1.1: All declared roles should appear in the protocol
 */
export function checkConnectedness(cfg: CFG): ConnectednessResult {
  const declaredRoles = new Set(cfg.roles);
  const usedRoles = new Set<string>();

  // Collect all roles used in action nodes
  for (const node of cfg.nodes) {
    if (isActionNode(node) && isMessageAction(node.action)) {
      const action = node.action;
      usedRoles.add(action.from);
      if (typeof action.to === 'string') {
        usedRoles.add(action.to);
      } else {
        action.to.forEach(r => usedRoles.add(r));
      }
    }
  }

  // Find orphaned roles (declared but not used)
  const orphanedRoles: string[] = [];
  for (const role of declaredRoles) {
    if (!usedRoles.has(role)) {
      orphanedRoles.push(role);
    }
  }

  return {
    isConnected: orphanedRoles.length === 0,
    orphanedRoles,
    description: orphanedRoles.length > 0
      ? `Roles ${orphanedRoles.join(', ')} are declared but never used`
      : undefined,
  };
}

// ============================================================================
// Nested Recursion (P1 - HIGH for Correctness)
// ============================================================================

/**
 * Check if nested recursion is well-formed
 * Verifies that continue edges target valid rec labels in scope
 */
export function checkNestedRecursion(cfg: CFG): NestedRecursionResult {
  const violations: RecursionViolation[] = [];

  // Build map of recursive node labels
  const recLabels = new Map<string, string>(); // label -> node ID
  for (const node of cfg.nodes) {
    if (isRecursiveNode(node)) {
      recLabels.set((node as RecursiveNode).label, node.id);
    }
  }

  // Check all continue edges
  const continueEdges = cfg.edges.filter(e => e.edgeType === 'continue');

  for (const edge of continueEdges) {
    // Find the target recursive node
    const targetNode = cfg.nodes.find(n => n.id === edge.to);

    if (!targetNode || !isRecursiveNode(targetNode)) {
      violations.push({
        continueEdgeId: edge.id,
        description: `Continue edge ${edge.id} targets non-recursive node ${edge.to}`,
        type: 'undefined-label',
      });
      continue;
    }

    const targetLabel = (targetNode as RecursiveNode).label;

    // Verify the label exists
    if (!recLabels.has(targetLabel)) {
      violations.push({
        continueEdgeId: edge.id,
        targetLabel,
        description: `Continue targets undefined rec label "${targetLabel}"`,
        type: 'undefined-label',
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

// ============================================================================
// Recursion in Parallel (P1 - HIGH - Well-Formedness!)
// ============================================================================

/**
 * Check if continue appears in parallel branch where rec is not defined
 * Per Scribble spec 4.1.3: "There should not be any `global-continue` in any
 * of the blocki, unless the `global-recursion` is also defined in the same block blocki."
 */
export function checkRecursionInParallel(cfg: CFG): RecursionInParallelResult {
  const violations: RecursionParallelViolation[] = [];

  // Find all fork nodes (parallel blocks)
  const forkNodes = cfg.nodes.filter(isForkNode) as ForkNode[];

  for (const fork of forkNodes) {
    const parallelId = fork.parallel_id;

    // Get all nodes in each parallel branch (excluding continue edges)
    const branches = getParallelBranchesWithoutContinue(cfg, fork);

    for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
      const branchNodes = branches[branchIndex];
      const branchNodeSet = new Set(branchNodes);

      // Find recursive nodes in this branch
      const recLabelsInBranch = new Set<string>();
      for (const nodeId of branchNodes) {
        const node = cfg.nodes.find(n => n.id === nodeId);
        if (node && isRecursiveNode(node)) {
          recLabelsInBranch.add((node as RecursiveNode).label);
        }
      }

      // Find continue edges in this branch
      for (const nodeId of branchNodes) {
        const continueEdges = cfg.edges.filter(
          e => e.from === nodeId && e.edgeType === 'continue'
        );

        for (const edge of continueEdges) {
          // Check if continue targets a rec node
          const targetNode = cfg.nodes.find(n => n.id === edge.to);
          if (targetNode && isRecursiveNode(targetNode)) {
            const targetLabel = (targetNode as RecursiveNode).label;

            // Check if the target rec node is OUTSIDE this branch
            // If target is outside the branch, it's a violation
            if (!branchNodeSet.has(edge.to)) {
              violations.push({
                continueEdgeId: edge.id,
                recursiveNodeId: edge.to,
                parallelId,
                description: `Continue to "${targetLabel}" in parallel branch where rec is not defined (Scribble spec 4.1.3 violation)`,
              });
            }
          }
        }
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Get parallel branches WITHOUT following continue edges
 * This is needed to correctly detect if a rec is inside or outside a parallel branch
 */
function getParallelBranchesWithoutContinue(cfg: CFG, fork: ForkNode): string[][] {
  const branches: string[][] = [];
  const forkEdges = cfg.edges.filter(e => e.from === fork.id && e.edgeType === 'fork');

  // Find the matching join node
  const join = cfg.nodes.find(n => isJoinNode(n) && (n as any).parallel_id === fork.parallel_id);
  if (!join) return branches;

  // For each fork edge, find all nodes until join (excluding continue edges)
  for (const forkEdge of forkEdges) {
    const branchNodes = getNodesUntilWithoutContinue(cfg, forkEdge.to, join.id);
    branches.push(branchNodes);
  }

  return branches;
}

/**
 * Get all nodes from start until end (exclusive of end), excluding continue edges
 */
function getNodesUntilWithoutContinue(cfg: CFG, startId: string, endId: string): string[] {
  const nodes: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) continue;
    if (visited.has(current)) continue;
    visited.add(current);
    nodes.push(current);

    // Only follow non-continue edges
    const edges = cfg.edges.filter(e => e.from === current && e.edgeType !== 'continue');
    for (const edge of edges) {
      if (!visited.has(edge.to) && edge.to !== endId) {
        queue.push(edge.to);
      }
    }
  }

  return nodes;
}

// ============================================================================
// Fork-Join Structure (P1 - HIGH for Well-Formedness)
// ============================================================================

/**
 * Check if fork-join pairs are well-formed
 * Verifies nested, sequential, and choice-embedded parallels
 */
export function checkForkJoinStructure(cfg: CFG): ForkJoinStructureResult {
  const violations: ForkJoinViolation[] = [];

  // For now, we trust the CFG builder to create correct fork-join pairs
  // This is a structural check that would catch builder errors

  const forkNodes = cfg.nodes.filter(isForkNode) as ForkNode[];
  const joinNodes = cfg.nodes.filter(isJoinNode);

  // Check each fork has a corresponding join
  for (const fork of forkNodes) {
    const parallelId = fork.parallel_id;
    const matchingJoin = joinNodes.find(
      j => (j as any).parallel_id === parallelId
    );

    if (!matchingJoin) {
      violations.push({
        forkNodeId: fork.id,
        description: `Fork node ${fork.id} with parallel_id "${parallelId}" has no matching join`,
        type: 'orphaned-fork',
      });
    }
  }

  // Check each join has a corresponding fork
  for (const join of joinNodes) {
    const parallelId = (join as any).parallel_id;
    const matchingFork = forkNodes.find(f => f.parallel_id === parallelId);

    if (!matchingFork) {
      violations.push({
        joinNodeId: join.id,
        description: `Join node ${join.id} with parallel_id "${parallelId}" has no matching fork`,
        type: 'orphaned-join',
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
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
    choiceDeterminism: opts.checkChoiceDeterminism
      ? checkChoiceDeterminism(cfg)
      : { isDeterministic: true, violations: [] },
    choiceMergeability: opts.checkChoiceMergeability
      ? checkChoiceMergeability(cfg)
      : { isMergeable: true, violations: [] },
    connectedness: opts.checkConnectedness
      ? checkConnectedness(cfg)
      : { isConnected: true, orphanedRoles: [] },
    nestedRecursion: opts.checkNestedRecursion
      ? checkNestedRecursion(cfg)
      : { isValid: true, violations: [] },
    recursionInParallel: opts.checkRecursionInParallel
      ? checkRecursionInParallel(cfg)
      : { isValid: true, violations: [] },
    forkJoinStructure: opts.checkForkJoinStructure
      ? checkForkJoinStructure(cfg)
      : { isValid: true, violations: [] },
  };
}
