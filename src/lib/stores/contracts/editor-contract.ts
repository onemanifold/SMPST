/**
 * Backend Contract Handlers for Editor Store
 *
 * Ensures editor store handles ALL backend verification and projection properties
 */

import type { CompleteVerification } from '../../../core/verification/verifier';
import type { ProjectionResult, ProjectionError } from '../../../core/projection/projector';

/**
 * Verification Result Handler
 *
 * Forces handling of ALL 16 verification checks from verifyProtocol()
 */
export interface VerificationResultHandler {
  /**
   * Called when verification completes
   * @param result - Complete verification result with ALL checks
   */
  onVerificationComplete: (result: CompleteVerification) => void;
}

/**
 * Extract errors and warnings from complete verification result
 *
 * This function DOCUMENTS all verification properties and ensures
 * none are accidentally ignored when backend adds new checks.
 */
export function extractVerificationIssues(result: CompleteVerification): {
  errors: string[];
  warnings: string[];
  criticalIssues: string[];
  allChecks: Record<string, boolean>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const criticalIssues: string[] = [];

  // Track which checks were performed (for documentation)
  const allChecks: Record<string, boolean> = {};

  // 1. Structural (CRITICAL - orphaned nodes, unreachable states)
  allChecks.structural = result.structural.isValid;
  if (!result.structural.isValid) {
    criticalIssues.push(
      `Structural issues: ${result.structural.violations?.length || 0} violation(s)`
    );
  }

  // 2. Deadlock (CRITICAL)
  allChecks.deadlock = !result.deadlock.hasDeadlock;
  if (result.deadlock.hasDeadlock) {
    errors.push(`Deadlock detected: ${result.deadlock.cycles.length} cycle(s)`);
  }

  // 3. Liveness (CRITICAL)
  allChecks.liveness = result.liveness.isLive;
  if (!result.liveness.isLive) {
    errors.push(`Liveness violated: ${result.liveness.violations.length} violation(s)`);
  }

  // 4. Parallel Deadlock (CRITICAL)
  allChecks.parallelDeadlock = !result.parallelDeadlock.hasDeadlock;
  if (result.parallelDeadlock.hasDeadlock) {
    errors.push(
      `Parallel deadlock: ${result.parallelDeadlock.conflicts.length} conflict(s)`
    );
  }

  // 5. Race Conditions (WARNING)
  allChecks.raceConditions = !result.raceConditions.hasRaces;
  if (result.raceConditions.hasRaces) {
    warnings.push(
      `Race conditions: ${result.raceConditions.races.length} race(s)`
    );
  }

  // 6. Progress (CRITICAL)
  allChecks.progress = result.progress.canProgress;
  if (!result.progress.canProgress) {
    errors.push(`Progress blocked: ${result.progress.blockedNodes.length} node(s)`);
  }

  // 7. Choice Determinism (CRITICAL)
  allChecks.choiceDeterminism = result.choiceDeterminism.isDeterministic;
  if (!result.choiceDeterminism.isDeterministic) {
    errors.push(
      `Non-deterministic choice: ${result.choiceDeterminism.violations.length} violation(s)`
    );
  }

  // 8. Choice Mergeability (CRITICAL - consistency across branches)
  allChecks.choiceMergeability = result.choiceMergeability.isMergeable;
  if (!result.choiceMergeability.isMergeable) {
    errors.push(
      `Choice branches inconsistent: ${result.choiceMergeability.violations?.length || 0} violation(s)`
    );
  }

  // 9. Connectedness (CRITICAL - role participation)
  allChecks.connectedness = result.connectedness.isConnected;
  if (!result.connectedness.isConnected) {
    errors.push(
      `Protocol not connected: ${result.connectedness.disconnectedRoles?.length || 0} role(s) orphaned`
    );
  }

  // 10. Nested Recursion (CRITICAL - scope violations)
  allChecks.nestedRecursion = result.nestedRecursion.isValid;
  if (!result.nestedRecursion.isValid) {
    criticalIssues.push(
      `Recursion scope violation: ${result.nestedRecursion.violations?.length || 0} violation(s)`
    );
  }

  // 11. Recursion in Parallel (CRITICAL - illegal crossing)
  allChecks.recursionInParallel = result.recursionInParallel.isValid;
  if (!result.recursionInParallel.isValid) {
    criticalIssues.push(
      `Recursion crosses parallel boundary: ${result.recursionInParallel.violations?.length || 0} violation(s)`
    );
  }

  // 12. Fork-Join Structure (CRITICAL - matching pairs)
  allChecks.forkJoinStructure = result.forkJoinStructure.isValid;
  if (!result.forkJoinStructure.isValid) {
    errors.push(
      `Fork-join mismatch: ${result.forkJoinStructure.violations?.length || 0} violation(s)`
    );
  }

  // 13. Multicast (WARNING)
  allChecks.multicast = result.multicast.warnings.length === 0;
  if (result.multicast.warnings.length > 0) {
    result.multicast.warnings.forEach(w =>
      warnings.push(`Multicast: ${w.message}`)
    );
  }

  // 14. Self-Communication (ERROR - role sending to itself)
  allChecks.selfCommunication = result.selfCommunication.isValid;
  if (!result.selfCommunication.isValid) {
    errors.push(
      `Self-communication: ${result.selfCommunication.violations?.length || 0} violation(s)`
    );
  }

  // 15. Empty Choice Branch (WARNING)
  allChecks.emptyChoiceBranch = result.emptyChoiceBranch.isValid;
  if (!result.emptyChoiceBranch.isValid) {
    warnings.push(
      `Empty choice branches: ${result.emptyChoiceBranch.violations?.length || 0} branch(es)`
    );
  }

  // 16. Merge Reachability (CRITICAL - all branches reach merge)
  allChecks.mergeReachability = result.mergeReachability.isValid;
  if (!result.mergeReachability.isValid) {
    errors.push(
      `Unreachable merge: ${result.mergeReachability.violations?.length || 0} violation(s)`
    );
  }

  return { errors, warnings, criticalIssues, allChecks };
}

/**
 * Projection Result Handler
 *
 * Forces handling of projection errors that might be ignored
 */
export interface ProjectionResultHandler {
  /**
   * Called when projection succeeds for all roles
   */
  onSuccess: (result: ProjectionResult) => void;

  /**
   * Called when projection fails for one or more roles
   */
  onPartialFailure: (result: ProjectionResult, errors: ProjectionError[]) => void;
}

/**
 * Handle projection result with explicit error checking
 */
export function handleProjectionResult(
  result: ProjectionResult,
  handler: ProjectionResultHandler
): void {
  if (result.errors && result.errors.length > 0) {
    // Projection failed for some roles
    handler.onPartialFailure(result, result.errors);
  } else {
    // All roles projected successfully
    handler.onSuccess(result);
  }
}

/**
 * Format projection errors for display
 */
export function formatProjectionErrors(errors: ProjectionError[]): string[] {
  return errors.map(err => {
    const roleInfo = err.role ? ` for role ${err.role}` : '';
    const nodeInfo = err.nodeId ? ` at node ${err.nodeId}` : '';
    return `Projection failed${roleInfo}${nodeInfo}: ${err.message}`;
  });
}
