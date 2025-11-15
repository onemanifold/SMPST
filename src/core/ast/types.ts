/**
 * AST Type Definitions for Scribble 2.0
 * Based on docs/ast-design.md
 */

// ============================================================================
// Source Location
// ============================================================================

export interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

// ============================================================================
// Module and Protocol Declarations
// ============================================================================

export interface Module {
  type: 'Module';
  declarations: ModuleDeclaration[];
  location?: SourceLocation;
}

export type ModuleDeclaration =
  | ImportDeclaration
  | TypeDeclaration
  | GlobalProtocolDeclaration
  | LocalProtocolDeclaration
  | ProtocolExtension;  // Subtyping (future feature)

export interface ImportDeclaration {
  type: 'ImportDeclaration';
  modulePath: string;
  importedNames?: string[]; // undefined means import all
  location?: SourceLocation;
}

export interface TypeDeclaration {
  type: 'TypeDeclaration';
  name: string;
  typeValue: Type;
  location?: SourceLocation;
}

// ============================================================================
// Global Protocol
// ============================================================================

export interface GlobalProtocolDeclaration {
  type: 'GlobalProtocolDeclaration';
  name: string;
  parameters: ProtocolParameter[];
  roles: RoleDeclaration[];
  body: GlobalProtocolBody;
  location?: SourceLocation;
}

export interface ProtocolParameter {
  type: 'ProtocolParameter';
  name: string;
  kind: 'type' | 'sig';
  location?: SourceLocation;
}

export interface RoleDeclaration {
  type: 'RoleDeclaration';
  name: string;
  isDynamic?: boolean; // DMst: true if declared with 'new role'
  location?: SourceLocation;
}

export type GlobalProtocolBody = GlobalInteraction[];

export type GlobalInteraction =
  | MessageTransfer
  | Choice
  | Parallel
  | Recursion
  | Continue
  | Do
  | Try          // Exception handling
  | Throw        // Exception handling
  | TimedMessage // Timed types
  | Timeout      // Timed types
  | DynamicRoleDeclaration  // DMst
  | ProtocolCall            // DMst
  | CreateParticipants      // DMst
  | Invitation              // DMst
  | UpdatableRecursion;     // DMst

// ============================================================================
// Local Protocol
// ============================================================================

export interface LocalProtocolDeclaration {
  type: 'LocalProtocolDeclaration';
  name: string;
  parameters: ProtocolParameter[];
  role: string; // The role this protocol is for
  selfRole: string; // "self" role name
  body: LocalProtocolBody;
  location?: SourceLocation;
}

export type LocalProtocolBody = LocalInteraction[];

export type LocalInteraction =
  | Send
  | Receive
  | LocalChoice
  | LocalParallel
  | Recursion
  | Continue
  | Do
  | Try      // Exception handling
  | Throw    // Exception handling
  | Timeout; // Timed types

// ============================================================================
// Message Transfer (Global)
// ============================================================================

export interface MessageTransfer {
  type: 'MessageTransfer';
  message: Message;
  from: string;
  to: string | string[]; // string[] for multicast
  location?: SourceLocation;
}

export interface Message {
  type: 'Message';
  label: string;
  payload?: Payload;
  location?: SourceLocation;
}

export interface Payload {
  type: 'Payload';
  payloadType: Type;
  location?: SourceLocation;
}

// ============================================================================
// Send/Receive (Local)
// ============================================================================

export interface Send {
  type: 'Send';
  message: Message;
  to: string | string[];  // string[] for multicast
  location?: SourceLocation;
}

export interface Receive {
  type: 'Receive';
  message: Message;
  from: string;
  location?: SourceLocation;
}

// ============================================================================
// Choice (Global)
// ============================================================================

export interface Choice {
  type: 'Choice';
  at: string; // Role making the choice
  branches: ChoiceBranch[];
  location?: SourceLocation;
}

export interface ChoiceBranch {
  type: 'ChoiceBranch';
  label: string;
  body: GlobalProtocolBody;
  location?: SourceLocation;
}

// ============================================================================
// Choice (Local)
// ============================================================================

export interface LocalChoice {
  type: 'LocalChoice';
  kind: 'offer' | 'select'; // offer = receiving choice, select = making choice
  at?: string; // For offer, who we're receiving from
  branches: LocalChoiceBranch[];
  location?: SourceLocation;
}

export interface LocalChoiceBranch {
  type: 'LocalChoiceBranch';
  label: string;
  body: LocalProtocolBody;
  location?: SourceLocation;
}

// ============================================================================
// Parallel Composition (Global)
// ============================================================================

export interface Parallel {
  type: 'Parallel';
  branches: ParallelBranch[];
  location?: SourceLocation;
}

export interface ParallelBranch {
  type: 'ParallelBranch';
  body: GlobalProtocolBody;
  location?: SourceLocation;
}

// ============================================================================
// Parallel Composition (Local)
// ============================================================================

export interface LocalParallel {
  type: 'LocalParallel';
  branches: LocalParallelBranch[];
  location?: SourceLocation;
}

export interface LocalParallelBranch {
  type: 'LocalParallelBranch';
  body: LocalProtocolBody;
  location?: SourceLocation;
}

// ============================================================================
// Recursion
// ============================================================================

export interface Recursion {
  type: 'Recursion';
  label: string;
  body: GlobalProtocolBody | LocalProtocolBody;
  location?: SourceLocation;
}

export interface Continue {
  type: 'Continue';
  label: string;
  location?: SourceLocation;
}

// ============================================================================
// Do (Sub-protocol invocation)
// ============================================================================

export interface Do {
  type: 'Do';
  protocol: string;
  typeArguments?: Type[];
  roleArguments: string[];
  location?: SourceLocation;
}

// ============================================================================
// DMst - Dynamically Updatable MPST (Castro-Perez & Yoshida, ECOOP 2023)
// ============================================================================

/**
 * Dynamic Role Declaration: new role Worker
 *
 * Declares a role that will be created dynamically at runtime.
 * Unlike static roles (declared in protocol parameters), dynamic roles
 * are instantiated during execution via CreateParticipants.
 *
 * From ECOOP 2023: Roles marked with `new` can be created multiple times,
 * each instance getting a unique identity.
 *
 * Example:
 *   protocol Pipeline(role Manager) {
 *     new role Worker;  // Dynamic role declaration
 *     Manager creates Worker;  // Creates instance
 *   }
 */
export interface DynamicRoleDeclaration {
  type: 'DynamicRoleDeclaration';
  roleName: string; // Role type name (e.g., "Worker")
  location?: SourceLocation;
}

/**
 * Protocol Call: Coordinator calls SubTask(Worker)
 *
 * Calls a sub-protocol, creating a nested session.
 * From ECOOP 2023 Definition 1: p ↪→ x⟨q⟩
 *
 * The combining operator ♢ interleaves the caller protocol with
 * the called sub-protocol.
 *
 * Example:
 *   A calls SubProtocol(B, C);
 */
export interface ProtocolCall {
  type: 'ProtocolCall';
  caller: string; // Role making the call
  protocol: string; // Sub-protocol name
  typeArguments?: Type[];
  roleArguments: string[]; // Roles passed to sub-protocol
  location?: SourceLocation;
}

/**
 * Create Participants: Manager creates Worker as w1
 *
 * Creates a new instance of a dynamic role at runtime.
 * The dynamic role must be declared with `new role` earlier.
 *
 * Example:
 *   Manager creates Worker;
 *   Manager creates Worker as w1;
 */
export interface CreateParticipants {
  type: 'CreateParticipants';
  creator: string; // Role creating the participant
  roleName: string; // Dynamic role type to instantiate
  instanceName?: string; // Optional instance name (e.g., "w1")
  location?: SourceLocation;
}

/**
 * Invitation: Manager invites Worker
 *
 * Synchronization point for dynamic participant creation.
 * Ensures the created participant is ready before messages are sent.
 *
 * From ECOOP 2023: Invitation protocol prevents orphaned messages
 * and ensures proper initialization.
 *
 * Example:
 *   Manager invites Worker;
 */
export interface Invitation {
  type: 'Invitation';
  inviter: string; // Role sending invitation
  invitee: string; // Dynamic participant being invited
  location?: SourceLocation;
}

/**
 * Updatable Recursion: continue Loop with { G_update }
 *
 * From ECOOP 2023 Definition 13:
 * Allows recursive protocols to grow dynamically by adding new behavior
 * in each iteration.
 *
 * Safety requirement (Definition 14): Must have safe 1-unfolding.
 * The 1-unfolding G[X ↦ G ♢ G_update] must be well-formed.
 *
 * Example:
 *   rec Loop {
 *     A -> B: Work();
 *     choice at A {
 *       continue Loop with {
 *         A -> C: Extra();  // Added in each iteration
 *       };
 *     } or {
 *       A -> B: Done();
 *     }
 *   }
 */
export interface UpdatableRecursion {
  type: 'UpdatableRecursion';
  label: string; // Recursion variable (e.g., "Loop")
  updateBody: GlobalProtocolBody | LocalProtocolBody; // New behavior to add
  location?: SourceLocation;
}

// ============================================================================
// Type System
// ============================================================================

export type Type =
  | SimpleType
  | ParametricType;

export interface SimpleType {
  type: 'SimpleType';
  name: string; // e.g., "Int", "String", "Bool"
  location?: SourceLocation;
}

export interface ParametricType {
  type: 'ParametricType';
  name: string; // e.g., "List", "Option"
  arguments: Type[];
  location?: SourceLocation;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isGlobalInteraction(node: any): node is GlobalInteraction {
  return node && (
    node.type === 'MessageTransfer' ||
    node.type === 'Choice' ||
    node.type === 'Parallel' ||
    node.type === 'Recursion' ||
    node.type === 'Continue' ||
    node.type === 'Do' ||
    node.type === 'Try' ||
    node.type === 'Throw' ||
    node.type === 'TimedMessage' ||
    node.type === 'Timeout' ||
    node.type === 'DynamicRoleDeclaration' ||
    node.type === 'ProtocolCall' ||
    node.type === 'CreateParticipants' ||
    node.type === 'Invitation' ||
    node.type === 'UpdatableRecursion'
  );
}

export function isLocalInteraction(node: any): node is LocalInteraction {
  return node && (
    node.type === 'Send' ||
    node.type === 'Receive' ||
    node.type === 'LocalChoice' ||
    node.type === 'LocalParallel' ||
    node.type === 'Recursion' ||
    node.type === 'Continue' ||
    node.type === 'Do' ||
    node.type === 'Try' ||
    node.type === 'Throw' ||
    node.type === 'Timeout'
  );
}

export function isMessageTransfer(node: any): node is MessageTransfer {
  return node?.type === 'MessageTransfer';
}

export function isChoice(node: any): node is Choice {
  return node?.type === 'Choice';
}

export function isParallel(node: any): node is Parallel {
  return node?.type === 'Parallel';
}

export function isRecursion(node: any): node is Recursion {
  return node?.type === 'Recursion';
}

export function isContinue(node: any): node is Continue {
  return node?.type === 'Continue';
}

export function isDo(node: any): node is Do {
  return node?.type === 'Do';
}

// ============================================================================
// Exception Handling (Future Feature)
// Based on docs/theory/exception-handling.md
// ============================================================================

/**
 * Try-Catch block for exception handling
 *
 * Example:
 *   try {
 *     Client -> Server: Request();
 *     Server -> Client: Response();
 *   } catch Error {
 *     Server -> Client: ErrorMsg();
 *   }
 */
export interface Try {
  type: 'Try';
  body: GlobalProtocolBody | LocalProtocolBody;
  catchHandlers: CatchHandler[];
  location?: SourceLocation;
}

export interface CatchHandler {
  type: 'CatchHandler';
  exceptionLabel: string;  // Exception label to catch
  body: GlobalProtocolBody | LocalProtocolBody;
  location?: SourceLocation;
}

/**
 * Throw exception
 *
 * Example:
 *   throw Error;
 */
export interface Throw {
  type: 'Throw';
  exceptionLabel: string;
  from?: string;  // Optional: role throwing (for global protocols)
  location?: SourceLocation;
}

// ============================================================================
// Timed Session Types (Future Feature)
// Based on docs/theory/timed-session-types.md
// ============================================================================

/**
 * Timed message with deadline constraint
 *
 * Example:
 *   Client -> Server: Request() within 5s;
 */
export interface TimedMessage {
  type: 'TimedMessage';
  message: Message;
  from: string;
  to: string | string[];
  deadline: TimeConstraint;
  location?: SourceLocation;
}

/**
 * Time constraint specification
 */
export interface TimeConstraint {
  type: 'TimeConstraint';
  value: number;      // Deadline value
  unit: 'ms' | 's' | 'min';  // Time unit
  location?: SourceLocation;
}

/**
 * Timeout handler
 *
 * Example:
 *   timeout(5s) {
 *     // Handler if message not received within 5s
 *   }
 */
export interface Timeout {
  type: 'Timeout';
  constraint: TimeConstraint;
  body: GlobalProtocolBody | LocalProtocolBody;
  location?: SourceLocation;
}

// ============================================================================
// Asynchronous Subtyping (Future Feature)
// Based on docs/theory/asynchronous-subtyping.md
// ============================================================================

/**
 * Protocol extension for subtyping
 *
 * Example:
 *   protocol Enhanced(role A, role B) extends Basic(A, B) {
 *     // Additional or refined behavior
 *   }
 */
export interface ProtocolExtension {
  type: 'ProtocolExtension';
  name: string;
  extends: string;  // Base protocol name
  typeArguments?: Type[];
  roleArguments: string[];
  refinements: GlobalProtocolBody;
  location?: SourceLocation;
}

// ============================================================================
// Type Guards for New Features
// ============================================================================

export function isTry(node: any): node is Try {
  return node?.type === 'Try';
}

export function isThrow(node: any): node is Throw {
  return node?.type === 'Throw';
}

export function isTimedMessage(node: any): node is TimedMessage {
  return node?.type === 'TimedMessage';
}

export function isTimeout(node: any): node is Timeout {
  return node?.type === 'Timeout';
}

export function isProtocolExtension(node: any): node is ProtocolExtension {
  return node?.type === 'ProtocolExtension';
}

// ============================================================================
// Type Guards for DMst
// ============================================================================

export function isDynamicRoleDeclaration(node: any): node is DynamicRoleDeclaration {
  return node?.type === 'DynamicRoleDeclaration';
}

export function isProtocolCall(node: any): node is ProtocolCall {
  return node?.type === 'ProtocolCall';
}

export function isCreateParticipants(node: any): node is CreateParticipants {
  return node?.type === 'CreateParticipants';
}

export function isInvitation(node: any): node is Invitation {
  return node?.type === 'Invitation';
}

export function isUpdatableRecursion(node: any): node is UpdatableRecursion {
  return node?.type === 'UpdatableRecursion';
}
