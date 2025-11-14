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
    // TODO: Implement 1-unfolding computation
    // For now, return a placeholder indicating verification needed
    violations.push({
      label: recAction.label,
      reason: 'Safe update verification not yet implemented (Phase 6)',
      location: recAction.location,
    });
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
 * @param recursionBody - The main recursion body G
 * @param updateBody - The update body G_update
 * @returns CFG representing the 1-unfolding
 */
export function compute1Unfolding(recursionBody: CFG, updateBody: CFG): CFG {
  // TODO: Implement 1-unfolding algorithm
  // This requires:
  // 1. CFG composition via combining operator ♢
  // 2. Substitution of recursion variable
  // 3. Preservation of safety properties

  throw new Error('compute1Unfolding not yet implemented (Phase 6)');
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
