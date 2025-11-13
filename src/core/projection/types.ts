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
 */
export interface SendAction {
  type: 'send';
  to: string | string[];  // Recipient role(s)
  label: string;          // Message label
  payloadType?: string;   // Message payload type
}

/**
 * Receive action: ? ⟨p, l⟨U⟩⟩
 * Corresponds to message receive in session types
 */
export interface ReceiveAction {
  type: 'receive';
  from: string;      // Sender role
  label: string;     // Message label
  payloadType?: string;
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
 * A complete CFSM for a single role
 *
 * Formal definition: CFSM = (C, Σ, c₀, Δ)
 * - C = states (control locations)
 * - Σ = {send, receive, tau, choice} × message labels
 * - c₀ = initialState
 * - Δ = transitions (transition relation)
 */
export interface CFSM {
  role: string;              // The role this CFSM represents
  states: CFSMState[];       // C: control states
  transitions: CFSMTransition[];  // Δ: transition relation with actions
  initialState: string;      // c₀: initial state ID
  terminalStates: string[];  // Final states (subset of C)

  metadata?: {
    sourceProtocol?: string;
    projectionTime?: Date;
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
