/**
 * DMst Verification - Safe Protocol Update (Definition 14, ECOOP 2023)
 *
 * From Castro-Perez & Yoshida (ECOOP 2023), Definition 14:
 *
 * An updatable recursion μt.C[t ♦ (γ⃗. p ↪→ x⟨q⟩)] is safe if and only if
 * the 1-unfolding is safe (well-formed).
 *
 * 1-unfolding: C[(γ⃗. p ↪→ x⟨q⟩) ♦ (γ⃗. p ↪→ x⟨q⟩)]
 *
 * This module implements the safe update check required by Theorem 23 (Deadlock-Freedom).
 */

import type { CFG, Action, isUpdatableRecursionAction } from '../../cfg/types';
import { combineProtocols, checkChannelDisjointness } from '../../cfg/combining-operator';
import { verifyProtocol } from '../verifier';

// ============================================================================
// Safe Protocol Update (Definition 14)
// ============================================================================

/**
 * Check if an updatable recursion satisfies Definition 14 (Safe Protocol Update).
 *
 * Algorithm:
 * 1. Find all updatable recursion nodes in CFG
 * 2. For each updatable recursion:
 *    a. Extract the recursion body G
 *    b. Extract the update body G_update
 *    c. Compute 1-unfolding: G[X ↦ G ♢ G_update]
 *    d. Check if 1-unfolding is well-formed
 * 3. Return true if all updatable recursions are safe
 *
 * Well-formedness checks on 1-unfolding:
 * - Connectedness: All roles reachable
 * - Determinism: Choices unambiguous
 * - No races: Parallel branches use disjoint channels
 * - Progress: Can reach terminal or enabled action
 *
 * @param cfg - Control Flow Graph to check
 * @returns true if all updatable recursions are safe, false otherwise
 */
export function checkSafeProtocolUpdate(cfg: CFG): SafeUpdateResult {
  // Find all updatable recursion actions
  const updatableRecursions = findUpdatableRecursions(cfg);

  if (updatableRecursions.length === 0) {
    return {
      isSafe: true,
      updatableRecursions: [],
      violations: [],
    };
  }

  const violations: UpdateViolation[] = [];

  for (const recAction of updatableRecursions) {
    try {
      // Extract recursion and update bodies
      const { recursionBody, updateBody } = extractBodies(cfg, recAction.label);

      // Compute 1-unfolding
      const unfolding = compute1Unfolding(recursionBody, updateBody);

      // Check if 1-unfolding is well-formed
      const verificationResult = verifyProtocol(unfolding);

      // Aggregate errors from all verification checks
      const errors: string[] = [];

      if (!verificationResult.structural.valid) {
        errors.push(...verificationResult.structural.errors.map(e => e.message));
      }
      if (verificationResult.deadlock.hasDeadlock) {
        errors.push('Deadlock detected in 1-unfolding');
      }
      if (!verificationResult.connectedness.isConnected) {
        errors.push('1-unfolding is not connected');
      }
      if (verificationResult.raceConditions.hasRaces) {
        errors.push(`Race conditions detected: ${verificationResult.raceConditions.races.length} races`);
      }

      if (errors.length > 0) {
        violations.push({
          label: recAction.label,
          reason: `1-unfolding is not well-formed: ${errors.join(', ')}`,
          location: recAction.location,
        });
      }
    } catch (error) {
      violations.push({
        label: recAction.label,
        reason: `Failed to compute 1-unfolding: ${error instanceof Error ? error.message : String(error)}`,
        location: recAction.location,
      });
    }
  }

  return {
    isSafe: violations.length === 0,
    updatableRecursions: updatableRecursions.map(r => r.label),
    violations,
  };
}

/**
 * Compute 1-unfolding of updatable recursion.
 *
 * From Definition 14:
 * rec X { G; continue X with { G_update } }
 * 1-unfolding: G[X ↦ G ♢ G_update]
 *
 * Combining operator ♢ semantics:
 * - Interleaves actions from G and G_update
 * - Preserves safety properties (no races, progress)
 * - Actions must use disjoint channels
 *
 * ALGORITHM:
 * 1. Combine G and G_update using combining operator ♢
 * 2. Check channel disjointness (safety requirement)
 * 3. Return combined CFG if safe, throw error otherwise
 *
 * @param recursionBody - The main recursion body G
 * @param updateBody - The update body G_update
 * @returns CFG representing the 1-unfolding
 * @throws Error if combining fails (channel conflicts)
 */
export function compute1Unfolding(recursionBody: CFG, updateBody: CFG): CFG {
  // Use combining operator to interleave G and G_update
  const combineResult = combineProtocols(recursionBody, updateBody);

  if (!combineResult.success) {
    throw new Error(
      `Cannot combine protocols: ${combineResult.error}\n` +
      `Channel conflicts: ${combineResult.channelCheck.conflicts.length}`
    );
  }

  if (!combineResult.combined) {
    throw new Error('Combining operator returned success but no combined CFG');
  }

  // The combined CFG is the 1-unfolding
  return combineResult.combined;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find all updatable recursion actions in CFG
 */
function findUpdatableRecursions(cfg: CFG): Array<{
  label: string;
  location?: import('../../ast/types').SourceLocation;
}> {
  const updatableRecursions: Array<{
    label: string;
    location?: import('../../ast/types').SourceLocation;
  }> = [];

  for (const node of cfg.nodes) {
    if (node.type === 'action') {
      const action = node.action;
      if (action.kind === 'updatable-recursion') {
        updatableRecursions.push({
          label: action.label,
          location: action.location,
        });
      }
    }
  }

  return updatableRecursions;
}

/**
 * Extract recursion body and update body from CFG.
 *
 * Given a recursion label X, extract:
 * 1. Recursion body G: nodes from recursive node to updatable-recursion node
 * 2. Update body G_update: nodes from updatable-recursion node back to recursive node
 *
 * ALGORITHM (Definition 14, ECOOP 2023):
 * For rec X { G; continue X with { G_update } }:
 * - Recursion body G: subgraph from rec X to continue X with
 * - Update body G_update: subgraph inside continue X with { ... }
 *
 * These must be combined via ♢ operator to form 1-unfolding: G ♢ G_update
 *
 * @param cfg - Full CFG
 * @param label - Recursion label
 * @returns Recursion body and update body CFGs
 */
function extractBodies(
  cfg: CFG,
  label: string
): { recursionBody: CFG; updateBody: CFG } {
  // Find the recursive node with this label
  const recursiveNode = cfg.nodes.find(
    n => n.type === 'recursive' && (n as any).label === label
  );

  if (!recursiveNode) {
    throw new Error(`No recursive node found with label: ${label}`);
  }

  // Find the updatable-recursion action node with this label
  const updateActionNode = cfg.nodes.find(
    n => n.type === 'action' &&
    (n as any).action?.kind === 'updatable-recursion' &&
    (n as any).action?.label === label
  );

  if (!updateActionNode) {
    throw new Error(`No updatable-recursion action found with label: ${label}`);
  }

  // Extract recursion body: from recursive node to updatable-recursion node
  const recursionBodyNodes = extractSubgraph(
    cfg,
    recursiveNode.id,
    updateActionNode.id,
    false // Don't include end node
  );

  // Extract update body: from updatable-recursion node back to recursive node
  const updateBodyNodes = extractSubgraph(
    cfg,
    updateActionNode.id,
    recursiveNode.id,
    false // Don't include end node (would create cycle)
  );

  // Build CFG for recursion body
  const recursionBody = buildSubgraphCFG(cfg, recursionBodyNodes, recursiveNode.id);

  // Build CFG for update body
  const updateBody = buildSubgraphCFG(cfg, updateBodyNodes, updateActionNode.id);

  return {
    recursionBody,
    updateBody,
  };
}

/**
 * Extract subgraph from startNode to endNode using BFS.
 *
 * Returns all node IDs reachable from startNode up to (but not including) endNode.
 *
 * @param cfg - Full CFG
 * @param startNodeId - Starting node ID
 * @param endNodeId - Ending node ID (not included in result)
 * @param includeEnd - Whether to include the end node
 * @returns Set of node IDs in the subgraph
 */
function extractSubgraph(
  cfg: CFG,
  startNodeId: string,
  endNodeId: string,
  includeEnd: boolean
): Set<string> {
  const subgraphNodes = new Set<string>();
  const queue: string[] = [startNodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Stop at end node
    if (currentId === endNodeId) {
      if (includeEnd) {
        subgraphNodes.add(currentId);
      }
      continue;
    }

    subgraphNodes.add(currentId);

    // Find outgoing edges from current node
    const outgoingEdges = cfg.edges.filter(e => e.from === currentId);

    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return subgraphNodes;
}

/**
 * Build a CFG from a set of nodes.
 *
 * Creates a new CFG containing only the specified nodes and edges between them.
 *
 * @param cfg - Original CFG
 * @param nodeIds - Set of node IDs to include
 * @param initialNodeId - ID of the initial node in this subgraph
 * @returns New CFG with only the specified nodes
 */
function buildSubgraphCFG(
  cfg: CFG,
  nodeIds: Set<string>,
  initialNodeId: string
): CFG {
  // Filter nodes
  const nodes = cfg.nodes.filter(n => nodeIds.has(n.id));

  // Filter edges (only include edges where both endpoints are in the subgraph)
  const edges = cfg.edges.filter(
    e => nodeIds.has(e.from) && nodeIds.has(e.to)
  );

  // Find terminal nodes (nodes with no outgoing edges within the subgraph)
  const nodesWithOutgoing = new Set(edges.map(e => e.from));
  const terminalNodeIds = nodes
    .filter(n => !nodesWithOutgoing.has(n.id) && n.type !== 'terminal')
    .map(n => n.id);

  // If no terminal nodes found, add a synthetic terminal
  if (terminalNodeIds.length === 0 && nodes.length > 0) {
    // This can happen for update bodies that loop back
    // Add the last nodes as terminals
    const lastNodes = nodes.filter(n => {
      const outgoing = edges.filter(e => e.from === n.id);
      return outgoing.length === 0 || outgoing.every(e => !nodeIds.has(e.to));
    });
    terminalNodeIds.push(...lastNodes.map(n => n.id));
  }

  return {
    nodes,
    edges,
    roles: cfg.roles,
    initialNode: initialNodeId,
    protocolName: `${cfg.protocolName}_subgraph`,
    parameters: cfg.parameters,
    // Additional properties for combining operator compatibility
    id: `${cfg.protocolName}_${initialNodeId}_subgraph`,
    terminalNodes: terminalNodeIds,
    metadata: {
      isSubgraph: true,
      sourceProtocol: cfg.protocolName,
    },
  } as any; // Cast to any to avoid type errors with extended CFG
}

// ============================================================================
// Types
// ============================================================================

export interface SafeUpdateResult {
  isSafe: boolean;
  updatableRecursions: string[]; // Labels of all updatable recursions found
  violations: UpdateViolation[];
}

export interface UpdateViolation {
  label: string; // Recursion label
  reason: string; // Why the update is unsafe
  location?: import('../../ast/types').SourceLocation;
}
