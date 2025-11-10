/**
 * Control Flow Graph (CFG) Type Definitions
 * Based on docs/cfg-design.md
 *
 * The CFG is the central semantic artifact in the MPST framework.
 * All verification, projection, and execution are based on the CFG.
 */

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
  label: string;
  payloadType?: string;
}

export interface ParallelAction {
  kind: 'parallel';
  parallel_id: string;
  branchLabel: string;
}

export type Action = MessageAction | ParallelAction;

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
