/**
 * CFSM (Communicating Finite State Machine) Types
 *
 * A CFSM represents a single role's local view of a protocol.
 * Each role gets its own CFSM projected from the global CFG.
 */

import type { MessageAction, ChoiceAction } from '../parser/ast';

/**
 * CFSM State Types
 */
export type CFSMStateType =
  | 'initial'
  | 'send'
  | 'receive'
  | 'choice'
  | 'merge'
  | 'fork'
  | 'join'
  | 'terminal';

/**
 * A state in the CFSM
 */
export interface CFSMState {
  id: string;
  type: CFSMStateType;

  // For send/receive states
  action?: MessageAction;

  // For choice states
  choices?: ChoiceAction[];

  // Metadata
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * A transition in the CFSM
 */
export interface CFSMTransition {
  id: string;
  from: string;  // Source state ID
  to: string;    // Target state ID

  // Transition label (for choice branches)
  label?: string;

  // Guard condition (optional)
  guard?: string;

  metadata?: Record<string, any>;
}

/**
 * A complete CFSM for a single role
 */
export interface CFSM {
  role: string;              // The role this CFSM represents
  states: CFSMState[];       // All states
  transitions: CFSMTransition[];  // All transitions
  initialState: string;      // ID of initial state
  terminalStates: string[];  // IDs of terminal states

  metadata?: {
    sourceProtocol?: string;
    projectionTime?: Date;
  };
}

/**
 * Result of projecting a CFG to all roles
 */
export interface ProjectionResult {
  cfsms: Map<string, CFSM>;  // Role name -> CFSM
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
