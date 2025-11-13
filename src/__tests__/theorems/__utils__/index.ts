/**
 * Theorem Verification Helper Utilities
 *
 * Provides reusable functions for theorem-driven tests to verify
 * formal properties systematically.
 */

import type { CFG, CFSM, Action } from '../../../core/cfg/types';
import { isActionNode, isMessageAction } from '../../../core/cfg/types';

/**
 * Extract all actions from a CFG in execution order
 */
export function extractActions(cfg: CFG): Action[] {
  return cfg.nodes
    .filter(isActionNode)
    .map(node => node.action);
}

/**
 * Extract message actions only
 */
export function extractMessageActions(cfg: CFG) {
  return cfg.nodes
    .filter(isActionNode)
    .filter(node => isMessageAction(node.action))
    .map(node => node.action);
}

/**
 * Count total actions across all projections
 */
export function countProjectionActions(projections: Map<string, CFSM>): number {
  return Array.from(projections.values()).reduce(
    (sum, cfsm) => sum + cfsm.nodes.filter(isActionNode).length,
    0
  );
}

/**
 * Check if action appears in projection
 */
export function projectionsContainAction(
  projections: Map<string, CFSM>,
  actionLabel: string
): boolean {
  for (const cfsm of projections.values()) {
    const hasAction = cfsm.nodes.some(node => {
      if (!isActionNode(node) || !isMessageAction(node.action)) return false;
      return node.action.label === actionLabel;
    });
    if (hasAction) return true;
  }
  return false;
}

/**
 * Extract all role names from CFG actions
 */
export function extractRolesFromActions(cfg: CFG): Set<string> {
  const roles = new Set<string>();

  for (const node of cfg.nodes) {
    if (isActionNode(node) && isMessageAction(node.action)) {
      const action = node.action;
      roles.add(action.from);

      if (typeof action.to === 'string') {
        roles.add(action.to);
      } else {
        action.to.forEach(r => roles.add(r));
      }
    }
  }

  return roles;
}

/**
 * Check if two CFGs have equivalent action sequences (trace equivalence)
 */
export function tracesEquivalent(cfg1: CFG, cfg2: CFG): boolean {
  const actions1 = extractMessageActions(cfg1);
  const actions2 = extractMessageActions(cfg2);

  if (actions1.length !== actions2.length) return false;

  for (let i = 0; i < actions1.length; i++) {
    if (!isMessageAction(actions1[i]) || !isMessageAction(actions2[i])) continue;

    const a1 = actions1[i];
    const a2 = actions2[i];

    if (a1.from !== a2.from || a1.label !== a2.label) {
      return false;
    }

    const to1 = typeof a1.to === 'string' ? a1.to : a1.to.join(',');
    const to2 = typeof a2.to === 'string' ? a2.to : a2.to.join(',');

    if (to1 !== to2) return false;
  }

  return true;
}

/**
 * Count nodes of a specific type in CFG
 */
export function countNodeType(cfg: CFG, nodeType: string): number {
  return cfg.nodes.filter(n => n.type === nodeType).length;
}

/**
 * Count edges of a specific type in CFG
 */
export function countEdgeType(cfg: CFG, edgeType: string): number {
  return cfg.edges.filter(e => e.edgeType === edgeType).length;
}

/**
 * Verify all roles have non-empty projections
 */
export function allRolesProjected(
  projections: Map<string, CFSM>,
  expectedRoles: string[]
): boolean {
  for (const role of expectedRoles) {
    const projection = projections.get(role);
    if (!projection || projection.nodes.length === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Extract CFG trace as string array for comparison
 */
export function extractTrace(cfg: CFG): string[] {
  return extractMessageActions(cfg).map(action => {
    const to = typeof action.to === 'string' ? action.to : action.to.join(',');
    return `${action.from}→${to}:${action.label}`;
  });
}

/**
 * Check if CFG has cycles (excluding continue edges)
 */
export function hasCycles(cfg: CFG): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const edges = cfg.edges.filter(
      e => e.from === nodeId && e.edgeType !== 'continue'
    );

    for (const edge of edges) {
      if (!visited.has(edge.to)) {
        if (dfs(edge.to)) return true;
      } else if (recursionStack.has(edge.to)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  const initial = cfg.nodes.find(n => n.type === 'initial');
  if (!initial) return false;

  return dfs(initial.id);
}
