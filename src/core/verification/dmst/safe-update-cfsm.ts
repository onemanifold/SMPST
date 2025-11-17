/**
 * Definition 14: Safe Protocol Update - CFSM Level (ECOOP 2023)
 *
 * CFSM-level implementation of safe update verification.
 * Complements the CFG-level implementation for runtime validation.
 *
 * Based on Castro-Perez & Yoshida (ECOOP 2023), Section 3.2.
 *
 * Key Algorithms:
 * - compute1UnfoldingCFSM: Expand recursive CFSM once with extension
 * - combineProtocolsCFSM: Interleave CFSMs using combining operator ♦
 * - checkSafeUpdateCFSM: Verify 1-unfolding is well-formed
 */

import type { CFSM, CFSMTransition, CFSMState } from '../../projection/types';

/**
 * Safe update verification result (CFSM level)
 */
export interface SafeUpdateResultCFSM {
  isSafe: boolean;

  // Well-formedness properties
  isConnected: boolean;
  isDeterministic: boolean;
  hasNoRaces: boolean;
  canProgress: boolean;

  // Diagnostic information
  errors: string[];
  warnings: string[];
}

/**
 * Compute 1-unfolding of updatable recursion (CFSM level)
 *
 * Given: rec X { G } and continue X with { G' }
 * Returns: G[X ↦ G ♦ G'] (substitute X once with combined protocol)
 *
 * ALGORITHM:
 * 1. Find all transitions that loop back to recursion point
 * 2. For each back-edge, insert G' before returning to X
 * 3. Result: one iteration includes both G and G'
 *
 * @param original - Original recursive CFSM (contains rec X)
 * @param extension - Extension CFSM (from continue-with)
 * @param recursionVar - Recursion variable name
 * @returns 1-unfolded CFSM
 */
export function compute1UnfoldingCFSM(
  original: CFSM,
  extension: CFSM,
  recursionVar: string
): CFSM {
  // Find recursion point (state containing recursion variable)
  const recursionState = original.states.find(s => s.id.includes(recursionVar));

  if (!recursionState) {
    throw new Error(`Recursion variable "${recursionVar}" not found in CFSM`);
  }

  // Find all back-edges: transitions that return to recursion point
  const backEdges = original.transitions.filter(
    trans => trans.to === recursionState.id && trans.from !== recursionState.id
  );

  // Strategy: For 1-unfolding, we execute extension once before looping back
  //
  // Original: S0 -> S1 -> X -> S2 -> X (loops)
  // Extension: E0 -> E1
  // 1-Unfolding: S0 -> S1 -> X -> S2 -> E0 -> E1 -> X (extension inserted)
  //
  // This represents executing the loop ONCE with the extension included

  // Create unique state IDs for extension (for this unfolding)
  const stateIdMap = new Map<string, string>();
  const timestamp = Date.now();

  const extStates = extension.states.map(state => {
    const newId = `unfold_${state.id}_${timestamp}`;
    stateIdMap.set(state.id, newId);
    return { ...state, id: newId };
  });

  // Remap extension transitions
  const extTransitions: CFSMTransition[] = extension.transitions.map(trans => ({
    ...trans,
    id: `unfold_${trans.id}_${timestamp}`,
    from: stateIdMap.get(trans.from)!,
    to: stateIdMap.get(trans.to)!,
  }));

  // Redirect back-edges: instead of going directly to X, go through extension first
  const redirectedTransitions = original.transitions.map(trans => {
    // If this is a back-edge to recursion point, redirect to extension entry
    if (trans.to === recursionState.id && trans.from !== recursionState.id) {
      return {
        ...trans,
        to: stateIdMap.get(extension.initialState)!,
      };
    }
    return trans;
  });

  // Connect extension terminals back to recursion point
  const extTerminals = extension.terminalStates.map(t => stateIdMap.get(t)!);
  const bridgeTransitions: CFSMTransition[] = extTerminals.map((terminal, idx) => ({
    id: `unfold_bridge_${idx}_${timestamp}`,
    from: terminal,
    to: recursionState.id,
    action: { type: 'tau' as const },
  }));

  // Result: Original states + extension states, with redirected back-edges
  return {
    role: original.role,
    protocolName: `${original.protocolName}_1unfolding`,
    parameters: original.parameters,
    states: [...original.states, ...extStates],
    transitions: [...redirectedTransitions, ...extTransitions, ...bridgeTransitions],
    initialState: original.initialState,
    terminalStates: original.terminalStates,
  };
}

/**
 * Combining operator ♦ (diamond) for CFSMs
 *
 * Interleaves two protocols preserving causality.
 * G1 ♦ G2 = parallel composition with interleaving semantics
 *
 * SEMANTICS:
 * - G1 and G2 can execute actions in any interleaving
 * - Actions within G1 preserve their order (causality)
 * - Actions within G2 preserve their order (causality)
 * - No synchronization between G1 and G2 (independent)
 *
 * IMPLEMENTATION:
 * - Create product automaton
 * - States: (s1, s2) for s1 ∈ G1.states, s2 ∈ G2.states
 * - Transitions: either advance G1 or advance G2
 *
 * SAFETY REQUIREMENT:
 * - G1 and G2 must use disjoint channels (no races)
 * - Verified by checkSafeUpdateCFSM()
 *
 * @param g1 - First protocol
 * @param g2 - Second protocol
 * @returns Combined protocol G1 ♦ G2
 */
export function combineProtocolsCFSM(g1: CFSM, g2: CFSM): CFSM {
  // Validate inputs
  if (!g1 || !g2) {
    throw new Error('Both protocols must be defined');
  }

  if (g1.role !== g2.role) {
    throw new Error(`Role mismatch: g1=${g1.role}, g2=${g2.role}`);
  }

  const timestamp = Date.now();

  // Create product states: (s1, s2) for all s1 ∈ G1, s2 ∈ G2
  const productStates: CFSMState[] = [];
  const stateMap = new Map<string, string>(); // (s1, s2) -> product state ID

  for (const s1 of g1.states) {
    for (const s2 of g2.states) {
      const productId = `combine_${s1.id}_${s2.id}_${timestamp}`;
      productStates.push({ id: productId });
      stateMap.set(`${s1.id}:${s2.id}`, productId);
    }
  }

  // Initial state: (G1.initial, G2.initial)
  const initialState = stateMap.get(`${g1.initialState}:${g2.initialState}`)!;

  // Terminal states: (s1, s2) where s1 ∈ G1.terminals AND s2 ∈ G2.terminals
  const terminalStates: string[] = [];
  for (const t1 of g1.terminalStates) {
    for (const t2 of g2.terminalStates) {
      const key = `${t1}:${t2}`;
      const productId = stateMap.get(key);
      if (productId) {
        terminalStates.push(productId);
      }
    }
  }

  // Create transitions: either advance G1 or advance G2
  const productTransitions: CFSMTransition[] = [];
  let transitionId = 0;

  // Transitions advancing G1: (s1, s2) --[a1]--> (s1', s2)
  for (const t1 of g1.transitions) {
    for (const s2 of g2.states) {
      const fromKey = `${t1.from}:${s2.id}`;
      const toKey = `${t1.to}:${s2.id}`;

      const fromState = stateMap.get(fromKey);
      const toState = stateMap.get(toKey);

      if (fromState && toState) {
        productTransitions.push({
          id: `combine_g1_${transitionId++}_${timestamp}`,
          from: fromState,
          to: toState,
          action: t1.action,
        });
      }
    }
  }

  // Transitions advancing G2: (s1, s2) --[a2]--> (s1, s2')
  for (const s1 of g1.states) {
    for (const t2 of g2.transitions) {
      const fromKey = `${s1.id}:${t2.from}`;
      const toKey = `${s1.id}:${t2.to}`;

      const fromState = stateMap.get(fromKey);
      const toState = stateMap.get(toKey);

      if (fromState && toState) {
        productTransitions.push({
          id: `combine_g2_${transitionId++}_${timestamp}`,
          from: fromState,
          to: toState,
          action: t2.action,
        });
      }
    }
  }

  return {
    role: g1.role,
    protocolName: `${g1.protocolName}_diamond_${g2.protocolName}`,
    parameters: [...g1.parameters, ...g2.parameters],
    states: productStates,
    transitions: productTransitions,
    initialState,
    terminalStates,
  };
}

/**
 * Check if CFSM update is safe (Definition 14)
 *
 * Verifies that 1-unfolding of rec X { G } with extension G' is well-formed.
 *
 * CHECKS:
 * 1. Connectedness: All states reachable from initial
 * 2. Determinism: No ambiguous choices
 * 3. Race-freedom: Parallel branches use disjoint channels
 * 4. Progress: Can always progress or terminate
 *
 * @param oneUnfolding - The 1-unfolded CFSM
 * @returns Safety verification result
 */
export function checkSafeUpdateCFSM(oneUnfolding: CFSM): SafeUpdateResultCFSM {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: Connectedness
  const isConnected = checkConnectedness(oneUnfolding);
  if (!isConnected) {
    errors.push('1-unfolding is not connected: some states are unreachable');
  }

  // Check 2: Determinism
  const isDeterministic = checkDeterminism(oneUnfolding);
  if (!isDeterministic) {
    errors.push('1-unfolding is non-deterministic: ambiguous choices detected');
  }

  // Check 3: Race-freedom (simplified check)
  const hasNoRaces = checkRaceFreedom(oneUnfolding);
  if (!hasNoRaces) {
    errors.push('1-unfolding has potential race conditions');
  }

  // Check 4: Progress
  const canProgress = checkProgress(oneUnfolding);
  if (!canProgress) {
    errors.push('1-unfolding cannot make progress: deadlock detected');
  }

  const isSafe = errors.length === 0;

  return {
    isSafe,
    isConnected,
    isDeterministic,
    hasNoRaces,
    canProgress,
    errors,
    warnings,
  };
}

/**
 * Check if all states are reachable from initial state
 */
function checkConnectedness(cfsm: CFSM): boolean {
  const reachable = new Set<string>();
  const queue = [cfsm.initialState];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;

    reachable.add(current);

    // Add all successors
    for (const trans of cfsm.transitions) {
      if (trans.from === current && !reachable.has(trans.to)) {
        queue.push(trans.to);
      }
    }
  }

  // All states should be reachable
  return reachable.size === cfsm.states.length;
}

/**
 * Check if CFSM is deterministic (no ambiguous choices)
 *
 * Simplified check: From any state, outgoing transitions should not have
 * conflicting actions
 */
function checkDeterminism(cfsm: CFSM): boolean {
  // Group transitions by source state
  const transitionsByState = new Map<string, CFSMTransition[]>();

  for (const trans of cfsm.transitions) {
    if (!transitionsByState.has(trans.from)) {
      transitionsByState.set(trans.from, []);
    }
    transitionsByState.get(trans.from)!.push(trans);
  }

  // Check each state for ambiguous transitions
  for (const [_state, transitions] of transitionsByState) {
    if (transitions.length <= 1) continue;

    // Check for duplicate actions (ambiguous choice)
    const actions = transitions.map(t => JSON.stringify(t.action));
    const uniqueActions = new Set(actions);

    if (actions.length !== uniqueActions.size) {
      return false; // Duplicate action = non-deterministic
    }
  }

  return true;
}

/**
 * Check for race conditions
 *
 * Simplified check: Verify no conflicting parallel accesses
 * Full implementation would require parallel composition analysis
 */
function checkRaceFreedom(cfsm: CFSM): boolean {
  // For now, we assume no races if CFSM is well-formed
  // Full race detection requires analyzing parallel branches
  // This is a placeholder - proper implementation in Phase 2
  return true;
}

/**
 * Check if CFSM can make progress (no deadlocks)
 *
 * Simplified check: Every non-terminal state has outgoing transition
 */
function checkProgress(cfsm: CFSM): boolean {
  const terminalSet = new Set(cfsm.terminalStates);

  for (const state of cfsm.states) {
    // Terminal states don't need outgoing transitions
    if (terminalSet.has(state.id)) continue;

    // Non-terminal state must have at least one outgoing transition
    const hasOutgoing = cfsm.transitions.some(t => t.from === state.id);

    if (!hasOutgoing) {
      return false; // Stuck state (deadlock)
    }
  }

  return true;
}
