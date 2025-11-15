/**
 * CFG Verification Algorithms
 * Implements deadlock detection, liveness, parallel checks, race detection, etc.
 */

import type { CFG, Node, Edge, ForkNode, ActionNode, BranchNode, RecursiveNode } from '../cfg/types';
import { isForkNode, isJoinNode, isActionNode, isMessageAction, isTerminalNode, isBranchNode, isRecursiveNode, isCreateParticipantsAction, isInvitationAction, isDynamicRoleDeclarationAction } from '../cfg/types';
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
  MulticastResult,
  MulticastWarning,
  SelfCommunicationResult,
  SelfCommunicationViolation,
  EmptyChoiceBranchResult,
  EmptyBranchViolation,
  MergeReachabilityResult,
  MergeViolation,
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
    const nodeList = scc.length <= 5
      ? scc.join(' → ')
      : `${scc.slice(0, 3).join(' → ')} ... ${scc.slice(-2).join(' → ')} (${scc.length} nodes total)`;

    cycles.push({
      nodes: scc,
      description: `Potential deadlock cycle detected: ${nodeList}. These nodes form a strongly connected component where execution may become stuck.`,
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
        // Get node details for better error message
        const nodeDetails = isActionNode(node) && isMessageAction(node.action)
          ? `action [${node.action.from} → ${typeof node.action.to === 'string' ? node.action.to : node.action.to.join(', ')}: ${node.action.label}]`
          : `node ${node.id}`;

        violations.push({
          type: 'stuck-state',
          nodeId: node.id,
          description: `Protocol execution may become stuck at ${nodeDetails}. This node cannot reach a terminal state and is not part of a valid infinite loop (recursion). Ensure all protocol paths either terminate properly or loop back via 'continue' to a 'rec' label.`,
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

    // Check 1: Role sending in multiple branches (immediate conflict)
    for (let i = 0; i < branches.length; i++) {
      for (let j = i + 1; j < branches.length; j++) {
        const sendersInBranch1 = getSendersInBranch(cfg, branches[i]);
        const sendersInBranch2 = getSendersInBranch(cfg, branches[j]);

        // Find roles that SEND in multiple branches (actual conflict)
        const commonSenders = [...sendersInBranch1].filter(r => sendersInBranch2.has(r));

        if (commonSenders.length > 0) {
          const roleList = commonSenders.length === 1
            ? `Role "${commonSenders[0]}"`
            : `Roles [${commonSenders.join(', ')}]`;

          conflicts.push({
            parallelId: fork.parallel_id,
            branch1: branches[i],
            branch2: branches[j],
            description: `Parallel deadlock detected: ${roleList} send messages in multiple parallel branches, which may cause blocking. A role cannot send in concurrent branches as it would require the role to act simultaneously. Review parallel_id "${fork.parallel_id}" to ensure branch independence.`,
          });
        }
      }
    }

    // Check 2: Circular dependencies between branches
    const circularConflicts = detectCircularDependencies(cfg, fork, branches);
    conflicts.push(...circularConflicts);
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

/**
 * Check for circular dependencies between parallel branches
 * Returns conflicts where role A in branch i waits for role B in branch j,
 * and role B in branch j waits for role A in branch i.
 */
function detectCircularDependencies(cfg: CFG, fork: ForkNode, branches: string[][]): ParallelConflict[] {
  const conflicts: ParallelConflict[] = [];

  // Build dependency map: (role, branchIndex) -> set of (role, branchIndex) it depends on
  interface Dependency {
    role: string;
    branch: number;
  }

  const dependencies = new Map<string, Dependency[]>(); // key: "role:branch", value: dependencies

  // For each branch, analyze what roles it depends on
  for (let branchIdx = 0; branchIdx < branches.length; branchIdx++) {
    const branchNodes = branches[branchIdx];

    // Get messages in this branch
    for (const nodeId of branchNodes) {
      const node = cfg.nodes.find(n => n.id === nodeId);
      if (node && isActionNode(node)) {
        const action = (node as ActionNode).action;
        if (isMessageAction(action)) {
          // Receiver depends on sender
          const receivers = typeof action.to === 'string' ? [action.to] : action.to;

          for (const receiver of receivers) {
            const key = `${receiver}:${branchIdx}`;
            if (!dependencies.has(key)) {
              dependencies.set(key, []);
            }

            // Find which branch the sender is in
            for (let senderBranchIdx = 0; senderBranchIdx < branches.length; senderBranchIdx++) {
              if (senderBranchIdx === branchIdx) continue; // Skip same branch

              const hasSenderInBranch = branches[senderBranchIdx].some(nId => {
                const n = cfg.nodes.find(node => node.id === nId);
                if (!n || !isActionNode(n)) return false;
                const a = (n as ActionNode).action;
                return isMessageAction(a) && a.from === action.from;
              });

              if (hasSenderInBranch) {
                dependencies.get(key)!.push({
                  role: action.from,
                  branch: senderBranchIdx
                });
              }
            }
          }
        }
      }
    }
  }

  // Check for circular dependencies between branch pairs
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      // Check if role in branch i depends on role in branch j
      // AND role in branch j depends on role in branch i
      let iDependsOnJ = false;
      let jDependsOnI = false;
      let roleInI = '';
      let roleInJ = '';

      // Check all roles in branch i
      const rolesInI = getRolesInBranch(cfg, branches[i]);
      for (const role of rolesInI) {
        const key = `${role}:${i}`;
        const deps = dependencies.get(key);
        if (deps && deps.some(d => d.branch === j)) {
          iDependsOnJ = true;
          roleInI = role;
          break;
        }
      }

      // Check all roles in branch j
      const rolesInJ = getRolesInBranch(cfg, branches[j]);
      for (const role of rolesInJ) {
        const key = `${role}:${j}`;
        const deps = dependencies.get(key);
        if (deps && deps.some(d => d.branch === i)) {
          jDependsOnI = true;
          roleInJ = role;
          break;
        }
      }

      // Circular dependency found!
      if (iDependsOnJ && jDependsOnI) {
        conflicts.push({
          parallelId: fork.parallel_id,
          branch1: branches[i],
          branch2: branches[j],
          description: `Circular dependency detected in parallel branches: Branch ${i} (role ${roleInI}) waits for message from Branch ${j}, while Branch ${j} (role ${roleInJ}) waits for message from Branch ${i}. This creates a deadlock where both branches are blocked waiting for each other. Parallel_id: "${fork.parallel_id}".`
        });
      }
    }
  }

  return conflicts;
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
              const conflictingRole = getConflictingResource(action1, action2);
              const action1Details = isMessageAction(action1.action)
                ? `${action1.action.from} → ${typeof action1.action.to === 'string' ? action1.action.to : action1.action.to.join(', ')}: ${action1.action.label}`
                : 'unknown action';
              const action2Details = isMessageAction(action2.action)
                ? `${action2.action.from} → ${typeof action2.action.to === 'string' ? action2.action.to : action2.action.to.join(', ')}: ${action2.action.label}`
                : 'unknown action';

              races.push({
                parallelId: fork.parallel_id,
                conflictingActions: [action1.id, action2.id],
                resource: conflictingRole,
                description: `Race condition: Role "${conflictingRole}" involved in concurrent operations across parallel branches. Branch 1: [${action1Details}], Branch 2: [${action2Details}]. This may cause non-deterministic behavior.`,
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
 * Check if two actions have a conflict (use same channel)
 *
 * THEOREM 4.5 (Deniélou & Yoshida 2012): No Races
 * Race condition occurs when: channels(G₁) ∩ channels(G₂) ≠ ∅
 *
 * A channel is a pair (sender, receiver). Two actions race if they use
 * the exact same channel (same sender and same receiver).
 *
 * Examples:
 *   Hub -> A: Msg1  uses channel (Hub, A)
 *   Hub -> B: Msg2  uses channel (Hub, B)
 *   These channels are DISJOINT → NO RACE
 *
 *   A -> B: Msg1    uses channel (A, B)
 *   A -> B: Msg2    uses channel (A, B)
 *   These channels OVERLAP → RACE
 */
function hasConflict(action1: ActionNode, action2: ActionNode): boolean {
  if (!isMessageAction(action1.action) || !isMessageAction(action2.action)) {
    return false;
  }

  const msg1 = action1.action;
  const msg2 = action2.action;

  // Build channels for msg1: (from, to) pairs
  const receivers1 = typeof msg1.to === 'string' ? [msg1.to] : msg1.to;
  const channels1 = receivers1.map(r => `${msg1.from}->${r}`);

  // Build channels for msg2: (from, to) pairs
  const receivers2 = typeof msg2.to === 'string' ? [msg2.to] : msg2.to;
  const channels2 = receivers2.map(r => `${msg2.from}->${r}`);

  // Check if any channels overlap
  for (const ch1 of channels1) {
    if (channels2.includes(ch1)) {
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

  // Build detailed description of blocked nodes
  let description: string | undefined;
  if (blockedNodes.length > 0) {
    const nodeDetails = blockedNodes.slice(0, 3).map(nodeId => {
      const node = cfg.nodes.find(n => n.id === nodeId);
      if (node && isActionNode(node) && isMessageAction(node.action)) {
        return `[${node.action.from} → ${typeof node.action.to === 'string' ? node.action.to : node.action.to.join(', ')}: ${node.action.label}]`;
      }
      return nodeId;
    });

    const suffix = blockedNodes.length > 3 ? ` and ${blockedNodes.length - 3} more` : '';
    description = `Protocol progress blocked: Non-terminal nodes (${nodeDetails.join(', ')}${suffix}) have no outgoing edges, creating dead-ends. All non-terminal nodes must have at least one continuation path.`;
  }

  return {
    canProgress: blockedNodes.length === 0,
    blockedNodes,
    description,
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
        const role = branchNode.at;
        violations.push({
          branchNodeId: branchNode.id,
          duplicateLabel: label,
          branches: actionIds,
          description: `Choice determinism violation: External choice at role "${role}" has ${actionIds.length} branches with the same message label "${label}". Per Scribble specification 4.1.2, each choice branch must have a distinguishable message label so that receivers can determine which branch was selected. Use different message labels for each branch (e.g., "${label}Option1", "${label}Option2").`,
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
 *
 * DMst Extension: Allows conditional dynamic participants (different participant sets per branch)
 * - Static roles (declared in protocol signature) must appear consistently
 * - Dynamic roles and instances created within branches can be branch-specific
 */
export function checkChoiceMergeability(cfg: CFG): ChoiceMergeabilityResult {
  const violations: MergeabilityViolation[] = [];

  // Collect all dynamic role names (declared with 'new role')
  const dynamicRoles = new Set<string>();
  for (const node of cfg.nodes) {
    if (isActionNode(node) && isDynamicRoleDeclarationAction(node.action)) {
      dynamicRoles.add(node.action.roleName);
    }
  }

  // Static roles are those in cfg.roles (protocol signature)
  const staticRoles = new Set(cfg.roles);

  // Find all branch nodes
  const branchNodes = cfg.nodes.filter(isBranchNode) as BranchNode[];

  for (const branchNode of branchNodes) {
    // Get all branches for this choice
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id && e.edgeType === 'branch');

    // For each branch, collect roles involved and instances created
    const branchRoles = new Map<string, Set<string>>(); // branch label -> set of roles
    const branchCreatedInstances = new Map<string, Set<string>>(); // branch label -> instances created in this branch

    for (const edge of branchEdges) {
      const label = edge.label || edge.to;
      const { roles, createdInstances } = getRolesAndInstancesInPath(cfg, edge.to, branchNode.id);
      branchRoles.set(label, roles);
      branchCreatedInstances.set(label, createdInstances);
    }

    // Check if all branches have the same set of roles
    const allRoles = new Set<string>();
    for (const roles of branchRoles.values()) {
      for (const role of roles) {
        allRoles.add(role);
      }
    }

    // For each role, check if it appears consistently across branches
    // DMst: Only enforce consistency for STATIC roles
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

      // If role appears in some branches but not all
      if (branchesWithRole.length > 0 && branchesWithoutRole.length > 0) {
        // DMst: Allow dynamic roles to be conditional (branch-specific)
        if (dynamicRoles.has(role)) {
          // This is OK! Dynamic roles can be conditionally created
          continue;
        }

        // DMst: Check if this is an instance created within a branch
        let isConditionallyCreated = false;
        for (const [label, createdInstances] of branchCreatedInstances.entries()) {
          if (createdInstances.has(role)) {
            // This instance was created within this branch, so it's OK to be branch-specific
            isConditionallyCreated = true;
            break;
          }
        }

        if (isConditionallyCreated) {
          // This is OK! Conditionally created instances can be branch-specific
          continue;
        }

        // Static roles must appear consistently
        const branchInfo: { [key: string]: string[] } = {};
        for (const [label, roles] of branchRoles.entries()) {
          branchInfo[label] = Array.from(roles);
        }

        const branchDetails = Object.entries(branchInfo)
          .map(([label, roles]) => `"${label}": {${Array.from(roles).join(', ')}}`)
          .join(', ');

        violations.push({
          branchNodeId: branchNode.id,
          role,
          description: `Choice mergeability violation: Role "${role}" participates in choice branches [${branchesWithRole.join(', ')}] but not in [${branchesWithoutRole.join(', ')}]. After a choice, all roles must have a consistent view of the protocol state. Either include "${role}" in all branches with equivalent actions, or remove it from all branches. Branch participation: {${branchDetails}}.`,
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
 * Get all roles involved in a path and instances created within the path
 * (from a branch start until merge or terminal)
 *
 * DMst Extension: Also tracks which instances are created within this path
 */
function getRolesAndInstancesInPath(
  cfg: CFG,
  startNodeId: string,
  branchNodeId: string
): { roles: Set<string>; createdInstances: Set<string> } {
  const roles = new Set<string>();
  const createdInstances = new Set<string>();
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

    if (isActionNode(node)) {
      const action = node.action;

      // Collect roles from message actions
      if (isMessageAction(action)) {
        roles.add(action.from);
        if (typeof action.to === 'string') {
          roles.add(action.to);
        } else {
          action.to.forEach(r => roles.add(r));
        }
      }

      // DMst: Track instances created within this path
      if (isCreateParticipantsAction(action) && action.instanceName) {
        createdInstances.add(action.instanceName);
      }
    }

    // Follow all outgoing edges (except back to branch node)
    const outgoing = cfg.edges.filter(e => e.from === nodeId && e.to !== branchNodeId);
    for (const edge of outgoing) {
      queue.push(edge.to);
    }
  }

  return { roles, createdInstances };
}

/**
 * Get all roles involved in a path (from a branch start until merge or terminal)
 * @deprecated Use getRolesAndInstancesInPath for DMst support
 */
function getRolesInPath(cfg: CFG, startNodeId: string, branchNodeId: string): Set<string> {
  return getRolesAndInstancesInPath(cfg, startNodeId, branchNodeId).roles;
}

// ============================================================================
// Connectedness (P0 - CRITICAL for Projection)
// ============================================================================

/**
 * Check if all declared roles participate in the protocol
 * Per Scribble spec 4.1.1: All declared roles should appear in the protocol
 *
 * DMst Extension: Also counts participation in creates/invites actions
 * (Definition 12: Projection for Dynamic Participants)
 */
export function checkConnectedness(cfg: CFG): ConnectednessResult {
  const declaredRoles = new Set(cfg.roles);
  const usedRoles = new Set<string>();

  // Collect all roles used in action nodes
  for (const node of cfg.nodes) {
    if (isActionNode(node)) {
      const action = node.action;

      // Classic MPST: Message actions
      if (isMessageAction(action)) {
        usedRoles.add(action.from);
        if (typeof action.to === 'string') {
          usedRoles.add(action.to);
        } else {
          action.to.forEach(r => usedRoles.add(r));
        }
      }

      // DMst: CreateParticipants actions (Definition 12)
      // Both creator and created role are active participants
      if (isCreateParticipantsAction(action)) {
        usedRoles.add(action.creator);
        // Note: roleName is the dynamic role type, not instance
        // We still count it as participation
      }

      // DMst: Invitation actions (Definition 12)
      // Both inviter and invitee are active participants
      if (isInvitationAction(action)) {
        usedRoles.add(action.inviter);
        usedRoles.add(action.invitee);
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
      ? `Connectedness violation: Role${orphanedRoles.length > 1 ? 's' : ''} [${orphanedRoles.join(', ')}] ${orphanedRoles.length > 1 ? 'are' : 'is'} declared in the protocol signature but never participate in any message exchange, participant creation, or invitation. All declared roles must be involved in the protocol.`
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
        description: `Nested recursion error: Continue statement (edge ${edge.id}) targets node ${edge.to}, which is not a recursive node. Continue statements must target 'rec' labels only.`,
        type: 'undefined-label',
      });
      continue;
    }

    const targetLabel = (targetNode as RecursiveNode).label;

    // Verify the label exists
    if (!recLabels.has(targetLabel)) {
      const availableLabels = Array.from(recLabels.keys());
      const labelHint = availableLabels.length > 0
        ? ` Available rec labels: [${availableLabels.join(', ')}]`
        : ' No rec labels found in protocol.';

      violations.push({
        continueEdgeId: edge.id,
        targetLabel,
        description: `Nested recursion error: Continue statement references undefined rec label "${targetLabel}".${labelHint} Ensure the rec label is defined before it is referenced.`,
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
                description: `Recursion in parallel violation: Continue to rec label "${targetLabel}" appears in a parallel branch (parallel_id: "${parallelId}"), but the rec definition is outside this branch. Per Scribble specification 4.1.3, continue statements within parallel branches must only target rec labels defined within the same branch. Either move the rec inside the parallel branch or restructure the protocol.`,
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
        description: `Structural error: Fork node ${fork.id} with parallel_id "${parallelId}" has no matching join node. Every parallel fork must have a corresponding join where branches synchronize. This indicates a malformed CFG structure.`,
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
        description: `Structural error: Join node ${join.id} with parallel_id "${parallelId}" has no matching fork node. Every join must correspond to a parallel fork where branches were created. This indicates a malformed CFG structure.`,
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
// Multicast (P2 - MEDIUM for Correctness)
// ============================================================================

/**
 * Check multicast message semantics
 * Multicast messages should be properly handled in verification
 */
export function checkMulticast(cfg: CFG): MulticastResult {
  const warnings: MulticastWarning[] = [];

  // Find all action nodes with multicast (array of receivers)
  for (const node of cfg.nodes) {
    if (isActionNode(node) && isMessageAction(node.action)) {
      const action = node.action;

      if (Array.isArray(action.to) && action.to.length > 1) {
        // This is a multicast message
        warnings.push({
          actionNodeId: node.id,
          sender: action.from,
          receivers: action.to,
          description: `Multicast message from ${action.from} to [${action.to.join(', ')}] - verify all receivers handle message`,
        });
      }
    }
  }

  return {
    isValid: true, // Multicast is valid, just generates warnings for review
    warnings,
  };
}

// ============================================================================
// Self-Communication (P2 - MEDIUM - Spec Verification)
// ============================================================================

/**
 * Check for self-communication (role sending to itself)
 * This is semantically questionable in session types
 */
/**
 * Check for self-communication patterns
 *
 * DMst Extension: Self-communication is ALLOWED for local actions
 * (Definition 1: p -> p represents internal computation)
 *
 * For DMst protocols, self-communication is a valid pattern representing
 * local processing without synchronization. This checker is disabled
 * to support DMst local actions.
 */
export function checkSelfCommunication(cfg: CFG): SelfCommunicationResult {
  const violations: SelfCommunicationViolation[] = [];

  // DMst: Self-communication is explicitly allowed for local actions
  // (Definition 1: A -> A: Msg represents internal computation at A)
  // Classic MPST prohibits this, but DMst uses it for local processing
  //
  // Therefore, we do not flag self-communication as an error.
  // Uncomment the code below to restore classic MPST behavior:

  /*
  // Find all action nodes
  for (const node of cfg.nodes) {
    if (isActionNode(node) && isMessageAction(node.action)) {
      const action = node.action;

      // Check if sender is also receiver
      if (typeof action.to === 'string') {
        if (action.from === action.to) {
          violations.push({
            actionNodeId: node.id,
            role: action.from,
            description: `Role ${action.from} sends message to itself - self-communication is semantically questionable`,
          });
        }
      } else {
        // Array of receivers - check if sender is in the list
        if (action.to.includes(action.from)) {
          violations.push({
            actionNodeId: node.id,
            role: action.from,
            description: `Role ${action.from} is in multicast receiver list - includes self-communication`,
          });
        }
      }
    }
  }
  */

  return {
    isValid: true, // DMst: Always valid (self-communication allowed)
    violations,
  };
}

// ============================================================================
// Empty Choice Branch (P2 - MEDIUM - Well-Formedness)
// ============================================================================

/**
 * Check for empty choice branches
 * Empty branches may indicate structural issues
 */
export function checkEmptyChoiceBranch(cfg: CFG): EmptyChoiceBranchResult {
  const violations: EmptyBranchViolation[] = [];

  // Find all branch nodes
  const branchNodes = cfg.nodes.filter(isBranchNode) as BranchNode[];

  for (const branchNode of branchNodes) {
    // Get all outgoing branch edges
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id && e.edgeType === 'branch');

    // For each branch, check if it's empty (no actions before merge)
    for (const edge of branchEdges) {
      const branchLabel = edge.label || edge.to;

      // Find first node in branch
      const firstNode = cfg.nodes.find(n => n.id === edge.to);

      // If first node is directly a merge node, branch is empty
      if (firstNode && firstNode.type === 'merge') {
        violations.push({
          branchNodeId: branchNode.id,
          emptyBranchLabel: branchLabel,
          description: `Choice branch "${branchLabel}" is empty (no actions before merge)`,
        });
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

// ============================================================================
// Merge Reachability (P3 - Structural Correctness)
// ============================================================================

/**
 * Check if all choice branches reach the same merge node
 * Structural correctness check for choice constructs
 */
/**
 * Check if choice branches converge at the same merge point
 *
 * DMst Extension: Allows non-converging branches for updatable recursion
 * - Classic MPST: All branches must converge at same merge node
 * - DMst: Branches with 'continue' (updatable recursion) don't need to merge
 */
export function checkMergeReachability(cfg: CFG): MergeReachabilityResult {
  const violations: MergeViolation[] = [];

  // Find all branch nodes
  const branchNodes = cfg.nodes.filter(isBranchNode) as BranchNode[];

  for (const branchNode of branchNodes) {
    // Get all outgoing branch edges
    const branchEdges = cfg.edges.filter(e => e.from === branchNode.id && e.edgeType === 'branch');

    // For each branch, find the merge node it reaches
    const branchMerges: { [branchLabel: string]: string } = {};
    let hasContinueBranch = false;

    for (const edge of branchEdges) {
      const branchLabel = edge.label || edge.to;
      const { mergeNode, hasContinue } = findMergeNodeAndContinue(cfg, edge.to);

      if (hasContinue) {
        hasContinueBranch = true;
      }

      if (mergeNode) {
        branchMerges[branchLabel] = mergeNode.id;
      } else if (hasContinue) {
        branchMerges[branchLabel] = 'continue';
      } else {
        branchMerges[branchLabel] = 'none';
      }
    }

    // Check if all branches reach the same merge
    const mergeIds = Object.values(branchMerges);
    const uniqueMerges = new Set(mergeIds);

    // DMst: If any branch has 'continue' (updatable recursion), allow non-convergence
    if (uniqueMerges.size > 1 && !hasContinueBranch) {
      violations.push({
        branchNodeId: branchNode.id,
        description: `Choice branches do not converge at same merge node`,
        branches: branchMerges,
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Find the merge node reachable from a starting node and detect continue edges
 *
 * DMst Extension: Also detects if path contains 'continue' edges (updatable recursion)
 */
function findMergeNodeAndContinue(
  cfg: CFG,
  startNodeId: string
): { mergeNode: Node | null; hasContinue: boolean } {
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];
  let hasContinue = false;

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // If this is a merge node, return it
    if (node.type === 'merge') {
      return { mergeNode: node, hasContinue };
    }

    // If this is a terminal node, no merge found
    if (isTerminalNode(node)) {
      return { mergeNode: null, hasContinue };
    }

    // Check for continue edges (DMst updatable recursion)
    const continueEdges = cfg.edges.filter(e => e.from === nodeId && e.edgeType === 'continue');
    if (continueEdges.length > 0) {
      hasContinue = true;
      // Don't follow continue edges to avoid loops
    }

    // Follow outgoing edges (but not continue edges to avoid loops)
    const outgoing = cfg.edges.filter(e => e.from === nodeId && e.edgeType !== 'continue');
    for (const edge of outgoing) {
      queue.push(edge.to);
    }
  }

  return { mergeNode: null, hasContinue };
}

/**
 * Find the merge node reachable from a starting node
 * @deprecated Use findMergeNodeAndContinue for DMst support
 */
function findMergeNode(cfg: CFG, startNodeId: string): Node | null {
  return findMergeNodeAndContinue(cfg, startNodeId).mergeNode;
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
    multicast: opts.checkMulticast
      ? checkMulticast(cfg)
      : { isValid: true, warnings: [] },
    selfCommunication: opts.checkSelfCommunication
      ? checkSelfCommunication(cfg)
      : { isValid: true, violations: [] },
    emptyChoiceBranch: opts.checkEmptyChoiceBranch
      ? checkEmptyChoiceBranch(cfg)
      : { isValid: true, violations: [] },
    mergeReachability: opts.checkMergeReachability
      ? checkMergeReachability(cfg)
      : { isValid: true, violations: [] },
  };
}

/**
 * Convert CompleteVerification to a simple {isValid, errors} format
 * This is useful for tests and simple validation checks
 */
export function summarizeVerification(verification: CompleteVerification): {
  isValid: boolean;
  errors: { message: string; type?: string; location?: any }[];
  warnings: { message: string; type?: string }[];
} {
  const errors: { message: string; type?: string; location?: any }[] = [];
  const warnings: { message: string; type?: string }[] = [];

  // Check structural errors
  if (!verification.structural.valid) {
    errors.push(...verification.structural.errors);
  }
  warnings.push(...verification.structural.warnings);

  // Check deadlock
  if (verification.deadlock.hasDeadlock) {
    verification.deadlock.cycles.forEach(cycle => {
      errors.push({
        type: 'deadlock',
        message: cycle.description,
      });
    });
  }

  // Check liveness
  if (!verification.liveness.isLive) {
    verification.liveness.violations.forEach(v => {
      errors.push({
        type: 'liveness',
        message: v.description,
      });
    });
  }

  // Check parallel deadlock
  if (verification.parallelDeadlock.hasDeadlock) {
    verification.parallelDeadlock.conflicts.forEach(c => {
      errors.push({
        type: 'parallel-deadlock',
        message: c.description,
      });
    });
  }

  // Check race conditions
  if (verification.raceConditions.hasRaces) {
    verification.raceConditions.races.forEach(r => {
      errors.push({
        type: 'race-condition',
        message: r.description,
      });
    });
  }

  // Check progress
  if (!verification.progress.canProgress) {
    verification.progress.blockedNodes.forEach(node => {
      errors.push({
        type: 'progress',
        message: `Node ${node} cannot progress`,
      });
    });
  }

  // Check choice determinism
  if (!verification.choiceDeterminism.isDeterministic) {
    verification.choiceDeterminism.violations.forEach(v => {
      errors.push({
        type: 'choice-determinism',
        message: v.description,
      });
    });
  }

  // Check choice mergeability
  if (!verification.choiceMergeability.isMergeable) {
    verification.choiceMergeability.violations.forEach(v => {
      errors.push({
        type: 'choice-mergeability',
        message: v.description,
      });
    });
  }

  // Check connectedness
  if (!verification.connectedness.isConnected) {
    errors.push({
      type: 'connectedness',
      message: `Protocol is not connected. Orphaned roles: ${verification.connectedness.orphanedRoles.join(', ')}`,
    });
  }

  // Check nested recursion
  if (!verification.nestedRecursion.isValid) {
    verification.nestedRecursion.violations.forEach(v => {
      errors.push({
        type: 'nested-recursion',
        message: v.description,
      });
    });
  }

  // Check recursion in parallel
  if (!verification.recursionInParallel.isValid) {
    verification.recursionInParallel.violations.forEach(v => {
      errors.push({
        type: 'recursion-in-parallel',
        message: v.description,
      });
    });
  }

  // Check fork-join structure
  if (!verification.forkJoinStructure.isValid) {
    verification.forkJoinStructure.violations.forEach(v => {
      errors.push({
        type: 'fork-join',
        message: v.description,
      });
    });
  }

  // Multicast warnings (not errors)
  if (!verification.multicast.isValid) {
    verification.multicast.warnings.forEach(w => {
      warnings.push({
        type: 'multicast',
        message: w.description,
      });
    });
  }

  // Check self-communication
  if (!verification.selfCommunication.isValid) {
    verification.selfCommunication.violations.forEach(v => {
      errors.push({
        type: 'self-communication',
        message: v.description,
      });
    });
  }

  // Check empty choice branches
  if (!verification.emptyChoiceBranch.isValid) {
    verification.emptyChoiceBranch.violations.forEach(v => {
      errors.push({
        type: 'empty-choice-branch',
        message: v.description,
      });
    });
  }

  // Check merge reachability
  if (!verification.mergeReachability.isValid) {
    verification.mergeReachability.violations.forEach(v => {
      errors.push({
        type: 'merge-reachability',
        message: v.description,
      });
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
