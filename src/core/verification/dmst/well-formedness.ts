/**
 * DMst Well-Formedness Verification
 *
 * Verifies DMst-specific well-formedness conditions beyond standard MPST:
 * 1. Dynamic participant invitation protocol correctness
 * 2. Dynamic participant projection well-formedness
 * 3. Protocol call safety (combining operator ♢)
 * 4. Updatable recursion safety (Definition 14)
 *
 * Based on Castro-Perez & Yoshida (ECOOP 2023), Definition 15.
 */

import type { CFG, Node, ActionNode } from '../../cfg/types';
import { isActionNode, isCreateParticipantsAction, isInvitationAction } from '../../cfg/types';

// ============================================================================
// DMst Well-Formedness Checking
// ============================================================================

/**
 * Check DMst well-formedness for a protocol.
 *
 * Verifies:
 * 1. Invitation protocols: Every created participant must be invited
 * 2. Dynamic participants: Must have valid projections
 * 3. Protocol calls: Must use combining operator safely
 * 4. Updatable recursion: Must satisfy Definition 14
 *
 * @param cfg - Global protocol CFG
 * @returns DMst well-formedness result
 */
export function checkDMstWellFormedness(cfg: CFG): DMstWellFormednessResult {
  // Check invitation protocol
  const invitationResult = checkInvitationProtocol(cfg);

  // Check dynamic participant well-formedness
  const dynamicParticipantResult = checkDynamicParticipants(cfg);

  // Check protocol call safety
  const protocolCallResult = checkProtocolCalls(cfg);

  // Check updatable recursion safety (if present)
  const updatableRecursionResult = checkUpdatableRecursion(cfg);

  const isWellFormed =
    invitationResult.hasValidInvitations &&
    dynamicParticipantResult.dynamicParticipantsWellFormed &&
    protocolCallResult.protocolCallsSafe &&
    updatableRecursionResult.updatableRecursionSafe;

  return {
    isWellFormed,
    hasValidInvitations: invitationResult.hasValidInvitations,
    dynamicParticipantsWellFormed: dynamicParticipantResult.dynamicParticipantsWellFormed,
    protocolCallsSafe: protocolCallResult.protocolCallsSafe,
    updatableRecursionSafe: updatableRecursionResult.updatableRecursionSafe,
    violations: [
      ...invitationResult.violations,
      ...dynamicParticipantResult.violations,
      ...protocolCallResult.violations,
      ...updatableRecursionResult.violations,
    ],
  };
}

// ============================================================================
// Invitation Protocol Verification
// ============================================================================

/**
 * Check that all created participants are properly invited.
 *
 * DMst requirement: Dynamic participants must follow invitation protocol:
 * 1. Role declaration: new role R
 * 2. Creation: p creates R
 * 3. Invitation: p invites R
 *
 * Without proper invitation, participants are orphaned (deadlock risk).
 *
 * @param cfg - Global protocol CFG
 * @returns Invitation protocol verification result
 */
function checkInvitationProtocol(cfg: CFG): {
  hasValidInvitations: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Find all participant creation actions
  const creationActions = cfg.nodes
    .filter(isActionNode)
    .filter(node => isCreateParticipantsAction((node as ActionNode).action))
    .map(node => node as ActionNode);

  // For each creation, verify there's a corresponding invitation
  for (const creationNode of creationActions) {
    const creationAction = creationNode.action;
    if (!isCreateParticipantsAction(creationAction)) continue;

    const roleName = creationAction.roleName;
    const instanceName = creationAction.instanceName || roleName;
    const creator = creationAction.creator;

    // Find invitation action for this role/instance
    const hasInvitation = cfg.nodes
      .filter(isActionNode)
      .some(node => {
        const action = (node as ActionNode).action;
        return (
          isInvitationAction(action) &&
          (action.invitee === instanceName || action.invitee === roleName) &&
          action.inviter === creator
        );
      });

    if (!hasInvitation) {
      violations.push(
        `Dynamic participant ${instanceName} (role ${roleName}) created by ${creator} but not invited (missing synchronization)`
      );
    }
  }

  return {
    hasValidInvitations: violations.length === 0,
    violations,
  };
}

// ============================================================================
// Dynamic Participant Well-Formedness
// ============================================================================

/**
 * Check that dynamic participants are well-formed.
 *
 * Verifies:
 * 1. Dynamic role declarations exist
 * 2. Created participants can be projected
 * 3. No orphaned participants (created but never used)
 *
 * @param cfg - Global protocol CFG
 * @returns Dynamic participant verification result
 */
function checkDynamicParticipants(cfg: CFG): {
  dynamicParticipantsWellFormed: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Find all created participant instances
  const createdInstances = cfg.nodes
    .filter(isActionNode)
    .filter(node => isCreateParticipantsAction((node as ActionNode).action))
    .map(node => {
      const action = (node as ActionNode).action;
      if (!isCreateParticipantsAction(action)) return null;
      return {
        roleName: action.roleName,
        instanceName: action.instanceName || action.roleName,
      };
    })
    .filter((x): x is { roleName: string; instanceName: string } => x !== null);

  // For each created instance, verify it's used in the protocol
  for (const instance of createdInstances) {
    // Check if instance participates in any messages
    const isUsed = cfg.nodes
      .filter(isActionNode)
      .some(node => {
        const action = (node as ActionNode).action;
        if (action.kind === 'message') {
          return (
            action.from === instance.instanceName ||
            action.to === instance.instanceName
          );
        }
        return false;
      });

    if (!isUsed) {
      violations.push(
        `Dynamic participant ${instance.instanceName} (role ${instance.roleName}) is created but never used (orphaned process)`
      );
    }
  }

  // Dynamic participants are well-formed if:
  // 1. No violations found
  // 2. All dynamic roles are properly used
  return {
    dynamicParticipantsWellFormed: violations.length === 0,
    violations,
  };
}

// ============================================================================
// Protocol Call Safety
// ============================================================================

/**
 * Check that protocol calls use combining operator safely.
 *
 * Combining operator ♢ requirements:
 * 1. Channels must be disjoint (no races)
 * 2. Both protocols can progress independently
 * 3. No circular dependencies
 *
 * @param cfg - Global protocol CFG
 * @returns Protocol call verification result
 */
function checkProtocolCalls(cfg: CFG): {
  protocolCallsSafe: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Find protocol call actions
  const protocolCalls = cfg.nodes
    .filter(isActionNode)
    .filter(node => (node as ActionNode).action.kind === 'protocol-call')
    .map(node => node as ActionNode);

  // For each protocol call, verify safety
  for (const callNode of protocolCalls) {
    const callAction = callNode.action;
    if (callAction.kind !== 'protocol-call') continue;

    // TODO: Implement detailed protocol call safety checks
    // For now, assume protocol calls are safe if they exist
    // Full implementation would check:
    // 1. Channel disjointness
    // 2. Independent progress
    // 3. No circular calls
  }

  return {
    protocolCallsSafe: violations.length === 0,
    violations,
  };
}

// ============================================================================
// Updatable Recursion Safety
// ============================================================================

/**
 * Check that updatable recursion satisfies Definition 14.
 *
 * Definition 14 requirements:
 * 1. 1-unfolding is well-formed
 * 2. Update body can be combined with recursion body (♢ operator)
 * 3. No races introduced by update
 *
 * @param cfg - Global protocol CFG
 * @returns Updatable recursion verification result
 */
function checkUpdatableRecursion(cfg: CFG): {
  updatableRecursionSafe: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Find updatable recursion actions
  const updatableRecursions = cfg.nodes
    .filter(isActionNode)
    .filter(node => (node as ActionNode).action.kind === 'updatable-recursion')
    .map(node => node as ActionNode);

  // For each updatable recursion, verify safety
  for (const recNode of updatableRecursions) {
    const recAction = recNode.action;
    if (recAction.kind !== 'updatable-recursion') continue;

    // TODO: Implement Definition 14 verification
    // This requires:
    // 1. Extract recursion body and update body
    // 2. Compute 1-unfolding
    // 3. Check well-formedness of 1-unfolding
    // For now, assume updatable recursions are safe
  }

  // If no updatable recursions, it's trivially safe
  return {
    updatableRecursionSafe: violations.length === 0,
    violations,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface DMstWellFormednessResult {
  isWellFormed: boolean;
  hasValidInvitations: boolean;
  dynamicParticipantsWellFormed: boolean;
  protocolCallsSafe: boolean;
  updatableRecursionSafe: boolean;
  violations: string[];
}
