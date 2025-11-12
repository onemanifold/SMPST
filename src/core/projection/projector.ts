/**
 * CFSM Projection Implementation
 *
 * Projects a global CFG to role-specific CFSMs following LTS semantics.
 *
 * KEY PRINCIPLE: Actions live on TRANSITIONS, not states!
 *
 * Theoretical Foundation:
 * - Honda, Yoshida, Carbone (2008): "Multiparty Asynchronous Session Types"
 * - Deniélou, Yoshida (2012): "Multiparty Session Types Meet Communicating Automata"
 *
 * CFSM = (C, Σ, c₀, Δ) where:
 * - C: control states
 * - Σ: message alphabet (actions)
 * - c₀: initial state
 * - Δ: transition relation C × Σ × C (state × action × state)
 */

import type {
  CFG,
  Node,
  Edge,
  ActionNode,
  MessageAction,
  BranchNode,
  MergeNode,
  ForkNode,
  JoinNode,
  RecursiveNode,
} from '../cfg/types';
import {
  isInitialNode,
  isTerminalNode,
  isActionNode,
  isMessageAction,
  isBranchNode,
  isMergeNode,
  isForkNode,
  isJoinNode,
  isRecursiveNode,
} from '../cfg/types';
import type {
  CFSM,
  CFSMState,
  CFSMTransition,
  CFSMAction,
  SendAction,
  ReceiveAction,
  ProjectionResult,
  ProjectionError,
} from './types';

// ============================================================================
// Main Projection Functions
// ============================================================================

/**
 * Project a CFG to a single role's CFSM
 *
 * @param cfg - Global CFG
 * @param role - Role to project for
 * @returns CFSM for the specified role
 */
export function project(cfg: CFG, role: string): CFSM {
  // Validate role exists
  if (!cfg.roles.includes(role)) {
    throw new Error(
      `Role "${role}" not found in protocol. Available roles: ${cfg.roles.join(', ')}`
    );
  }

  const states: CFSMState[] = [];
  const transitions: CFSMTransition[] = [];
  const cfgNodeToState = new Map<string, string>(); // CFG node → CFSM state (for relevant nodes)
  const recNodeToState = new Map<string, string>(); // Recursion label node → entry state
  let stateCounter = 0;
  let transitionCounter = 0;

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a new CFSM state
   * States are JUST control locations - no actions or types!
   */
  const createState = (label?: string): CFSMState => {
    const state: CFSMState = {
      id: `s${stateCounter++}`,
      label,
    };
    states.push(state);
    return state;
  };

  /**
   * Create a transition with an action
   * Actions live HERE, on transitions, following LTS semantics
   */
  const createTransition = (
    from: string,
    to: string,
    action?: CFSMAction
  ): CFSMTransition => {
    const transition: CFSMTransition = {
      id: `t${transitionCounter++}`,
      from,
      to,
      action: action!,
    };
    transitions.push(transition);
    return transition;
  };

  /**
   * Check if role is involved in a message action
   */
  const isRoleInvolved = (action: MessageAction): boolean => {
    if (action.from === role) return true;
    if (typeof action.to === 'string') {
      return action.to === role;
    }
    return action.to.includes(role);
  };

  /**
   * Get outgoing edges from a CFG node
   */
  const getOutgoingEdges = (nodeId: string, includeType?: Edge['edgeType']): Edge[] => {
    const edges = cfg.edges.filter(e => e.from === nodeId);
    if (includeType) {
      return edges.filter(e => e.edgeType === includeType);
    }
    return edges;
  };

  // ============================================================================
  // Projection Algorithm
  // ============================================================================

  // Find initial node in CFG
  const initialNode = cfg.nodes.find(isInitialNode);
  if (!initialNode) {
    throw new Error('CFG has no initial node');
  }

  // Create initial state
  const initialState = createState('initial');
  cfgNodeToState.set(initialNode.id, initialState.id);

  // BFS traversal of CFG
  // Track (cfgNodeId, lastStateId) to prevent infinite loops
  const visited = new Set<string>();
  const queue: Array<{ cfgNodeId: string; lastStateId: string }> = [
    { cfgNodeId: initialNode.id, lastStateId: initialState.id },
  ];

  while (queue.length > 0) {
    const { cfgNodeId, lastStateId } = queue.shift()!;

    // Create visit key to prevent loops
    const visitKey = `${cfgNodeId}:${lastStateId}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const cfgNode = cfg.nodes.find(n => n.id === cfgNodeId)!;

    // Get outgoing edges (EXCLUDE continue edges - handle separately)
    const outgoingEdges = getOutgoingEdges(cfgNodeId).filter(
      e => e.edgeType !== 'continue'
    );

    for (const edge of outgoingEdges) {
      const targetNode = cfg.nodes.find(n => n.id === edge.to)!;

      // ========================================================================
      // Projection Rules (by node type)
      // ========================================================================

      if (isActionNode(targetNode)) {
        const action = targetNode.action;

        if (isMessageAction(action) && isRoleInvolved(action)) {
          // RULE 1: Role IS involved in message
          // Create new state and transition with send/receive action

          const newState = createState(targetNode.id);
          cfgNodeToState.set(targetNode.id, newState.id);

          // Determine action type based on formal rules:
          // (p→q:⟨U⟩.G) ↾ r = !⟨q,U⟩.(G↾p) if r=p (sender)
          //              = ?⟨p,U⟩.(G↾q) if r=q (receiver)
          const cfsmAction: CFSMAction =
            action.from === role
              ? ({
                  type: 'send',
                  to: action.to,
                  label: action.label,
                  payloadType: action.payloadType,
                } as SendAction)
              : ({
                  type: 'receive',
                  from: action.from,
                  label: action.label,
                  payloadType: action.payloadType,
                } as ReceiveAction);

          // Create transition from last relevant state to new state
          createTransition(lastStateId, newState.id, cfsmAction);

          // Continue with new state as last relevant
          queue.push({
            cfgNodeId: targetNode.id,
            lastStateId: newState.id,
          });
        } else {
          // RULE 2: Role NOT involved in message (tau-elimination)
          // (p→q:⟨U⟩.G) ↾ r = G↾r if r≠p, r≠q
          // Skip this action, continue with same last relevant state

          queue.push({
            cfgNodeId: targetNode.id,
            lastStateId, // Keep same last state
          });
        }
      } else if (isTerminalNode(targetNode)) {
        // Terminal node - create transition to terminal state
        let terminalStateId = cfgNodeToState.get(targetNode.id);
        if (!terminalStateId) {
          const terminalState = createState('terminal');
          terminalStateId = terminalState.id;
          cfgNodeToState.set(targetNode.id, terminalStateId);
        }

        // Create transition from last relevant state
        createTransition(lastStateId, terminalStateId);
      } else if (isBranchNode(targetNode)) {
        // Branch node (choice point)
        // Pass through - branches are handled by following all outgoing edges
        queue.push({
          cfgNodeId: targetNode.id,
          lastStateId,
        });
      } else if (isMergeNode(targetNode)) {
        // Merge node (convergence point)
        // Pass through - multiple paths converge
        queue.push({
          cfgNodeId: targetNode.id,
          lastStateId,
        });
      } else if (isForkNode(targetNode)) {
        // Fork node (parallel split)
        // For now, pass through
        // TODO: Handle fork/join when role in multiple branches
        queue.push({
          cfgNodeId: targetNode.id,
          lastStateId,
        });
      } else if (isJoinNode(targetNode)) {
        // Join node (parallel synchronization)
        // Pass through
        queue.push({
          cfgNodeId: targetNode.id,
          lastStateId,
        });
      } else if (isRecursiveNode(targetNode)) {
        // Recursion node (rec label)
        // Record the entry point for this recursion
        recNodeToState.set(targetNode.id, lastStateId);

        // Continue traversal
        queue.push({
          cfgNodeId: targetNode.id,
          lastStateId,
        });
      } else {
        // Unknown node type - pass through
        queue.push({
          cfgNodeId: targetNode.id,
          lastStateId,
        });
      }
    }
  }

  // ============================================================================
  // Second Pass: Handle Continue Edges (Back-Edges for Recursion)
  // ============================================================================

  // For each continue edge, find what CFSM state it should connect from/to
  const processedContinues = new Set<string>();

  for (const edge of cfg.edges.filter(e => e.edgeType === 'continue')) {
    const key = `${edge.from}:${edge.to}`;
    if (processedContinues.has(key)) continue;
    processedContinues.add(key);

    // Find the target recursion node
    const targetRec = cfg.nodes.find(n => n.id === edge.to);
    if (!targetRec || !isRecursiveNode(targetRec)) continue;

    // Find the entry state for this recursion
    const toStateId = recNodeToState.get(targetRec.id);
    if (!toStateId) continue; // Recursion not visited for this role

    // Find the "from" state - this is trickier
    // We need to find the last relevant state before the continue
    // This is the state corresponding to the CFG node that has the continue edge

    // Walk backwards from the continue edge to find the last action node for this role
    const visited = new Set<string>();
    const queue = [edge.from];
    let fromStateId: string | undefined;

    while (queue.length > 0 && !fromStateId) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // Check if this node has a corresponding CFSM state
      const stateId = cfgNodeToState.get(nodeId);
      if (stateId) {
        fromStateId = stateId;
        break;
      }

      // Otherwise, walk backwards through incoming edges
      const incomingEdges = cfg.edges.filter(e => e.to === nodeId && e.edgeType !== 'continue');
      for (const inEdge of incomingEdges) {
        queue.push(inEdge.from);
      }
    }

    // Create back-edge if we found both states
    if (fromStateId && toStateId) {
      createTransition(fromStateId, toStateId);
    }
  }

  // Find terminal states
  const terminalStates = states
    .filter(s => s.label === 'terminal')
    .map(s => s.id);

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
 *
 * @param cfg - Global CFG
 * @returns Map of role → CFSM for all roles
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
