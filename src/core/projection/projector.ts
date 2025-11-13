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
  SubProtocolAction,
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
  isSubProtocolAction,
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
  SubProtocolCallAction,
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
 * @param protocolRegistry - Optional protocol registry for sub-protocol role mapping
 * @returns CFSM for the specified role
 */
export function project(cfg: CFG, role: string, protocolRegistry?: IProtocolRegistry): CFSM {
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

  /**
   * Check if role participates in a CFG branch (reachable from nodeId until join)
   * Used to detect if role appears in multiple parallel branches
   */
  const roleParticipatesInBranch = (startNodeId: string, parallelId: string): boolean => {
    const visited = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = cfg.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Stop at join node for this parallel block
      if (isJoinNode(node) && node.parallel_id === parallelId) {
        continue;
      }

      // Check if this is an action involving our role
      if (isActionNode(node) && isMessageAction(node.action)) {
        if (isRoleInvolved(node.action)) {
          return true;
        }
      }

      // Continue searching in this branch
      const edges = getOutgoingEdges(nodeId).filter(e => e.edgeType !== 'continue');
      for (const edge of edges) {
        queue.push(edge.to);
      }
    }

    return false;
  };

  /**
   * Extract actions from a parallel branch for a role
   * Returns list of actions the role performs in this branch
   */
  const extractBranchActions = (startNodeId: string, parallelId: string): CFSMAction[] => {
    const actions: CFSMAction[] = [];
    const visited = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = cfg.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Stop at join node
      if (isJoinNode(node) && node.parallel_id === parallelId) {
        continue;
      }

      // Extract action if role is involved
      if (isActionNode(node) && isMessageAction(node.action)) {
        const action = node.action;
        if (isRoleInvolved(action)) {
          // Convert to CFSM action
          if (action.from === role) {
            actions.push({
              type: 'send',
              to: action.to,
              label: action.label,
              payloadType: action.payloadType,
            } as SendAction);
          } else {
            actions.push({
              type: 'receive',
              from: action.from,
              label: action.label,
              payloadType: action.payloadType,
            } as ReceiveAction);
          }
        }
      }

      // Continue traversal
      const edges = getOutgoingEdges(nodeId).filter(e => e.edgeType !== 'continue');
      for (const edge of edges) {
        queue.push(edge.to);
      }
    }

    return actions;
  };

  /**
   * Generate diamond pattern for parallel interleaving
   * Creates states for all possible orderings of parallel actions
   * For N branches with actions [a1], [a2], ..., generates states for a1;a2, a2;a1, etc.
   */
  const generateDiamondPattern = (
    fromStateId: string,
    toStateId: string,
    branchActions: CFSMAction[][]
  ): void => {
    // Flatten all actions with branch index
    const allActions = branchActions.flatMap((actions, branchIdx) =>
      actions.map(action => ({ action, branchIdx }))
    );

    if (allActions.length === 0) {
      // No actions - just epsilon transition
      createTransition(fromStateId, toStateId);
      return;
    }

    if (allActions.length === 1) {
      // Single action - simple path
      const { action } = allActions[0];
      createTransition(fromStateId, toStateId, action);
      return;
    }

    // Multiple actions - need to generate interleavings
    // For now, support 2 actions (most common case)
    if (allActions.length === 2) {
      const [action1, action2] = allActions;

      // Path 1: action1 then action2
      const mid1 = createState(`par_${fromStateId}_path1`);
      createTransition(fromStateId, mid1.id, action1.action);
      createTransition(mid1.id, toStateId, action2.action);

      // Path 2: action2 then action1
      const mid2 = createState(`par_${fromStateId}_path2`);
      createTransition(fromStateId, mid2.id, action2.action);
      createTransition(mid2.id, toStateId, action1.action);
    } else {
      // More than 2 actions - for now, just do sequential (TODO: full interleaving)
      let currentState = fromStateId;
      for (let i = 0; i < allActions.length; i++) {
        const nextState = i === allActions.length - 1 ? toStateId : createState(`par_seq_${i}`).id;
        createTransition(currentState, nextState, allActions[i].action);
        currentState = nextState;
      }
    }
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
    let outgoingEdges = getOutgoingEdges(cfgNodeId).filter(
      e => e.edgeType !== 'continue'
    );

    // Special handling for fork nodes: filter fork edges based on role participation
    if (isForkNode(cfgNode)) {
      const forkEdges = outgoingEdges.filter(e => e.edgeType === 'fork');
      const otherEdges = outgoingEdges.filter(e => e.edgeType !== 'fork');

      // For fork edges, only include branches where role participates
      const relevantForkEdges = forkEdges.filter(edge =>
        roleParticipatesInBranch(edge.to, (cfgNode as any).parallel_id)
      );

      outgoingEdges = [...relevantForkEdges, ...otherEdges];
    }

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
        } else if (isSubProtocolAction(action)) {
          // RULE 3: Sub-protocol invocation
          // Check if role is involved in sub-protocol
          const isInvolved = action.roleArguments.includes(role);

          if (isInvolved) {
            // Role is involved - emit sub-protocol call action with call stack semantics
            // Create state for after sub-protocol returns
            const returnState = createState(`after_${action.protocol}`);

            // Build role mapping from formal parameters to actual arguments
            // Using protocol registry for formal correctness (Pabble, Hu et al. 2015)
            let roleMapping: Record<string, string> = {};

            if (protocolRegistry && protocolRegistry.has(action.protocol)) {
              // Look up sub-protocol declaration to get formal parameters
              const subProtocolDecl = protocolRegistry.resolve(action.protocol);
              const formalParams = subProtocolDecl.roles.map(r => r.name);
              const actualArgs = action.roleArguments;

              // ================================================================
              // Well-Formedness Validation (Pabble, Hu et al. 2015)
              // ================================================================

              // 1. Arity: |formal params| = |actual args|
              if (formalParams.length !== actualArgs.length) {
                throw new Error(
                  `Role arity mismatch in sub-protocol '${action.protocol}': ` +
                  `expected ${formalParams.length} roles, got ${actualArgs.length}`
                );
              }

              // 2. Uniqueness: No role aliasing (each actual role used at most once)
              const uniqueActuals = new Set(actualArgs);
              if (uniqueActuals.size !== actualArgs.length) {
                throw new Error(
                  `Role aliasing detected in sub-protocol '${action.protocol}': ` +
                  `roles must be distinct, got [${actualArgs.join(', ')}]`
                );
              }

              // 3. Scope: All actual roles must exist in parent protocol
              for (const actualRole of actualArgs) {
                if (!cfg.roles.includes(actualRole)) {
                  throw new Error(
                    `Role '${actualRole}' not found in parent protocol. ` +
                    `Available roles: [${cfg.roles.join(', ')}]`
                  );
                }
              }

              // Build formal substitution: σ(formalParam[i]) = actualArg[i]
              formalParams.forEach((formal, idx) => {
                roleMapping[formal] = actualArgs[idx];
              });
            } else {
              // No registry available - use placeholder mapping for backward compatibility
              action.roleArguments.forEach((r, idx) => {
                roleMapping[`role${idx}`] = r;
              });
            }

            // Create sub-protocol call action
            const subProtocolAction: SubProtocolCallAction = {
              type: 'subprotocol',
              protocol: action.protocol,
              roleMapping,
              returnState: returnState.id,
            };

            // Create transition with sub-protocol action
            createTransition(lastStateId, returnState.id, subProtocolAction);

            // Continue from return state
            queue.push({
              cfgNodeId: targetNode.id,
              lastStateId: returnState.id,
            });
          } else {
            // Role NOT involved - tau-elimination (epsilon transition)
            queue.push({
              cfgNodeId: targetNode.id,
              lastStateId, // Keep same last state (epsilon)
            });
          }
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
        // Check if role participates in multiple branches
        const forkEdges = getOutgoingEdges(targetNode.id, 'fork');
        const branchesWithRole = forkEdges.filter(edge =>
          roleParticipatesInBranch(edge.to, targetNode.parallel_id)
        );

        if (branchesWithRole.length > 1) {
          // Role participates in multiple parallel branches - need interleaving
          // Extract actions from each branch
          const branchActions = branchesWithRole.map(edge =>
            extractBranchActions(edge.to, targetNode.parallel_id)
          );

          // Find the join node to get target state
          const joinNode = cfg.nodes.find(
            n => isJoinNode(n) && n.parallel_id === targetNode.parallel_id
          );
          if (!joinNode) {
            throw new Error(`No join node found for parallel block ${targetNode.parallel_id}`);
          }

          // Create or get state for join node
          let joinStateId = cfgNodeToState.get(joinNode.id);
          if (!joinStateId) {
            const joinState = createState(joinNode.id);
            joinStateId = joinState.id;
            cfgNodeToState.set(joinNode.id, joinStateId);
          }

          // Generate diamond pattern for interleaving
          generateDiamondPattern(lastStateId, joinStateId, branchActions);

          // Continue from join node (don't process branches individually)
          queue.push({
            cfgNodeId: joinNode.id,
            lastStateId: joinStateId,
          });
        } else if (branchesWithRole.length === 1) {
          // Role participates in exactly 1 branch - follow that branch only
          // Don't push anything - let this iteration's edge loop handle the fork edge
          // But we need to skip this fork node handling and let normal edge traversal work
          // Actually, we need to continue from the fork node but only process the relevant branch
          //
          // The issue: we're inside the edge processing loop, and targetNode is the fork.
          // We can't control which edges get followed from here.
          //
          // Solution: Pass through the fork node, but the normal edge traversal will
          // follow ALL fork edges. We need to prevent the other fork edges from being followed.
          //
          // Better solution: Don't use a special case. Let normal traversal happen.
          // The tau-elimination will handle non-participating actions.

          // Just pass through - let normal edge traversal happen
          queue.push({
            cfgNodeId: targetNode.id,
            lastStateId,
          });
        } else {
          // Role participates in 0 branches - epsilon to join
          const joinNode = cfg.nodes.find(
            n => isJoinNode(n) && n.parallel_id === targetNode.parallel_id
          );
          if (!joinNode) {
            throw new Error(`No join node found for parallel block ${targetNode.parallel_id}`);
          }
          queue.push({
            cfgNodeId: joinNode.id,
            lastStateId,
          });
        }
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
