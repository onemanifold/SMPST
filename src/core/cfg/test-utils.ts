/**
 * Testing Utilities for CFG
 * Helper functions for validating CFG correctness
 */

import type { CFG, Node, Edge, ForkNode, JoinNode, BranchNode } from './types';
import { isForkNode, isJoinNode, isBranchNode, isMergeNode, isInitialNode, isTerminalNode } from './types';

// ============================================================================
// Graph Traversal
// ============================================================================

/**
 * Find all nodes reachable from a starting node
 */
export function findReachableNodes(cfg: CFG, startId: string): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (reachable.has(currentId)) continue;

    reachable.add(currentId);

    // Add all nodes reachable via outgoing edges
    const outgoingEdges = cfg.edges.filter(e => e.from === currentId);
    for (const edge of outgoingEdges) {
      if (!reachable.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return reachable;
}

/**
 * Check if there's a path from one node to another
 */
export function canReach(cfg: CFG, fromId: string, toId: string): boolean {
  const reachable = findReachableNodes(cfg, fromId);
  return reachable.has(toId);
}

/**
 * Find all paths from one node to another (for testing)
 * Returns array of paths, where each path is array of node IDs
 */
export function findAllPaths(cfg: CFG, fromId: string, toId: string): string[][] {
  const paths: string[][] = [];

  function dfs(currentId: string, path: string[], visited: Set<string>) {
    if (currentId === toId) {
      paths.push([...path, currentId]);
      return;
    }

    if (visited.has(currentId)) return; // Avoid infinite loops

    visited.add(currentId);
    path.push(currentId);

    const outgoingEdges = cfg.edges.filter(e => e.from === currentId);
    for (const edge of outgoingEdges) {
      dfs(edge.to, [...path], new Set(visited));
    }
  }

  dfs(fromId, [], new Set());
  return paths;
}

/**
 * Get topological order of nodes (useful for verification)
 */
export function getTopologicalOrder(cfg: CFG): Node[] {
  const result: Node[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(nodeId: string) {
    if (temp.has(nodeId)) {
      throw new Error('Cycle detected in non-recursive path');
    }
    if (visited.has(nodeId)) return;

    temp.add(nodeId);

    const outgoingEdges = cfg.edges.filter(
      e => e.from === nodeId && e.edgeType !== 'continue'
    );
    for (const edge of outgoingEdges) {
      visit(edge.to);
    }

    temp.delete(nodeId);
    visited.add(nodeId);

    const node = cfg.nodes.find(n => n.id === nodeId)!;
    result.unshift(node);
  }

  const initial = cfg.nodes.find(n => n.type === 'initial');
  if (initial) {
    visit(initial.id);
  }

  return result;
}

// ============================================================================
// Structural Validation
// ============================================================================

/**
 * Check if CFG has exactly one initial node
 */
export function hasExactlyOneInitial(cfg: CFG): boolean {
  return cfg.nodes.filter(isInitialNode).length === 1;
}

/**
 * Check if CFG has at least one terminal node
 */
export function hasAtLeastOneTerminal(cfg: CFG): boolean {
  return cfg.nodes.filter(isTerminalNode).length >= 1;
}

/**
 * Check if all nodes are reachable from initial
 */
export function allNodesReachable(cfg: CFG): boolean {
  const initial = cfg.nodes.find(isInitialNode);
  if (!initial) return false;

  const reachable = findReachableNodes(cfg, initial.id);
  return reachable.size === cfg.nodes.length;
}

/**
 * Check if all nodes can reach at least one terminal
 */
export function allNodesReachTerminal(cfg: CFG): boolean {
  const terminals = cfg.nodes.filter(isTerminalNode);
  if (terminals.length === 0) return false;

  for (const node of cfg.nodes) {
    const canReachAnyTerminal = terminals.some(t => canReach(cfg, node.id, t.id));
    if (!canReachAnyTerminal) return false;
  }

  return true;
}

/**
 * Check if every fork has a matching join
 */
export function forksMatchJoins(cfg: CFG): boolean {
  const forks = cfg.nodes.filter(isForkNode) as ForkNode[];
  const joins = cfg.nodes.filter(isJoinNode) as JoinNode[];

  // Every fork must have a matching join
  for (const fork of forks) {
    const matchingJoin = joins.find(j => j.parallel_id === fork.parallel_id);
    if (!matchingJoin) return false;

    // Fork must be able to reach join
    if (!canReach(cfg, fork.id, matchingJoin.id)) return false;
  }

  // Every join must have a matching fork
  for (const join of joins) {
    const matchingFork = forks.find(f => f.parallel_id === join.parallel_id);
    if (!matchingFork) return false;
  }

  return true;
}

/**
 * Check if every branch has a matching merge
 */
export function branchesMatchMerges(cfg: CFG): boolean {
  const branches = cfg.nodes.filter(isBranchNode);

  for (const branch of branches) {
    const outgoingEdges = cfg.edges.filter(e => e.from === branch.id);

    // Branch must have at least 2 outgoing edges
    if (outgoingEdges.length < 2) return false;

    // Find the merge node that all branches converge to
    const mergeNodes = outgoingEdges.map(edge => findNextMerge(cfg, edge.to));

    // All branches should converge to the same merge
    const firstMerge = mergeNodes[0];
    if (!mergeNodes.every(m => m === firstMerge)) return false;
  }

  return true;
}

/**
 * Find the next merge node reachable from a given node
 */
export function findNextMerge(cfg: CFG, startId: string): string | null {
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = cfg.nodes.find(n => n.id === currentId);
    if (node && isMergeNode(node)) {
      return node.id;
    }

    const outgoingEdges = cfg.edges.filter(e => e.from === currentId);
    for (const edge of outgoingEdges) {
      queue.push(edge.to);
    }
  }

  return null;
}

/**
 * Check if there are any orphaned nodes
 */
export function hasNoOrphanedNodes(cfg: CFG): boolean {
  for (const node of cfg.nodes) {
    const incoming = cfg.edges.filter(e => e.to === node.id);
    const outgoing = cfg.edges.filter(e => e.from === node.id);

    if (isInitialNode(node)) {
      // Initial must have outgoing
      if (outgoing.length === 0) return false;
    } else if (isTerminalNode(node)) {
      // Terminal must have incoming
      if (incoming.length === 0) return false;
    } else {
      // All other nodes must have both
      if (incoming.length === 0 || outgoing.length === 0) return false;
    }
  }

  return true;
}

/**
 * Check if all edge references point to existing nodes
 */
export function allEdgesValid(cfg: CFG): boolean {
  const nodeIds = new Set(cfg.nodes.map(n => n.id));

  for (const edge of cfg.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate all structural invariants
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCFG(cfg: CFG): ValidationResult {
  const errors: string[] = [];

  if (!hasExactlyOneInitial(cfg)) {
    errors.push('CFG must have exactly one initial node');
  }

  if (!hasAtLeastOneTerminal(cfg)) {
    errors.push('CFG must have at least one terminal node');
  }

  if (!allNodesReachable(cfg)) {
    errors.push('All nodes must be reachable from initial node');
  }

  if (!allNodesReachTerminal(cfg)) {
    errors.push('All nodes must be able to reach a terminal node');
  }

  if (!forksMatchJoins(cfg)) {
    errors.push('Every fork must have a matching join with same parallel_id');
  }

  if (!branchesMatchMerges(cfg)) {
    errors.push('Every branch must have all paths converge to a merge');
  }

  if (!hasNoOrphanedNodes(cfg)) {
    errors.push('CFG has orphaned nodes (no incoming or outgoing edges)');
  }

  if (!allEdgesValid(cfg)) {
    errors.push('Some edges reference non-existent nodes');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Comparison and Debugging
// ============================================================================

/**
 * Convert CFG to canonical string for comparison
 */
export function cfgToCanonicalString(cfg: CFG): string {
  const nodeStrs = cfg.nodes
    .map(n => `${n.type}:${n.id}`)
    .sort()
    .join(',');

  const edgeStrs = cfg.edges
    .map(e => `${e.from}->${e.to}:${e.edgeType}`)
    .sort()
    .join(',');

  return `nodes[${nodeStrs}]edges[${edgeStrs}]`;
}

/**
 * Compare two CFGs for equality (structural)
 */
export function compareCFGs(cfg1: CFG, cfg2: CFG): boolean {
  return cfgToCanonicalString(cfg1) === cfgToCanonicalString(cfg2);
}

/**
 * Get statistics about a CFG (useful for debugging)
 */
export interface CFGStats {
  nodeCount: number;
  edgeCount: number;
  nodeTypes: Record<string, number>;
  edgeTypes: Record<string, number>;
  maxDepth: number;
  hasCycles: boolean;
}

export function getCFGStats(cfg: CFG): CFGStats {
  const nodeTypes: Record<string, number> = {};
  for (const node of cfg.nodes) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
  }

  const edgeTypes: Record<string, number> = {};
  for (const edge of cfg.edges) {
    edgeTypes[edge.edgeType] = (edgeTypes[edge.edgeType] || 0) + 1;
  }

  return {
    nodeCount: cfg.nodes.length,
    edgeCount: cfg.edges.length,
    nodeTypes,
    edgeTypes,
    maxDepth: 0, // TODO: implement depth calculation
    hasCycles: edgeTypes['continue'] ? true : false,
  };
}
