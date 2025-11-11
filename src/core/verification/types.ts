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
// Nested Recursion Results (P1 - HIGH)
// ============================================================================

export interface NestedRecursionResult {
  isValid: boolean;
  violations: RecursionViolation[];
}

export interface RecursionViolation {
  continueEdgeId?: string;
  targetLabel?: string;
  description: string;
  type: 'undefined-label' | 'scope-violation';
}

// ============================================================================
// Recursion in Parallel Results (P1 - HIGH)
// ============================================================================

export interface RecursionInParallelResult {
  isValid: boolean;
  violations: RecursionParallelViolation[];
}

export interface RecursionParallelViolation {
  continueEdgeId: string;
  recursiveNodeId: string;
  parallelId: string;
  description: string;
}

// ============================================================================
// Fork-Join Structure Results (P1 - HIGH)
// ============================================================================

export interface ForkJoinStructureResult {
  isValid: boolean;
  violations: ForkJoinViolation[];
}

export interface ForkJoinViolation {
  forkNodeId?: string;
  joinNodeId?: string;
  description: string;
  type: 'mismatched-pair' | 'orphaned-fork' | 'orphaned-join';
}

// ============================================================================
// Multicast Results (P2 - MEDIUM)
// ============================================================================

export interface MulticastResult {
  isValid: boolean;
  warnings: MulticastWarning[];
}

export interface MulticastWarning {
  actionNodeId: string;
  sender: string;
  receivers: string[];
  description: string;
}

// ============================================================================
// Self-Communication Results (P2 - MEDIUM)
// ============================================================================

export interface SelfCommunicationResult {
  isValid: boolean;
  violations: SelfCommunicationViolation[];
}

export interface SelfCommunicationViolation {
  actionNodeId: string;
  role: string;
  description: string;
}

// ============================================================================
// Empty Choice Branch Results (P2 - MEDIUM)
// ============================================================================

export interface EmptyChoiceBranchResult {
  isValid: boolean;
  violations: EmptyBranchViolation[];
}

export interface EmptyBranchViolation {
  branchNodeId: string;
  emptyBranchLabel: string;
  description: string;
}

// ============================================================================
// Merge Reachability Results (P3 - Structural Correctness)
// ============================================================================

export interface MergeReachabilityResult {
  isValid: boolean;
  violations: MergeViolation[];
}

export interface MergeViolation {
  branchNodeId: string;
  description: string;
  branches: { [branchLabel: string]: string }; // Branch label -> merge node ID
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
  nestedRecursion: NestedRecursionResult;
  recursionInParallel: RecursionInParallelResult;
  forkJoinStructure: ForkJoinStructureResult;
  multicast: MulticastResult;
  selfCommunication: SelfCommunicationResult;
  emptyChoiceBranch: EmptyChoiceBranchResult;
  mergeReachability: MergeReachabilityResult;
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
  checkNestedRecursion?: boolean;    // Default: true
  checkRecursionInParallel?: boolean;// Default: true
  checkForkJoinStructure?: boolean;  // Default: true
  checkMulticast?: boolean;          // Default: true
  checkSelfCommunication?: boolean;  // Default: true
  checkEmptyChoiceBranch?: boolean;  // Default: true
  checkMergeReachability?: boolean;  // Default: true
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
  checkNestedRecursion: true,
  checkRecursionInParallel: true,
  checkForkJoinStructure: true,
  checkMulticast: true,
  checkSelfCommunication: true,
  checkEmptyChoiceBranch: true,
  checkMergeReachability: true,
  strictMode: false,
};
