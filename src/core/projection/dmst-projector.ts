/**
 * DMst Projection Extensions (Castro-Perez & Yoshida, ECOOP 2023)
 *
 * Extends the standard CFSM projection to handle:
 * - Definition 12: Projection for dynamic participants
 * - Definition 13: Projection for updatable recursion
 *
 * Core principle: Dynamic participants and updatable recursion require
 * special projection rules to maintain trace equivalence (Theorem 20).
 */

import type { CFG } from '../cfg/types';
import type { CFSM, CFSMAction } from './types';

// ============================================================================
// Definition 12: Projection for Dynamic Participants
// ============================================================================

/**
 * Project protocol for a dynamic participant.
 *
 * From ECOOP 2023 Definition 12:
 * Dynamic participants are created during execution, so their projection
 * starts from the creation point, not the protocol start.
 *
 * Projection rules for dynamic role r:
 * 1. [[new role r]]_r = ε (declaration is transparent to the role)
 * 2. [[p creates r]]_r = ?invitation from p (receive invitation)
 * 3. [[p creates r]]_p = !invitation to r (send invitation)
 * 4. [[p invites r]]_r = ?invite from p
 * 5. [[p invites r]]_p = !invite to r
 * 6. After invitation, standard projection rules apply
 *
 * @param cfg - Global protocol CFG
 * @param dynamicRole - Dynamic role to project for
 * @returns CFSM starting from creation point
 */
export function projectDynamicParticipant(
  cfg: CFG,
  dynamicRole: string
): CFSM {
  // TODO: Implement Definition 12
  // 1. Find creation point (CreateParticipantsAction for this role)
  // 2. Build CFSM starting from invitation
  // 3. Apply standard projection rules after invitation

  throw new Error('projectDynamicParticipant not yet implemented (Phase 7)');
}

/**
 * Check if a role is dynamic (declared with 'new role').
 *
 * @param cfg - Global protocol CFG
 * @param roleName - Role to check
 * @returns true if role is dynamic
 */
export function isDynamicRole(cfg: CFG, roleName: string): boolean {
  // TODO: Check for DynamicRoleDeclarationAction in CFG
  for (const node of cfg.nodes) {
    if (
      node.type === 'action' &&
      node.action.kind === 'dynamic-role-declaration' &&
      node.action.roleName === roleName
    ) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Definition 13: Projection for Updatable Recursion
// ============================================================================

/**
 * Project updatable recursion.
 *
 * From ECOOP 2023 Definition 13:
 * rec X { G; continue X with { G_update } }
 *
 * Projection rules:
 * [[rec X { G; continue X with { G_update } }]]_r =
 *   rec X { [[G]]_r; [[G_update]]_r; continue X }
 *
 * The update body G_update is projected and added to each iteration.
 * Safety: Requires Definition 14 (Safe Protocol Update) to hold.
 *
 * @param cfg - CFG containing updatable recursion
 * @param role - Role to project for
 * @param recursionLabel - Label of updatable recursion
 * @returns CFSM with updatable recursion projected
 */
export function projectUpdatableRecursion(
  cfg: CFG,
  role: string,
  recursionLabel: string
): CFSM {
  // TODO: Implement Definition 13
  // 1. Find recursion node with label
  // 2. Find UpdatableRecursionAction in recursion body
  // 3. Project both main body and update body
  // 4. Combine: rec X { [[G]]_r; [[G_update]]_r; continue X }

  throw new Error('projectUpdatableRecursion not yet implemented (Phase 7)');
}

/**
 * Extract actions for role from updatable recursion update body.
 *
 * Helper for Definition 13 projection.
 *
 * @param updateBodyCFG - CFG of update body
 * @param role - Role to extract actions for
 * @returns Sequence of CFSM actions for role
 */
export function extractUpdateBodyActions(
  updateBodyCFG: CFG,
  role: string
): CFSMAction[] {
  // TODO: Walk update body CFG, extract actions involving role
  // Apply standard projection rules to each action

  return [];
}

// ============================================================================
// Protocol Call Projection
// ============================================================================

/**
 * Project protocol call.
 *
 * From ECOOP 2023 Definition 1:
 * p ↪→ x⟨q⟩ (caller p invokes protocol x with participants q)
 *
 * Projection:
 * - [[p calls Proto(q)]]_p = !call(Proto, q) (initiate call)
 * - [[p calls Proto(q)]]_r where r ∈ q = ?call(Proto) from p (receive call)
 * - [[p calls Proto(q)]]_r where r ∉ {p} ∪ q = ε (not involved)
 *
 * @param caller - Role making the call
 * @param protocol - Protocol being called
 * @param participants - Roles in the called protocol
 * @param role - Role being projected
 * @returns CFSM action for this role, or undefined if not involved
 */
export function projectProtocolCall(
  caller: string,
  protocol: string,
  participants: string[],
  role: string
): CFSMAction | undefined {
  // Caller initiates the call
  if (caller === role) {
    return {
      type: 'subprotocol-call',
      protocol,
      participants,
    };
  }

  // Participants receive the call
  if (participants.includes(role)) {
    return {
      type: 'subprotocol-call',
      protocol,
      participants,
    };
  }

  // Not involved
  return undefined;
}

// ============================================================================
// Participant Creation Projection
// ============================================================================

/**
 * Project participant creation action.
 *
 * Projection:
 * - [[p creates r]]_p = !create(r) (creator sends)
 * - [[p creates r]]_r = ?create from p (created receives)
 * - [[p creates r]]_q where q ≠ p, q ≠ r = ε (not involved)
 *
 * @param creator - Role creating participant
 * @param roleName - Role type being created
 * @param instanceName - Optional instance name
 * @param role - Role being projected
 * @returns CFSM action or undefined
 */
export function projectParticipantCreation(
  creator: string,
  roleName: string,
  instanceName: string | undefined,
  role: string
): CFSMAction | undefined {
  if (creator === role) {
    // Creator performs create action
    return {
      type: 'send',
      to: instanceName || roleName,
      message: {
        type: 'Message',
        label: 'create',
        payload: undefined,
      },
    };
  }

  // Dynamic participant receives creation (initialization)
  // Note: Actual instance name is determined at runtime
  if (role === roleName || role === instanceName) {
    return {
      type: 'receive',
      from: creator,
      message: {
        type: 'Message',
        label: 'create',
        payload: undefined,
      },
    };
  }

  // Not involved
  return undefined;
}

/**
 * Project invitation action.
 *
 * Projection:
 * - [[p invites q]]_p = !invite to q
 * - [[p invites q]]_q = ?invite from p
 * - [[p invites q]]_r where r ≠ p, r ≠ q = ε
 *
 * @param inviter - Role sending invitation
 * @param invitee - Role receiving invitation
 * @param role - Role being projected
 * @returns CFSM action or undefined
 */
export function projectInvitation(
  inviter: string,
  invitee: string,
  role: string
): CFSMAction | undefined {
  if (inviter === role) {
    return {
      type: 'send',
      to: invitee,
      message: {
        type: 'Message',
        label: 'invite',
        payload: undefined,
      },
    };
  }

  if (invitee === role) {
    return {
      type: 'receive',
      from: inviter,
      message: {
        type: 'Message',
        label: 'invite',
        payload: undefined,
      },
    };
  }

  // Not involved
  return undefined;
}

// ============================================================================
// Main DMst Projection Function
// ============================================================================

/**
 * Project CFG with DMst extensions.
 *
 * Handles all DMst constructs:
 * - Dynamic participants (Definition 12)
 * - Updatable recursion (Definition 13)
 * - Protocol calls
 * - Participant creation and invitation
 *
 * @param cfg - Global protocol CFG
 * @param role - Role to project for
 * @returns CFSM with DMst projections applied
 */
export function projectWithDMst(cfg: CFG, role: string): CFSM {
  // TODO: Extend standard projection to handle DMst actions
  // 1. Check if role is dynamic → use projectDynamicParticipant
  // 2. For each action in CFG:
  //    - DynamicRoleDeclaration → ε (transparent)
  //    - ProtocolCall → projectProtocolCall
  //    - CreateParticipants → projectParticipantCreation
  //    - Invitation → projectInvitation
  //    - UpdatableRecursion → projectUpdatableRecursion
  //    - Standard actions → use existing projection
  // 3. Build CFSM with all projectedactions

  throw new Error('projectWithDMst not yet implemented (Phase 7)');
}
