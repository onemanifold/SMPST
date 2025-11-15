/**
 * DMst Verification Module
 *
 * Implements verification algorithms for Dynamically Updatable MPST
 * from Castro-Perez & Yoshida (ECOOP 2023).
 *
 * Core theorems implemented:
 * - Definition 14: Safe Protocol Update (safe-update.ts)
 * - Theorem 20: Trace Equivalence (trace-equivalence.ts)
 * - Theorem 23: Deadlock-Freedom (depends on Definition 14 + existing verifier)
 * - Theorem 29: Liveness (liveness.ts)
 *
 * Usage:
 * ```typescript
 * import { checkSafeProtocolUpdate, verifyTraceEquivalence, verifyLiveness } from './verification/dmst';
 *
 * // Check if updatable recursion is safe
 * const safeUpdate = checkSafeProtocolUpdate(cfg);
 *
 * // Verify trace equivalence (Theorem 20)
 * const traceEq = verifyTraceEquivalence(cfg, projections);
 *
 * // Verify liveness (Theorem 29)
 * const liveness = verifyLiveness(cfg, projections);
 * ```
 */

// Safe Protocol Update (Definition 14)
export { checkSafeProtocolUpdate, compute1Unfolding } from './safe-update';
export type { SafeUpdateResult, UpdateViolation } from './safe-update';

// Trace Equivalence (Theorem 20)
export {
  extractGlobalTrace,
  extractLocalTrace,
  extractDynamicParticipantTraces,
  composeTraces,
  compareTraces,
  verifyTraceEquivalence,
} from './trace-equivalence';
export type { TraceEvent, TraceEquivalenceResult } from './trace-equivalence';

// Liveness (Theorem 29)
export {
  extractSendReceivePairs,
  checkOrphanFreedom,
  buildParticipantStateGraphs,
  checkParticipantProgress,
  simulateFIFODelivery,
  checkBoundedBuffers,
  verifyLiveness,
} from './liveness';
export type {
  SendReceivePair,
  OrphanFreedomResult,
  StateGraph,
  ProgressResult,
  FIFOSimulationResult,
  BoundedBuffersResult,
  LivenessResult,
} from './liveness';
