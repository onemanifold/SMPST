/**
 * CFSM Projection Implementation
 *
 * Projects a global CFG to role-specific CFSMs.
 */

import type {
  CFG,
  Node,
  Edge,
  ActionNode,
  BranchNode,
  ForkNode,
  JoinNode,
  MessageAction,
} from '../cfg/types';
import {
  isInitialNode,
  isTerminalNode,
  isActionNode,
  isBranchNode,
  isMergeNode,
  isForkNode,
  isJoinNode,
  isRecursiveNode,
  isMessageAction,
} from '../cfg/types';
import type {
  CFSM,
  CFSMState,
  CFSMTransition,
  ProjectionResult,
  ProjectionError,
} from './types';

// ============================================================================
// Main Projection Functions
// ============================================================================

/**
 * Project a CFG to a single role's CFSM
 */
export function project(cfg: CFG, role: string): CFSM {
  // Validate role exists
  if (!cfg.roles.includes(role)) {
    throw new Error(`Role "${role}" not found in protocol. Available roles: ${cfg.roles.join(', ')}`);
  }

  const states: CFSMState[] = [];
  const transitions: CFSMTransition[] = [];
  const nodeMap = new Map<string, string>(); // CFG node ID -> CFSM state ID
  let stateCounter = 0;
  let transitionCounter = 0;

  // Helper: Create new CFSM state
  const createState = (type: CFSMState['type'], action?: MessageAction, label?: string): CFSMState => {
    const state: CFSMState = {
      id: `s${stateCounter++}`,
      type,
      action,
      label,
    };
    states.push(state);
    return state;
  };

  // Helper: Create transition
  const createTransition = (from: string, to: string, label?: string): CFSMTransition => {
    const transition: CFSMTransition = {
      id: `t${transitionCounter++}`,
      from,
      to,
      label,
    };
    transitions.push(transition);
    return transition;
  };

  // Helper: Check if role is involved in an action
  const isRoleInvolved = (action: MessageAction): boolean => {
    if (action.from === role) return true;
    if (typeof action.to === 'string') {
      return action.to === role;
    }
    return action.to.includes(role);
  };

  // Helper: Get outgoing edges from a node
  const getOutgoingEdges = (nodeId: string): Edge[] => {
    return cfg.edges.filter(e => e.from === nodeId);
  };

  // Helper: Get incoming edges to a node
  const getIncomingEdges = (nodeId: string): Edge[] => {
    return cfg.edges.filter(e => e.to === nodeId);
  };

  // Helper: Check if role appears in multiple branches of a parallel
  const roleInMultipleBranches = (forkNode: ForkNode): boolean => {
    const branches = getParallelBranches(cfg, forkNode);
    let branchesWithRole = 0;

    for (const branch of branches) {
      if (branchContainsRole(cfg, branch, role)) {
        branchesWithRole++;
      }
    }

    return branchesWithRole > 1;
  };

  // Process nodes in topological order
  const visited = new Set<string>();
  const processQueue: string[] = [];
  const continueEdges: Edge[] = []; // Collect continue edges for second pass

  // Find initial node
  const initialNode = cfg.nodes.find(isInitialNode);
  if (!initialNode) {
    throw new Error('CFG has no initial node');
  }

  // Create initial state
  const initialState = createState('initial');
  nodeMap.set(initialNode.id, initialState.id);

  // BFS traversal (skip continue edges in first pass)
  processQueue.push(initialNode.id);
  visited.add(initialNode.id);

  while (processQueue.length > 0) {
    const currentNodeId = processQueue.shift()!;
    const currentNode = cfg.nodes.find(n => n.id === currentNodeId)!;
    const currentStateId = nodeMap.get(currentNodeId);

    // Get outgoing edges (excluding continue edges for now)
    const outgoingEdges = getOutgoingEdges(currentNodeId);

    for (const edge of outgoingEdges) {
      // Collect continue edges for second pass
      if (edge.edgeType === 'continue') {
        continueEdges.push(edge);
        continue;
      }

      const targetNode = cfg.nodes.find(n => n.id === edge.to)!;

      // Determine if we need to create a state for this target
      let targetStateId = nodeMap.get(targetNode.id);

      if (!targetStateId) {
        // Create state based on node type
        if (isTerminalNode(targetNode)) {
          const terminalState = createState('terminal');
          targetStateId = terminalState.id;
          nodeMap.set(targetNode.id, targetStateId);
        } else if (isActionNode(targetNode)) {
          const action = targetNode.action;
          if (isMessageAction(action) && isRoleInvolved(action)) {
            // Role is involved - create send or receive state
            const stateType = action.from === role ? 'send' : 'receive';
            const actionState = createState(stateType, action);
            targetStateId = actionState.id;
            nodeMap.set(targetNode.id, targetStateId);
          } else {
            // Role not involved - skip this node, connect directly to next
            if (!visited.has(targetNode.id)) {
              visited.add(targetNode.id);
              processQueue.push(targetNode.id);
            }
            continue;
          }
        } else if (isBranchNode(targetNode)) {
          // Choice node
          const choiceState = createState('choice');
          targetStateId = choiceState.id;
          nodeMap.set(targetNode.id, targetStateId);
        } else if (isMergeNode(targetNode)) {
          // Merge node
          const mergeState = createState('merge');
          targetStateId = mergeState.id;
          nodeMap.set(targetNode.id, targetStateId);
        } else if (isForkNode(targetNode)) {
          // Fork node - only create if role in multiple branches
          if (roleInMultipleBranches(targetNode)) {
            const forkState = createState('fork');
            targetStateId = forkState.id;
            nodeMap.set(targetNode.id, targetStateId);
          } else {
            // Skip fork - role only in one branch
            if (!visited.has(targetNode.id)) {
              visited.add(targetNode.id);
              processQueue.push(targetNode.id);
            }
            continue;
          }
        } else if (isJoinNode(targetNode)) {
          // Join node - only create if we created corresponding fork
          const forkNode = cfg.nodes.find(
            n => isForkNode(n) && n.parallel_id === targetNode.parallel_id
          ) as ForkNode | undefined;

          if (forkNode && roleInMultipleBranches(forkNode)) {
            const joinState = createState('join');
            targetStateId = joinState.id;
            nodeMap.set(targetNode.id, targetStateId);
          } else {
            // Skip join
            if (!visited.has(targetNode.id)) {
              visited.add(targetNode.id);
              processQueue.push(targetNode.id);
            }
            continue;
          }
        } else if (isRecursiveNode(targetNode)) {
          // Recursion point - this is a label, not a real state
          // We need to find what comes after this label and map to that
          const recursionOutgoing = getOutgoingEdges(targetNode.id);
          if (recursionOutgoing.length > 0 && currentStateId) {
            // Map the recursion node to whatever comes after it
            // This will be resolved when we process the continue edge
            if (!nodeMap.has(targetNode.id)) {
              // Process what comes after recursion label first
              if (!visited.has(targetNode.id)) {
                visited.add(targetNode.id);
                processQueue.push(targetNode.id);
              }
            }
          }
          continue;
        }
      }

      // Create transition if both states exist
      if (currentStateId && targetStateId) {
        createTransition(currentStateId, targetStateId, edge.label);
      }

      // Add to queue if not visited
      if (!visited.has(targetNode.id)) {
        visited.add(targetNode.id);
        processQueue.push(targetNode.id);
      }
    }
  }

  // Second pass: Handle continue edges (back edges for recursion)
  for (const edge of continueEdges) {
    const fromStateId = nodeMap.get(edge.from);
    let toStateId = nodeMap.get(edge.to);

    // If the recursion label node wasn't mapped, find the first real state after it
    if (!toStateId) {
      const recursionNode = cfg.nodes.find(n => n.id === edge.to);
      if (recursionNode && isRecursiveNode(recursionNode)) {
        // Find the first non-recursion successor
        const successorEdges = getOutgoingEdges(recursionNode.id);
        for (const succEdge of successorEdges) {
          toStateId = nodeMap.get(succEdge.to);
          if (toStateId) break;
        }
      }
    }

    // Create the back edge transition
    if (fromStateId && toStateId) {
      createTransition(fromStateId, toStateId, edge.label);
    }
  }

  // Find terminal states
  const terminalStates = states.filter(s => s.type === 'terminal').map(s => s.id);

  return {
    role,
    states,
    transitions,
    initialState: initialState.id,
    terminalStates,
  };
}

/**
 * Project a CFG to all roles' CFSMs
 */
export function projectAll(cfg: CFG): ProjectionResult {
  const cfsms = new Map<string, CFSM>();
  const errors: ProjectionError[] = [];

  for (const role of cfg.roles) {
    try {
      const cfsm = project(cfg, role);
      cfsms.set(role, cfsm);
    } catch (error) {
      errors.push({
        type: 'invalid-projection',
        role,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    cfsms,
    roles: cfg.roles,
    errors,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all branches of a parallel construct
 */
function getParallelBranches(cfg: CFG, forkNode: ForkNode): string[][] {
  const branches: string[][] = [];
  const outgoingEdges = cfg.edges.filter(e => e.from === forkNode.id && e.edgeType === 'fork');

  for (const edge of outgoingEdges) {
    const branchNodes = collectBranchNodes(cfg, edge.to, forkNode.parallel_id);
    branches.push(branchNodes);
  }

  return branches;
}

/**
 * Collect all nodes in a branch until reaching join
 */
function collectBranchNodes(cfg: CFG, startNodeId: string, parallelId: string): string[] {
  const nodes: string[] = [];
  const queue = [startNodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // Stop at join node
    if (isJoinNode(node) && node.parallel_id === parallelId) {
      break;
    }

    nodes.push(nodeId);

    // Continue to successors
    const outgoing = cfg.edges.filter(e => e.from === nodeId);
    for (const edge of outgoing) {
      queue.push(edge.to);
    }
  }

  return nodes;
}

/**
 * Check if a branch contains actions involving a specific role
 */
function branchContainsRole(cfg: CFG, branchNodes: string[], role: string): boolean {
  for (const nodeId of branchNodes) {
    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node || !isActionNode(node)) continue;

    const action = node.action;
    if (isMessageAction(action)) {
      if (action.from === role) return true;
      if (typeof action.to === 'string' && action.to === role) return true;
      if (Array.isArray(action.to) && action.to.includes(role)) return true;
    }
  }

  return false;
}
