/**
 * Safety Property Types for "Less is More" MPST
 *
 * Based on Scalas & Yoshida (2019) "Less is More: Multiparty Session Types Revisited"
 *
 * Key concept: Safety is a SEMANTIC property checked on CFSM execution states,
 * not a SYNTACTIC property checked on session type structure.
 *
 * This enables bottom-up MPST where protocols like OAuth are accepted
 * (safe but not consistent with classic MPST duality).
 *
 * @reference Scalas, A., & Yoshida, N. (2019). Less is More: Multiparty Session
 *            Types Revisited. POPL 2019.
 */

import type { CFSM } from '../projection/types';

/**
 * Typing Context (Γ)
 *
 * Represents the current execution state of a multiparty session.
 * Maps each role to its CFSM and current control state.
 *
 * FORMAL DEFINITION (Definition 4.1):
 * A typing context Γ is a map: Role → (CFSM, CurrentState)
 *
 * USAGE:
 * - Initial context: all CFSMs at their initial states
 * - After reduction: CFSMs advance to successor states
 * - Terminal context: all CFSMs at terminal states
 *
 * EXAMPLE:
 * ```typescript
 * const Γ: TypingContext = {
 *   session: "oauth",
 *   cfsms: new Map([
 *     ["s", { machine: cfsm_s, currentState: "q0" }],
 *     ["c", { machine: cfsm_c, currentState: "q0" }],
 *     ["a", { machine: cfsm_a, currentState: "q0" }]
 *   ])
 * };
 * ```
 */
export interface TypingContext {
  /** Session identifier */
  session: string;

  /** Map from role name to CFSM with current state */
  cfsms: Map<string, CFSMInstance>;
}

/**
 * A CFSM instance with its current execution state
 *
 * Combines the static CFSM structure with the dynamic execution state.
 */
export interface CFSMInstance {
  /** The CFSM structure (states, transitions, alphabet) */
  machine: CFSM;

  /** Current control state identifier (element of machine.states) */
  currentState: string;
}

/**
 * Safety Property Interface
 *
 * Parametric safety property φ from Definition 4.1.
 * Different implementations provide different levels of guarantee:
 * - BasicSafety: Type safety (no communication errors)
 * - DeadlockFreedom: + no deadlocks
 * - Liveness: + all I/O eventually fires
 * - Live+: + under fair scheduling
 *
 * HIERARCHY (Lemma 5.9):
 * consistent ⊂ safe ⊂ df ⊂ live ⊂ live+
 *
 * where:
 * - consistent: Classic MPST duality (most restrictive)
 * - safe: Send/receive compatibility (Definition 4.1)
 * - df: Deadlock-free (Section 5.2)
 * - live: Liveness (Section 5.3)
 * - live+: Strong liveness (Section 5.4)
 */
export interface SafetyProperty {
  /**
   * Check if typing context satisfies this safety property
   *
   * @param context - Typing context to check
   * @returns Check result with violations if unsafe
   */
  check(context: TypingContext): SafetyCheckResult;

  /**
   * Name of this safety property (for error reporting)
   */
  readonly name: string;

  /**
   * Description of what this property guarantees
   */
  readonly description: string;
}

/**
 * Result of a safety check
 */
export interface SafetyCheckResult {
  /** Whether the context is safe */
  safe: boolean;

  /** Violations found (empty if safe) */
  violations: SafetyViolation[];

  /** Optional diagnostic information */
  diagnostics?: {
    /** States explored during reachability check */
    statesExplored?: number;

    /** Time taken for check (ms) */
    checkTime?: number;

    /** Additional information */
    [key: string]: any;
  };
}

/**
 * A violation of the safety property
 *
 * Describes why a context is unsafe according to Definition 4.1.
 */
export interface SafetyViolation {
  /** Type of violation */
  type: ViolationType;

  /** Roles involved in the violation */
  roles: string[];

  /** Human-readable message */
  message: string;

  /** The context where violation was detected */
  context?: TypingContext;

  /** Additional details */
  details?: {
    /** Message label that caused violation */
    messageLabel?: string;

    /** Sender role (for send/receive mismatches) */
    sender?: string;

    /** Receiver role (for send/receive mismatches) */
    receiver?: string;

    /** Expected vs actual information */
    expected?: string;
    actual?: string;

    /** Any other relevant info */
    [key: string]: any;
  };
}

/**
 * Types of safety violations
 *
 * Corresponds to the three rules of Definition 4.1:
 * - [S-⊕&]: Send/receive compatibility violations
 * - [S-μ]: Recursion violations (ill-founded)
 * - [S-→]: Preservation violations (unsafe after reduction)
 */
export type ViolationType =
  | 'send-receive-mismatch'    // [S-⊕&] violation: send without matching receive
  | 'orphan-receive'           // [S-⊕&] violation: receive without matching send
  | 'type-mismatch'            // [S-⊕&] violation: message types don't match
  | 'recursion-error'          // [S-μ] violation: ill-founded recursion
  | 'preservation-error'       // [S-→] violation: safety not preserved by reduction
  | 'stuck-state'              // Context cannot progress (all roles waiting)
  | 'other';                   // Other violations

/**
 * Communication action that can occur between roles
 *
 * Represents a single send/receive pair in the protocol execution.
 * Used by ContextReducer to advance the typing context.
 */
export interface Communication {
  /** Sender role */
  sender: string;

  /** Receiver role */
  receiver: string;

  /** Message label */
  message: string;

  /** Optional payload type */
  payloadType?: string;

  /** Transition IDs involved */
  senderTransition: string;
  receiverTransition: string;
}

/**
 * Result of attempting to find enabled communications
 */
export interface EnabledCommunications {
  /** All possible communications from this context */
  communications: Communication[];

  /** Whether context is terminal (no more communications possible) */
  terminal: boolean;

  /** Whether context is stuck (not terminal but no enabled communications) */
  stuck: boolean;
}
