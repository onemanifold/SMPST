/**
 * Verification Type Definitions
 * Results and error types for CFG verification algorithms
 */

import type { CFG, Node } from '../cfg/types';

// ============================================================================
// Verification Results
// ============================================================================

export interface VerificationError {
  type: ErrorType;
  message: string;
  nodes?: string[];  // Node IDs involved in the error
  details?: any;     // Additional error-specific details
}

export type ErrorType =
  | 'deadlock'
  | 'livelock'
  | 'unreachable'
  | 'orphaned'
  | 'fork-join-mismatch'
  | 'parallel-deadlock'
  | 'race-condition'
  | 'progress-violation'
  | 'determinism-violation';

export interface VerificationResult {
  valid: boolean;
  errors: VerificationError[];
  warnings: VerificationWarning[];
}

export interface VerificationWarning {
  type: WarningType;
  message: string;
  nodes?: string[];
  details?: any;
}

export type WarningType =
  | 'infinite-loop'
  | 'potential-race'
  | 'non-deterministic';

// ============================================================================
// Deadlock Detection Results
// ============================================================================

export interface DeadlockResult {
  hasDeadlock: boolean;
  cycles: DeadlockCycle[];
}

export interface DeadlockCycle {
  nodes: string[];  // Node IDs forming the cycle
  description: string;
}

// ============================================================================
// Liveness Results
// ============================================================================

export interface LivenessResult {
  isLive: boolean;
  violations: LivenessViolation[];
}

export interface LivenessViolation {
  type: 'stuck-state' | 'no-progress';
  nodeId: string;
  description: string;
}

// ============================================================================
// Parallel-Specific Results
// ============================================================================

export interface ParallelDeadlockResult {
  hasDeadlock: boolean;
  conflicts: ParallelConflict[];
}

export interface ParallelConflict {
  parallelId: string;
  branch1: string[];  // Node IDs in first branch
  branch2: string[];  // Node IDs in second branch
  description: string;
}

export interface RaceConditionResult {
  hasRaces: boolean;
  races: RaceCondition[];
}

export interface RaceCondition {
  parallelId: string;
  conflictingActions: [string, string];  // Two action node IDs
  resource?: string;  // What they're racing for (e.g., role name)
  description: string;
}

// ============================================================================
// Progress Results
// ============================================================================

export interface ProgressResult {
  canProgress: boolean;
  blockedNodes: string[];
  description?: string;
}

// ============================================================================
// Choice Determinism Results
// ============================================================================

export interface ChoiceDeterminismResult {
  isDeterministic: boolean;
  violations: DeterminismViolation[];
}

export interface DeterminismViolation {
  branchNodeId: string;
  duplicateLabel: string;
  branches: string[]; // Node IDs of action nodes with same label
  description: string;
}

// ============================================================================
// Choice Mergeability Results
// ============================================================================

export interface ChoiceMergeabilityResult {
  isMergeable: boolean;
  violations: MergeabilityViolation[];
}

export interface MergeabilityViolation {
  branchNodeId: string;
  role: string; // Role that has inconsistent behavior
  description: string;
  branches: { [branchLabel: string]: string[] }; // Branch label -> roles involved
}

// ============================================================================
// Connectedness Results
// ============================================================================

export interface ConnectednessResult {
  isConnected: boolean;
  orphanedRoles: string[]; // Roles declared but never used
  description?: string;
}

// ============================================================================
// Complete Verification
// ============================================================================

export interface CompleteVerification {
  structural: VerificationResult;    // Already done by validateCFG
  deadlock: DeadlockResult;
  liveness: LivenessResult;
  parallelDeadlock: ParallelDeadlockResult;
  raceConditions: RaceConditionResult;
  progress: ProgressResult;
  choiceDeterminism: ChoiceDeterminismResult;
  choiceMergeability: ChoiceMergeabilityResult;
  connectedness: ConnectednessResult;
}

// ============================================================================
// Verification Options
// ============================================================================

export interface VerificationOptions {
  checkDeadlock?: boolean;           // Default: true
  checkLiveness?: boolean;           // Default: true
  checkParallelDeadlock?: boolean;   // Default: true
  checkRaceConditions?: boolean;     // Default: true
  checkProgress?: boolean;           // Default: true
  checkChoiceDeterminism?: boolean;  // Default: true
  checkChoiceMergeability?: boolean; // Default: true
  checkConnectedness?: boolean;      // Default: true
  strictMode?: boolean;              // Fail on warnings too
}

export const DEFAULT_VERIFICATION_OPTIONS: VerificationOptions = {
  checkDeadlock: true,
  checkLiveness: true,
  checkParallelDeadlock: true,
  checkRaceConditions: true,
  checkProgress: true,
  checkChoiceDeterminism: true,
  checkChoiceMergeability: true,
  checkConnectedness: true,
  strictMode: false,
};
