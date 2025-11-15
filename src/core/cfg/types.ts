/**
 * Control Flow Graph (CFG) Type Definitions
 * Based on docs/cfg-design.md
 *
 * The CFG is the central semantic artifact in the MPST framework.
 * All verification, projection, and execution are based on the CFG.
 */

// Import Message type from AST for rich type preservation
import type { Message, SourceLocation } from '../ast/types';

// ============================================================================
// Node Types
// ============================================================================

export type NodeType =
  | 'initial'    // Entry point
  | 'terminal'   // Exit point
  | 'action'     // Message send/receive or other action
  | 'branch'     // Choice point (decision)
  | 'merge'      // Convergence after choice
  | 'fork'       // Parallel split
  | 'join'       // Parallel join (barrier)
  | 'recursive'; // Recursion label

// ============================================================================
// Edge Types
// ============================================================================

export type EdgeType =
  | 'sequence'  // Sequential flow
  | 'message'   // Message passing (deprecated - use action nodes instead)
  | 'branch'    // Branch in choice
  | 'fork'      // Branch in parallel
  | 'continue'  // Back edge for recursion
  | 'epsilon';  // Silent transition

// ============================================================================
// Actions
// ============================================================================

export interface MessageAction {
  kind: 'message';
  from: string;
  to: string | string[]; // string[] for multicast

  // ENRICHED: Full message with type information
  message: Message;

  // DEPRECATED: Use message.label instead
  /** @deprecated Use message.label */
  label?: string;

  // DEPRECATED: Use message.payload?.payloadType instead
  /** @deprecated Use message.payload?.payloadType */
  payloadType?: string;

  // NEW: Source location for error reporting
  location?: SourceLocation;
}

export interface ParallelAction {
  kind: 'parallel';
  parallel_id: string;
  branchLabel: string;
}

export interface SubProtocolAction {
  kind: 'subprotocol';
  protocol: string;
  roleArguments: string[];
}

// ============================================================================
// DMst Actions (Castro-Perez & Yoshida, ECOOP 2023)
// ============================================================================

/**
 * Dynamic Role Declaration Action
 * Declares a role type that can be instantiated dynamically.
 *
 * From ECOOP 2023: `new role Worker`
 */
export interface DynamicRoleDeclarationAction {
  kind: 'dynamic-role-declaration';
  roleName: string;
  location?: SourceLocation;
}

/**
 * Protocol Call Action
 * Calls a sub-protocol, creating a nested session.
 *
 * From ECOOP 2023 Definition 1: p ↪→ x⟨q⟩
 * Combining operator ♢ interleaves caller with callee protocol.
 */
export interface ProtocolCallAction {
  kind: 'protocol-call';
  caller: string;
  protocol: string;
  roleArguments: string[];
  location?: SourceLocation;
}

/**
 * Create Participants Action
 * Creates a new instance of a dynamic role at runtime.
 *
 * From ECOOP 2023: Manager creates Worker as w1
 */
export interface CreateParticipantsAction {
  kind: 'create-participants';
  creator: string;
  roleName: string;
  instanceName?: string;
  location?: SourceLocation;
}

/**
 * Invitation Action
 * Synchronization point for dynamic participant creation.
 *
 * From ECOOP 2023: Ensures created participants are ready before use.
 * Prevents orphaned messages and ensures proper initialization.
 */
export interface InvitationAction {
  kind: 'invitation';
  inviter: string;
  invitee: string;
  location?: SourceLocation;
}

/**
 * Updatable Recursion Action
 * Recursion point with dynamic behavior updates.
 *
 * From ECOOP 2023 Definition 13: continue X with { G_update }
 * Safety requirement: Definition 14 (Safe Protocol Update via 1-unfolding).
 */
export interface UpdatableRecursionAction {
  kind: 'updatable-recursion';
  label: string;
  // Note: Update body is handled by CFG builder creating separate subgraph
  location?: SourceLocation;
}

export type Action =
  | MessageAction
  | ParallelAction
  | SubProtocolAction
  | DynamicRoleDeclarationAction
  | ProtocolCallAction
  | CreateParticipantsAction
  | InvitationAction
  | UpdatableRecursionAction;

// ============================================================================
// Nodes
// ============================================================================

export interface BaseNode {
  id: string;
  type: NodeType;
}

export interface InitialNode extends BaseNode {
  type: 'initial';
}

export interface TerminalNode extends BaseNode {
  type: 'terminal';
}

export interface ActionNode extends BaseNode {
  type: 'action';
  action: Action;
}

export interface BranchNode extends BaseNode {
  type: 'branch';
  at: string; // Role making the choice
}

export interface MergeNode extends BaseNode {
  type: 'merge';
}

export interface ForkNode extends BaseNode {
  type: 'fork';
  parallel_id: string;
}

export interface JoinNode extends BaseNode {
  type: 'join';
  parallel_id: string;
}

export interface RecursiveNode extends BaseNode {
  type: 'recursive';
  label: string;
}

export type Node =
  | InitialNode
  | TerminalNode
  | ActionNode
  | BranchNode
  | MergeNode
  | ForkNode
  | JoinNode
  | RecursiveNode;

// ============================================================================
// Edges
// ============================================================================

export interface Edge {
  id: string;
  from: string; // Source node ID
  to: string;   // Target node ID
  edgeType: EdgeType;
  label?: string; // For branch edges (choice label)
}

// ============================================================================
// Control Flow Graph
// ============================================================================

export interface CFG {
  nodes: Node[];
  edges: Edge[];
  roles: string[]; // All roles participating in the protocol
  initialNode: string; // ID of the initial node

  // ENRICHED: Protocol metadata for code generation and serialization
  protocolName: string;
  parameters: import('../ast/types').ProtocolParameter[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isInitialNode(node: Node): node is InitialNode {
  return node.type === 'initial';
}

export function isTerminalNode(node: Node): node is TerminalNode {
  return node.type === 'terminal';
}

export function isActionNode(node: Node): node is ActionNode {
  return node.type === 'action';
}

export function isBranchNode(node: Node): node is BranchNode {
  return node.type === 'branch';
}

export function isMergeNode(node: Node): node is MergeNode {
  return node.type === 'merge';
}

export function isForkNode(node: Node): node is ForkNode {
  return node.type === 'fork';
}

export function isJoinNode(node: Node): node is JoinNode {
  return node.type === 'join';
}

export function isRecursiveNode(node: Node): node is RecursiveNode {
  return node.type === 'recursive';
}

export function isMessageAction(action: Action): action is MessageAction {
  return action.kind === 'message';
}

export function isParallelAction(action: Action): action is ParallelAction {
  return action.kind === 'parallel';
}

export function isSubProtocolAction(action: Action): action is SubProtocolAction {
  return action.kind === 'subprotocol';
}

// ============================================================================
// Type Guards for DMst Actions
// ============================================================================

export function isDynamicRoleDeclarationAction(action: Action): action is DynamicRoleDeclarationAction {
  return action.kind === 'dynamic-role-declaration';
}

export function isProtocolCallAction(action: Action): action is ProtocolCallAction {
  return action.kind === 'protocol-call';
}

export function isCreateParticipantsAction(action: Action): action is CreateParticipantsAction {
  return action.kind === 'create-participants';
}

export function isInvitationAction(action: Action): action is InvitationAction {
  return action.kind === 'invitation';
}

export function isUpdatableRecursionAction(action: Action): action is UpdatableRecursionAction {
  return action.kind === 'updatable-recursion';
}
