/**
 * DMst Runtime Extensions (Castro-Perez & Yoshida, ECOOP 2023)
 *
 * Extends the standard MPST runtime to handle:
 * - Dynamic participant instantiation
 * - Invitation protocol synchronization
 * - Dynamic session management
 * - Protocol call stack semantics
 *
 * Core principle: Dynamic participants are created during execution
 * and join the protocol via invitation synchronization.
 */

import type { CFSM, CFSMAction } from '../projection/types';
import type {
  ExecutionState,
  Message,
  MessageTransport,
  ExecutionError,
  SimulationState,
} from './types';

// ============================================================================
// Dynamic Participant Types
// ============================================================================

/**
 * A dynamic participant instance created at runtime.
 *
 * From ECOOP 2023 Definition 12:
 * Dynamic participants are created during execution and join via invitation.
 */
export interface DynamicParticipant {
  /** Unique instance identifier (e.g., "worker_1", "worker_2") */
  instanceId: string;

  /** Role type (e.g., "Worker") */
  roleName: string;

  /** Creator role that instantiated this participant */
  creator: string;

  /** CFSM for this instance (projected for dynamic role) */
  cfsm: CFSM;

  /** Execution state */
  state: ExecutionState;

  /** When was this participant created */
  createdAt: number;

  /** Has invitation been completed? */
  invitationCompleted: boolean;
}

/**
 * Registry of all dynamic participants in a session.
 *
 * Manages lifecycle: creation → invitation → normal execution → termination
 */
export interface DynamicParticipantRegistry {
  /** All dynamic participants by instance ID */
  participants: Map<string, DynamicParticipant>;

  /** Next instance number for each role type */
  nextInstanceId: Map<string, number>;

  /** Pending invitations (creator → invitee instance ID) */
  pendingInvitations: Map<string, string[]>;
}

/**
 * Event when a dynamic participant is created.
 */
export interface ParticipantCreationEvent {
  type: 'participant-creation';
  timestamp: number;
  creator: string;
  roleName: string;
  instanceId: string;
}

/**
 * Event when invitation protocol completes.
 */
export interface InvitationCompleteEvent {
  type: 'invitation-complete';
  timestamp: number;
  inviter: string;
  invitee: string;
}

// ============================================================================
// Dynamic Participant Management
// ============================================================================

/**
 * Create a new dynamic participant instance.
 *
 * From Definition 12:
 * [[p creates r]]_p = !create(r) (creator sends)
 * [[p creates r]]_r = ?create from p (created receives)
 *
 * @param registry - Dynamic participant registry
 * @param creator - Role creating the participant
 * @param roleName - Role type to create
 * @param cfsm - Projected CFSM for this dynamic role
 * @param transport - Message transport for communication
 * @returns New participant instance
 */
export function createDynamicParticipant(
  registry: DynamicParticipantRegistry,
  creator: string,
  roleName: string,
  cfsm: CFSM,
  transport: MessageTransport
): DynamicParticipant {
  // Generate unique instance ID
  const nextId = registry.nextInstanceId.get(roleName) || 1;
  const instanceId = `${roleName}_${nextId}`;
  registry.nextInstanceId.set(roleName, nextId + 1);

  // Create participant
  const participant: DynamicParticipant = {
    instanceId,
    roleName,
    creator,
    cfsm,
    state: {
      role: instanceId,
      currentState: cfsm.initialState,
      visitedStates: [cfsm.initialState],
      pendingMessages: [],
      blocked: true, // Blocked until invitation completes
      completed: false,
      callStack: [],
    },
    createdAt: Date.now(),
    invitationCompleted: false,
  };

  // Register participant
  registry.participants.set(instanceId, participant);

  // Send creation message (creator → created)
  const creationMessage: Message = {
    id: `create_${instanceId}_${Date.now()}`,
    from: creator,
    to: instanceId,
    label: 'create',
    payload: undefined,
    timestamp: Date.now(),
  };

  // Queue creation message for participant
  participant.state.pendingMessages.push(creationMessage);

  return participant;
}

/**
 * Send invitation to dynamic participant.
 *
 * From Definition 12:
 * [[p invites q]]_p = !invite to q
 * [[p invites q]]_q = ?invite from p
 *
 * Invitation synchronization ensures participant is ready before
 * normal protocol actions begin.
 *
 * @param registry - Dynamic participant registry
 * @param inviter - Role sending invitation
 * @param inviteeId - Instance ID of invitee
 * @param transport - Message transport
 */
export function sendInvitation(
  registry: DynamicParticipantRegistry,
  inviter: string,
  inviteeId: string,
  transport: MessageTransport
): void {
  const participant = registry.participants.get(inviteeId);
  if (!participant) {
    throw new Error(`Dynamic participant ${inviteeId} not found`);
  }

  // Mark invitation as pending
  const pending = registry.pendingInvitations.get(inviter) || [];
  pending.push(inviteeId);
  registry.pendingInvitations.set(inviter, pending);

  // Send invitation message
  const inviteMessage: Message = {
    id: `invite_${inviteeId}_${Date.now()}`,
    from: inviter,
    to: inviteeId,
    label: 'invite',
    payload: undefined,
    timestamp: Date.now(),
  };

  transport.send(inviteMessage);
}

/**
 * Complete invitation protocol for a participant.
 *
 * Called when participant has processed creation and invitation messages.
 * After invitation completes, participant can engage in normal protocol actions.
 *
 * @param registry - Dynamic participant registry
 * @param instanceId - Participant instance ID
 */
export function completeInvitation(
  registry: DynamicParticipantRegistry,
  instanceId: string
): void {
  const participant = registry.participants.get(instanceId);
  if (!participant) {
    throw new Error(`Dynamic participant ${instanceId} not found`);
  }

  // Mark invitation as complete
  participant.invitationCompleted = true;
  participant.state.blocked = false;

  // Remove from pending invitations
  for (const [inviter, invitees] of registry.pendingInvitations.entries()) {
    const index = invitees.indexOf(instanceId);
    if (index !== -1) {
      invitees.splice(index, 1);
      if (invitees.length === 0) {
        registry.pendingInvitations.delete(inviter);
      }
      break;
    }
  }
}

/**
 * Check if a participant is ready to execute.
 *
 * Dynamic participants must complete invitation before normal execution.
 *
 * @param participant - Dynamic participant
 * @returns true if ready for normal execution
 */
export function isParticipantReady(participant: DynamicParticipant): boolean {
  return participant.invitationCompleted && !participant.state.blocked;
}

// ============================================================================
// Protocol Call Stack Semantics
// ============================================================================

/**
 * Protocol call stack entry.
 *
 * From ECOOP 2023 Definition 1:
 * p ↪→ x⟨q⟩ (caller p invokes protocol x with participants q)
 *
 * Protocol calls use push/pop stack semantics:
 * - On call: push current context, switch to called protocol
 * - On return: pop context, resume parent protocol
 */
export interface ProtocolCallFrame {
  /** Protocol being called */
  protocol: string;

  /** Caller role */
  caller: string;

  /** Participant role mappings */
  participants: Map<string, string>; // formal param → actual role

  /** CFSMs for all roles in called protocol */
  cfsms: Map<string, CFSM>;

  /** Execution states for called protocol */
  states: Map<string, ExecutionState>;

  /** Call timestamp */
  calledAt: number;
}

/**
 * Protocol call stack for managing nested protocol calls.
 */
export interface ProtocolCallStack {
  /** Stack of active protocol calls */
  frames: ProtocolCallFrame[];

  /** Current (top-of-stack) protocol */
  currentProtocol: string;
}

/**
 * Push a protocol call onto the stack.
 *
 * @param stack - Protocol call stack
 * @param frame - New call frame
 */
export function pushProtocolCall(
  stack: ProtocolCallStack,
  frame: ProtocolCallFrame
): void {
  stack.frames.push(frame);
  stack.currentProtocol = frame.protocol;
}

/**
 * Pop a protocol call from the stack.
 *
 * Called when protocol completes (all roles reach terminal states).
 *
 * @param stack - Protocol call stack
 * @returns Popped frame, or undefined if stack empty
 */
export function popProtocolCall(
  stack: ProtocolCallStack
): ProtocolCallFrame | undefined {
  const frame = stack.frames.pop();
  if (frame && stack.frames.length > 0) {
    stack.currentProtocol = stack.frames[stack.frames.length - 1].protocol;
  }
  return frame;
}

/**
 * Get current protocol call context.
 *
 * @param stack - Protocol call stack
 * @returns Current frame, or undefined if no active calls
 */
export function getCurrentProtocolCall(
  stack: ProtocolCallStack
): ProtocolCallFrame | undefined {
  return stack.frames[stack.frames.length - 1];
}

// ============================================================================
// DMst Simulation State
// ============================================================================

/**
 * Extended simulation state with DMst features.
 *
 * Extends SimulationState with:
 * - Dynamic participant registry
 * - Protocol call stack
 * - Creation/invitation events
 */
export interface DMstSimulationState extends SimulationState {
  /** Dynamic participants created during execution */
  dynamicParticipants: DynamicParticipantRegistry;

  /** Protocol call stack for nested protocols */
  protocolCallStack: ProtocolCallStack;

  /** Creation events */
  creationEvents: ParticipantCreationEvent[];

  /** Invitation events */
  invitationEvents: InvitationCompleteEvent[];
}

/**
 * Create initial DMst simulation state.
 *
 * @param staticRoles - Static (pre-declared) roles with CFSMs
 * @returns Initial DMst state
 */
export function createDMstSimulationState(
  staticRoles: Map<string, CFSM>
): DMstSimulationState {
  const roleStates = new Map<string, ExecutionState>();

  // Initialize static roles
  for (const [role, cfsm] of staticRoles.entries()) {
    roleStates.set(role, {
      role,
      currentState: cfsm.initialState,
      visitedStates: [cfsm.initialState],
      pendingMessages: [],
      blocked: false,
      completed: false,
      callStack: [],
    });
  }

  return {
    roles: roleStates,
    messageQueue: [],
    step: 0,
    completed: false,
    deadlocked: false,
    dynamicParticipants: {
      participants: new Map(),
      nextInstanceId: new Map(),
      pendingInvitations: new Map(),
    },
    protocolCallStack: {
      frames: [],
      currentProtocol: '', // Set by simulator
    },
    creationEvents: [],
    invitationEvents: [],
  };
}

/**
 * Get all active participants (static + dynamic).
 *
 * @param state - DMst simulation state
 * @returns Map of all active participants
 */
export function getAllActiveParticipants(
  state: DMstSimulationState
): Map<string, ExecutionState> {
  const all = new Map(state.roles);

  // Add dynamic participants that have completed invitation
  for (const [id, participant] of state.dynamicParticipants.participants) {
    if (participant.invitationCompleted) {
      all.set(id, participant.state);
    }
  }

  return all;
}

/**
 * Check if all participants (including dynamic) have terminated.
 *
 * @param state - DMst simulation state
 * @returns true if all participants completed
 */
export function allParticipantsTerminated(state: DMstSimulationState): boolean {
  // Check static roles
  for (const execState of state.roles.values()) {
    if (!execState.completed) {
      return false;
    }
  }

  // Check dynamic participants (only those that completed invitation)
  for (const participant of state.dynamicParticipants.participants.values()) {
    if (participant.invitationCompleted && !participant.state.completed) {
      return false;
    }
  }

  return true;
}

/**
 * Detect deadlock in DMst simulation.
 *
 * Deadlock occurs when:
 * 1. All participants are blocked
 * 2. No pending invitations
 * 3. No messages in transport
 *
 * @param state - DMst simulation state
 * @param transport - Message transport
 * @returns true if deadlocked
 */
export function detectDMstDeadlock(
  state: DMstSimulationState,
  transport: MessageTransport
): boolean {
  const allParticipants = getAllActiveParticipants(state);

  // Check if any participant can progress
  for (const execState of allParticipants.values()) {
    if (!execState.blocked && !execState.completed) {
      return false; // At least one can progress
    }
  }

  // Check for pending invitations (participants waiting to join)
  if (state.dynamicParticipants.pendingInvitations.size > 0) {
    return false; // Invitations in progress
  }

  // Check for messages in transport
  for (const role of allParticipants.keys()) {
    if (transport.hasMessage(role)) {
      return false; // Messages available
    }
  }

  // All blocked, no pending work → deadlock
  return true;
}

// ============================================================================
// Exports
// ============================================================================

export {
  type DynamicParticipant,
  type DynamicParticipantRegistry,
  type ParticipantCreationEvent,
  type InvitationCompleteEvent,
  type ProtocolCallFrame,
  type ProtocolCallStack,
  type DMstSimulationState,
};
