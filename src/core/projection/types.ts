/**
 * CFSM (Communicating Finite State Machine) Types
 *
 * Based on formal CFSM definition with LTS (Labelled Transition System) semantics.
 *
 * A CFSM represents a single role's local view of a protocol.
 * Following the formal model: CFSM = (C, Σ, c₀, Δ)
 * - C: set of control states
 * - Σ: message alphabet
 * - c₀: initial state
 * - Δ: transition relation (state × action × state)
 *
 * KEY PRINCIPLE: Actions live on TRANSITIONS, not on states!
 *
 * References:
 * - "On Communicating Finite-State Machines" (Brand & Zafiropulo, 1983)
 * - "Multiparty Asynchronous Session Types" (Honda, Yoshida, Carbone, 2008)
 * - Formal CFSM semantics given as LTS: ⟨Q, Q₀, A, →⟩
 */

/**
 * A control state in the CFSM
 *
 * States are just nodes in the control flow graph.
 * They don't have "types" or "actions" - those belong to transitions!
 */
export interface CFSMState {
  id: string;

  // Optional label for display/debugging
  label?: string;

  // Metadata for visualization/debugging
  metadata?: Record<string, any>;
}

// Import types from AST for rich type preservation
import type { Message, SourceLocation, ProtocolParameter } from '../ast/types';

/**
 * Action types in CFSM
 * Based on LTS semantics for communicating automata
 */
export type CFSMAction =
  | SendAction
  | ReceiveAction
  | TauAction       // Silent/internal action (epsilon)
  | ChoiceAction    // Internal choice (branch selection)
  | SubProtocolCallAction;  // Sub-protocol invocation

/**
 * Send action: ! ⟨p, l⟨U⟩⟩
 * Corresponds to message send in session types
 *
 * ENRICHED: Preserves full Message object with type information
 * for TypeScript code generation and Scribble serialization
 */
export interface SendAction {
  type: 'send';
  to: string | string[];  // Recipient role(s)

  // ENRICHED: Full message with type information
  message: Message;

  // DEPRECATED: Use message.label instead
  /** @deprecated Use message.label */
  label?: string;

  // DEPRECATED: Use message.payload.payloadType instead
  /** @deprecated Use message.payload?.payloadType */
  payloadType?: string;

  // NEW: Source location for error reporting
  location?: SourceLocation;
}

/**
 * Receive action: ? ⟨p, l⟨U⟩⟩
 * Corresponds to message receive in session types
 *
 * ENRICHED: Preserves full Message object with type information
 */
export interface ReceiveAction {
  type: 'receive';
  from: string;      // Sender role

  // ENRICHED: Full message with type information
  message: Message;

  // DEPRECATED: Use message.label instead
  /** @deprecated Use message.label */
  label?: string;

  // DEPRECATED: Use message.payload.payloadType instead
  /** @deprecated Use message.payload?.payloadType */
  payloadType?: string;

  // NEW: Source location for error reporting
  location?: SourceLocation;
}

/**
 * Tau action (τ): Silent/internal transition
 * Used when role is not involved in a global action
 * Equivalent to epsilon transitions in automata theory
 */
export interface TauAction {
  type: 'tau';
}

/**
 * Choice action: Internal choice selection
 * Represents picking a branch in internal choice (⊕)
 */
export interface ChoiceAction {
  type: 'choice';
  branch: string;  // Branch label/identifier
}

/**
 * Sub-protocol call action: do SubProtocol(args)
 * Represents invoking a sub-protocol with role mapping
 * Requires call stack semantics (push/pop) for proper execution
 */
export interface SubProtocolCallAction {
  type: 'subprotocol';
  protocol: string;           // Sub-protocol name
  roleMapping: Record<string, string>;  // Formal parameter → actual role mapping
  returnState: string;        // State to return to after sub-protocol completes
}

/**
 * A transition in the CFSM
 *
 * Represents: (state, action, state') ∈ Δ
 * The action is what happens DURING the transition
 *
 * In LTS notation: s —α→ s' where α ∈ A (actions)
 */
export interface CFSMTransition {
  id: string;
  from: string;     // Source state ID
  to: string;       // Target state ID
  action: CFSMAction;  // ← THE ACTION LIVES HERE!

  // Optional guard condition (for conditional transitions)
  guard?: string;

  // Metadata for visualization
  metadata?: Record<string, any>;
}

/**
 * A complete CFSM (Communicating Finite State Machine) for a single role
 *
 * FORMAL DEFINITION (Deniélou & Yoshida 2012):
 *
 * A CFSM is a Labeled Transition System (LTS): M = (Q, q₀, A, →)
 * where:
 * - Q: finite set of states (control locations)
 * - q₀ ∈ Q: initial state
 * - A: action alphabet = {!p⟨l⟩, ?p⟨l⟩, τ} (send, receive, internal)
 * - → ⊆ Q × A × Q: transition relation
 *
 * REPRESENTATION IN CODE:
 * - Q = states: CFSMState[]
 * - q₀ = initialState: string
 * - A = embedded in transitions via CFSMAction
 * - → = transitions: CFSMTransition[] where each t = (from, action, to)
 *
 * IMPORTANT: This is a PURE LTS representation.
 * - Actions live on TRANSITIONS, not as separate nodes
 * - States are control locations, not computation steps
 * - This differs from CFG where actions are nodes
 *
 * ENRICHED: Now includes protocol metadata for code generation
 * and type information preservation.
 *
 * THEOREM TESTING: All session type theorems (projection soundness,
 * completeness, composability) can be expressed using only LTS properties:
 * - Traces: sequences of actions from initial to terminal states
 * - Branching: states with multiple outgoing transitions
 * - Cycles: back-edges in the transition graph
 * - Composition: synchronous product of CFSMs
 *
 * See docs/theory/projection-semantics.md for formal semantics.
 *
 * @reference Deniélou, P.-M., & Yoshida, N. (2012). Multiparty Session Types
 *            Meet Communicating Automata. ESOP 2012.
 * @reference Honda, K., Yoshida, N., & Carbone, M. (2008). Multiparty
 *            Asynchronous Session Types. POPL 2008.
 */
export interface CFSM {
  /** The role this CFSM represents (participant name) */
  role: string;

  /** ENRICHED: Protocol name for code generation */
  protocolName: string;

  /** ENRICHED: Protocol parameters (type and sig parameters) */
  parameters: ProtocolParameter[];

  /** Q: Finite set of control states */
  states: CFSMState[];

  /** →: Transition relation Q × A × Q (with actions on transitions) */
  transitions: CFSMTransition[];

  /** q₀: Initial state identifier */
  initialState: string;

  /** Q_term ⊆ Q: Terminal/accepting states */
  terminalStates: string[];

  /** Optional metadata for debugging and analysis */
  metadata?: {
    sourceProtocol?: string;
    projectionTime?: Date;
    // Extensible for future features
    [key: string]: any;
  };
}

/**
 * Result of projecting a CFG to all roles
 */
export interface ProjectionResult {
  cfsms: Map<string, CFSM>;  // Role name → CFSM
  roles: string[];           // All roles in protocol
  errors: ProjectionError[];
}

/**
 * Errors that can occur during projection
 */
export interface ProjectionError {
  type: ProjectionErrorType;
  role: string;
  message: string;
  nodeId?: string;
  details?: any;
}

export type ProjectionErrorType =
  | 'role-not-found'
  | 'invalid-projection'
  | 'merge-conflict'
  | 'choice-inconsistency'
  | 'parallel-conflict';
