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

      if (verificationResult.errors.length > 0) {
        violations.push({
          label: recAction.label,
          reason: `1-unfolding is not well-formed: ${verificationResult.errors.map(e => e.message).join(', ')}`,
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
 * 1. Recursion body G: all nodes reachable from recursion point to continue
 * 2. Update body G_update: subgraph built during CFG construction
 *
 * ALGORITHM:
 * 1. Find recursion node with label X
 * 2. Find updatable-recursion action node
 * 3. Extract reachable nodes between recursion and update
 * 4. Extract update body nodes (marked during CFG build)
 *
 * NOTE: This is a simplified implementation. A full implementation would:
 * - Traverse CFG to build subgraphs
 * - Handle nested recursions
 * - Preserve metadata
 *
 * For now, we return the entire CFG as both bodies (conservative).
 * This is sound but may report false positives.
 *
 * TODO: Implement proper subgraph extraction
 *
 * @param cfg - Full CFG
 * @param label - Recursion label
 * @returns Recursion body and update body CFGs
 */
function extractBodies(
  cfg: CFG,
  label: string
): { recursionBody: CFG; updateBody: CFG } {
  // Conservative implementation: return full CFG for both
  // This ensures we check the entire protocol for safety
  //
  // A more precise implementation would:
  // 1. Find recursion node labeled X
  // 2. Extract subgraph from recursion to updatable-recursion node
  // 3. Extract update body subgraph (stored during CFG build)
  //
  // For safe update verification, being conservative (checking more) is safe
  return {
    recursionBody: cfg,
    updateBody: cfg,
  };
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
