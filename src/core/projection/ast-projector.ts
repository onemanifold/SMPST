/**
 * AST-based Local Protocol Projection
 *
 * Implements formal Scribble projection from global protocols to local protocols
 * following the Multiparty Session Types (MPST) theory.
 *
 * Projection Rules (G ↓ r):
 * ========================
 *
 * 1. MESSAGE PASSING: (p→q:⟨U⟩.G) ↓ r
 *    - If r = p: !⟨q,U⟩.(G↓r)    (send to q)
 *    - If r = q: ?⟨p,U⟩.(G↓r)    (receive from p)
 *    - Otherwise: G↓r             (tau-elimination)
 *
 * 2. CHOICE: (choice at p { ... }) ↓ r
 *    - If r = p: internal choice (select)
 *    - Otherwise: external choice (offer)
 *    - Project each branch recursively
 *
 * 3. RECURSION: (rec X.G) ↓ r = rec X.(G↓r)
 *
 * 4. PARALLEL: (G1 || G2) ↓ r = (G1↓r) || (G2↓r)
 *
 * 5. CONTINUE: (continue X) ↓ r = continue X
 *
 * 6. DO: (do P(roles)) ↓ r - project sub-protocol invocation
 *
 * References:
 * - Honda, Yoshida, Carbone (2008): "Multiparty Asynchronous Session Types"
 * - Scribble Protocol Language Specification
 * - JBoss Scribble Protocol Guide
 */

import type {
  GlobalProtocolDeclaration,
  LocalProtocolDeclaration,
  GlobalInteraction,
  LocalInteraction,
  MessageTransfer,
  Choice,
  Parallel,
  Recursion,
  Continue,
  Do,
  Send,
  Receive,
  LocalChoice,
  LocalParallel,
  LocalChoiceBranch,
  LocalParallelBranch,
  ProtocolParameter,
} from '../ast/types';
import {
  isMessageTransfer,
  isChoice,
  isParallel,
  isRecursion,
  isContinue,
  isDo,
} from '../ast/types';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProjectionResult {
  localProtocols: Map<string, LocalProtocolDeclaration>;
  errors: ProjectionError[];
}

export interface ProjectionError {
  type: 'invalid-role' | 'projection-error' | 'well-formedness-error';
  role?: string;
  message: string;
  location?: any;
}

export interface ProjectionOptions {
  /**
   * Whether to include tau-eliminated actions as comments
   * (useful for debugging)
   */
  includeTauComments?: boolean;

  /**
   * Validate well-formedness before projection
   */
  validateWellFormedness?: boolean;
}

// ============================================================================
// Main Projection Functions
// ============================================================================

/**
 * Project a global protocol to local protocols for all roles
 *
 * @param global - Global protocol declaration
 * @param options - Projection options
 * @returns Map of role names to local protocol declarations
 */
export function projectToLocalProtocols(
  global: GlobalProtocolDeclaration,
  options: ProjectionOptions = {}
): ProjectionResult {
  const localProtocols = new Map<string, LocalProtocolDeclaration>();
  const errors: ProjectionError[] = [];

  // Extract role names from the global protocol
  const roles = global.roles.map(r => r.name);

  // Project for each role
  for (const role of roles) {
    try {
      const localProtocol = projectForRole(global, role, options);
      localProtocols.set(role, localProtocol);
    } catch (error) {
      errors.push({
        type: 'projection-error',
        role,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { localProtocols, errors };
}

/**
 * Project a global protocol to a local protocol for a specific role
 *
 * @param global - Global protocol declaration
 * @param role - Role to project for
 * @param options - Projection options
 * @returns Local protocol declaration for the role
 */
export function projectForRole(
  global: GlobalProtocolDeclaration,
  role: string,
  options: ProjectionOptions = {}
): LocalProtocolDeclaration {
  // Validate role exists
  const roleExists = global.roles.some(r => r.name === role);
  if (!roleExists) {
    throw new Error(
      `Role "${role}" not found in protocol. Available roles: ${global.roles.map(r => r.name).join(', ')}`
    );
  }

  // Project the body
  const localBody = projectBody(global.body, role, options);

  // Create local protocol declaration
  const localProtocol: LocalProtocolDeclaration = {
    type: 'LocalProtocolDeclaration',
    name: `${global.name}_${role}`,
    parameters: global.parameters,
    role,
    selfRole: role, // In local protocols, the "self" role
    body: localBody,
    location: global.location,
  };

  return localProtocol;
}

/**
 * Project a sequence of global interactions for a role
 *
 * @param body - Global protocol body (sequence of interactions)
 * @param role - Role to project for
 * @param options - Projection options
 * @returns Local protocol body (sequence of local interactions)
 */
function projectBody(
  body: GlobalInteraction[],
  role: string,
  options: ProjectionOptions
): LocalInteraction[] {
  const localInteractions: LocalInteraction[] = [];

  for (const interaction of body) {
    const projected = projectInteraction(interaction, role, options);

    // Handle self-communication case where projection returns array
    if (projected !== null) {
      if (Array.isArray(projected)) {
        localInteractions.push(...projected);
      } else {
        localInteractions.push(projected);
      }
    }
  }

  return localInteractions;
}

/**
 * Project a single global interaction for a role
 *
 * Implements the core projection rules:
 * - Message passing: sender/receiver/tau-elimination
 * - Choice: internal/external
 * - Recursion: preserve structure
 * - Parallel: project branches
 * - Continue: preserve
 * - Do: project sub-protocol
 *
 * @param interaction - Global interaction to project
 * @param role - Role to project for
 * @param options - Projection options
 * @returns Local interaction or null (tau-eliminated)
 */
function projectInteraction(
  interaction: GlobalInteraction,
  role: string,
  options: ProjectionOptions
): LocalInteraction | LocalInteraction[] | null {
  // RULE 1: MESSAGE PASSING
  if (isMessageTransfer(interaction)) {
    return projectMessageTransfer(interaction, role);
  }

  // RULE 2: CHOICE
  if (isChoice(interaction)) {
    return projectChoice(interaction, role, options);
  }

  // RULE 3: PARALLEL
  if (isParallel(interaction)) {
    return projectParallel(interaction, role, options);
  }

  // RULE 4: RECURSION
  if (isRecursion(interaction)) {
    return projectRecursion(interaction, role, options);
  }

  // RULE 5: CONTINUE
  if (isContinue(interaction)) {
    return projectContinue(interaction);
  }

  // RULE 6: DO (Sub-protocol)
  if (isDo(interaction)) {
    return projectDo(interaction, role);
  }

  // Unknown interaction type - should not happen with proper typing
  throw new Error(`Unknown interaction type: ${(interaction as any).type}`);
}

// ============================================================================
// Projection Rules Implementation
// ============================================================================

/**
 * RULE 1: Message Passing Projection
 *
 * (p→q:⟨U⟩.G) ↓ r =
 *   - !⟨q,U⟩.(G↓r) if r = p (sender)
 *   - ?⟨p,U⟩.(G↓r) if r = q (receiver)
 *   - G↓r           if r ≠ p, r ≠ q (tau-elimination)
 */
function projectMessageTransfer(
  msg: MessageTransfer,
  role: string
): Send | Receive | (Send | Receive)[] | null {
  const { from, to, message } = msg;

  const isSender = from === role;
  const isReceiver = to === role || (Array.isArray(to) && to.includes(role));

  // Case 1: Self-communication (role is both sender and receiver)
  // Must return BOTH Send and Receive for well-formedness checking
  if (isSender && isReceiver) {
    const send: Send = {
      type: 'Send',
      message,
      to,
      location: msg.location,
    };
    const receive: Receive = {
      type: 'Receive',
      message,
      from,
      location: msg.location,
    };
    return [send, receive];
  }

  // Case 2: Role is sender only - project to Send
  if (isSender) {
    const send: Send = {
      type: 'Send',
      message,
      to,  // Preserve multicast: string | string[]
      location: msg.location,
    };
    return send;
  }

  // Case 3: Role is receiver only - project to Receive
  if (isReceiver) {
    const receive: Receive = {
      type: 'Receive',
      message,
      from,
      location: msg.location,
    };
    return receive;
  }

  // Case 4: Role not involved - tau-elimination (return null)
  return null;
}

/**
 * RULE 2: Choice Projection
 *
 * (choice at p { l1: G1 [] l2: G2 ... }) ↓ r =
 *   - select { l1: G1↓r [] l2: G2↓r ... } if r = p (internal choice)
 *   - offer { l1: G1↓r [] l2: G2↓r ... }  if r ≠ p (external choice)
 *
 * Well-formedness: All branches must involve the role (or all must not)
 */
function projectChoice(
  choice: Choice,
  role: string,
  options: ProjectionOptions
): LocalChoice | null {
  const { at: choiceRole, branches } = choice;

  // Project all branches
  const localBranches: LocalChoiceBranch[] = [];
  let anyBranchInvolvesRole = false;

  for (const branch of branches) {
    const projectedBody = projectBody(branch.body, role, options);

    // Check if this branch involves the role
    if (projectedBody.length > 0) {
      anyBranchInvolvesRole = true;
    }

    localBranches.push({
      type: 'LocalChoiceBranch',
      label: branch.label,
      body: projectedBody,
      location: branch.location,
    });
  }

  // If no branch involves the role, tau-eliminate the entire choice
  if (!anyBranchInvolvesRole) {
    return null;
  }

  // Determine choice kind:
  // - 'select' if role makes the choice (internal)
  // - 'offer' if role receives the choice (external)
  const kind = choiceRole === role ? 'select' : 'offer';

  const localChoice: LocalChoice = {
    type: 'LocalChoice',
    kind,
    at: choiceRole !== role ? choiceRole : undefined,
    branches: localBranches,
    location: choice.location,
  };

  return localChoice;
}

/**
 * RULE 3: Parallel Projection
 *
 * (G1 || G2 || ...) ↓ r = (G1↓r) || (G2↓r) || ...
 *
 * Each branch is projected independently
 */
function projectParallel(
  parallel: Parallel,
  role: string,
  options: ProjectionOptions
): LocalParallel | null {
  const { branches } = parallel;

  const localBranches: LocalParallelBranch[] = [];
  let anyBranchInvolvesRole = false;

  for (const branch of branches) {
    const projectedBody = projectBody(branch.body, role, options);

    if (projectedBody.length > 0) {
      anyBranchInvolvesRole = true;
    }

    localBranches.push({
      type: 'LocalParallelBranch',
      body: projectedBody,
      location: branch.location,
    });
  }

  // If no branch involves the role, tau-eliminate
  if (!anyBranchInvolvesRole) {
    return null;
  }

  const localParallel: LocalParallel = {
    type: 'LocalParallel',
    branches: localBranches,
    location: parallel.location,
  };

  return localParallel;
}

/**
 * RULE 4: Recursion Projection
 *
 * (rec X.G) ↓ r = rec X.(G↓r)
 *
 * Preserve recursion structure, project body
 * Tau-eliminate if body contains only Continue (no actual actions)
 */
function projectRecursion(
  recursion: Recursion,
  role: string,
  options: ProjectionOptions
): Recursion | null {
  const { label, body } = recursion;

  // Project the recursion body
  const projectedBody = projectBody(
    body as GlobalInteraction[],
    role,
    options
  );

  // If body is empty after projection, tau-eliminate
  if (projectedBody.length === 0) {
    return null;
  }

  // If body contains ONLY Continue statements (no actual Send/Receive/Choice),
  // tau-eliminate the entire recursion
  const hasActualActions = projectedBody.some(interaction =>
    interaction.type === 'Send' ||
    interaction.type === 'Receive' ||
    interaction.type === 'LocalChoice' ||
    interaction.type === 'LocalParallel' ||
    interaction.type === 'Recursion'
  );

  if (!hasActualActions) {
    return null;
  }

  const localRecursion: Recursion = {
    type: 'Recursion',
    label,
    body: projectedBody,
    location: recursion.location,
  };

  return localRecursion;
}

/**
 * RULE 5: Continue Projection
 *
 * (continue X) ↓ r = continue X
 *
 * Continue labels are preserved as-is
 */
function projectContinue(cont: Continue): Continue {
  return {
    type: 'Continue',
    label: cont.label,
    location: cont.location,
  };
}

/**
 * RULE 6: Do (Sub-protocol) Projection
 *
 * (do P(roles)) ↓ r - preserve if role is involved
 *
 * For now, preserve the Do statement if role is in roleArguments
 * A full implementation would recursively project the sub-protocol
 */
function projectDo(doStmt: Do, role: string): Do | null {
  const { roleArguments } = doStmt;

  // If role is not involved in sub-protocol, tau-eliminate
  if (!roleArguments.includes(role)) {
    return null;
  }

  // Preserve the Do statement
  return {
    type: 'Do',
    protocol: doStmt.protocol,
    typeArguments: doStmt.typeArguments,
    roleArguments: doStmt.roleArguments,
    location: doStmt.location,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a role is involved in a global interaction
 *
 * @param interaction - Global interaction
 * @param role - Role to check
 * @returns true if role participates in the interaction
 */
export function isRoleInvolved(
  interaction: GlobalInteraction,
  role: string
): boolean {
  if (isMessageTransfer(interaction)) {
    const { from, to } = interaction;
    return from === role || to === role || (Array.isArray(to) && to.includes(role));
  }

  if (isChoice(interaction) || isParallel(interaction) || isRecursion(interaction)) {
    // For structured interactions, check if any nested interaction involves the role
    // This is a simplified check; full implementation would recurse
    return true; // Conservative: assume involvement
  }

  if (isDo(interaction)) {
    return interaction.roleArguments.includes(role);
  }

  // Continue is always preserved
  return true;
}

/**
 * Get all roles from a global protocol
 */
export function getRoles(protocol: GlobalProtocolDeclaration): string[] {
  return protocol.roles.map(r => r.name);
}

/**
 * Validate well-formedness of a global protocol
 *
 * Basic checks:
 * - All roles are defined
 * - No orphan messages
 * - Choice branches are consistent
 *
 * @param protocol - Global protocol to validate
 * @returns Array of validation errors
 */
export function validateWellFormedness(
  protocol: GlobalProtocolDeclaration
): ProjectionError[] {
  const errors: ProjectionError[] = [];
  const roleNames = new Set(protocol.roles.map(r => r.name));

  // TODO: Implement full well-formedness checks
  // - Check all message senders/receivers are defined roles
  // - Check recursion labels are properly scoped
  // - Check choice branches are deterministic
  // - Check no communication races

  return errors;
}
