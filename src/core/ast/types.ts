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
  | Timeout;     // Timed types

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
  to: string;
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
    node.type === 'Timeout'
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
