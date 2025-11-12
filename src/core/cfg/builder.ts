/**
 * CFG Builder - Transform AST to Control Flow Graph
 * Implements transformation rules from docs/cfg-design.md
 */

import type {
  GlobalProtocolDeclaration,
  GlobalInteraction,
  GlobalProtocolBody,
  MessageTransfer,
  Choice,
  Parallel,
  Recursion,
  Continue,
  Do,
} from '../ast/types';
import type {
  CFG,
  Node,
  Edge,
  InitialNode,
  TerminalNode,
  ActionNode,
  BranchNode,
  MergeNode,
  ForkNode,
  JoinNode,
  RecursiveNode,
  MessageAction,
  SubProtocolAction,
} from './types';

// ============================================================================
// ID Generation
// ============================================================================

let nodeIdCounter = 0;
let edgeIdCounter = 0;
let parallelIdCounter = 0;

function resetCounters() {
  nodeIdCounter = 0;
  edgeIdCounter = 0;
  parallelIdCounter = 0;
}

function generateNodeId(): string {
  return `n${nodeIdCounter++}`;
}

function generateEdgeId(): string {
  return `e${edgeIdCounter++}`;
}

function generateParallelId(): string {
  return `par${parallelIdCounter++}`;
}

// ============================================================================
// CFG Builder Context
// ============================================================================

interface BuilderContext {
  nodes: Node[];
  edges: Edge[];
  roles: string[];
  recursionLabels: Map<string, string>; // label name -> recursive node id
}

function createContext(roles: string[]): BuilderContext {
  return {
    nodes: [],
    edges: [],
    roles,
    recursionLabels: new Map(),
  };
}

function addNode(ctx: BuilderContext, node: Node): Node {
  ctx.nodes.push(node);
  return node;
}

function addEdge(
  ctx: BuilderContext,
  from: string,
  to: string,
  edgeType: Edge['edgeType'],
  label?: string
): Edge {
  const edge: Edge = {
    id: generateEdgeId(),
    from,
    to,
    edgeType,
    label,
  };
  ctx.edges.push(edge);
  return edge;
}

// ============================================================================
// Node Creation Helpers
// ============================================================================

function createInitialNode(): InitialNode {
  return {
    id: generateNodeId(),
    type: 'initial',
  };
}

function createTerminalNode(): TerminalNode {
  return {
    id: generateNodeId(),
    type: 'terminal',
  };
}

function createActionNode(action: MessageAction): ActionNode {
  return {
    id: generateNodeId(),
    type: 'action',
    action,
  };
}

function createBranchNode(at: string): BranchNode {
  return {
    id: generateNodeId(),
    type: 'branch',
    at,
  };
}

function createMergeNode(): MergeNode {
  return {
    id: generateNodeId(),
    type: 'merge',
  };
}

function createForkNode(parallelId: string): ForkNode {
  return {
    id: generateNodeId(),
    type: 'fork',
    parallel_id: parallelId,
  };
}

function createJoinNode(parallelId: string): JoinNode {
  return {
    id: generateNodeId(),
    type: 'join',
    parallel_id: parallelId,
  };
}

function createRecursiveNode(label: string): RecursiveNode {
  return {
    id: generateNodeId(),
    type: 'recursive',
    label,
  };
}

// ============================================================================
// Main Build Function
// ============================================================================

/**
 * Build CFG from Global Protocol Declaration
 */
export function buildCFG(protocol: GlobalProtocolDeclaration): CFG {
  resetCounters();

  const roles = protocol.roles.map(r => r.name);
  const ctx = createContext(roles);

  // Create initial and terminal nodes
  const initial = addNode(ctx, createInitialNode());
  const terminal = addNode(ctx, createTerminalNode());

  // Build protocol body
  const bodyEntry = buildProtocolBody(ctx, protocol.body, terminal.id);

  // Connect initial to body entry
  addEdge(ctx, initial.id, bodyEntry, 'sequence');

  // Post-process: mark back edges to recursive nodes as 'continue' type
  fixBackEdgeTypes(ctx);

  // Sort nodes in topological order for easier debugging and testing
  // (Initial node first, terminal node last, others in execution order)
  const sortedNodes = sortNodesTopologically(ctx);

  return {
    nodes: sortedNodes,
    edges: ctx.edges,
    roles: ctx.roles,
  };
}

/**
 * Sort nodes in topological order (respecting execution flow)
 */
function sortNodesTopologically(ctx: BuilderContext): Node[] {
  const sorted: Node[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  // Find initial node
  const initial = ctx.nodes.find(n => n.type === 'initial');
  if (!initial) return ctx.nodes; // Shouldn't happen

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (temp.has(nodeId)) {
      // Cycle detected (expected for recursion)
      return;
    }

    temp.add(nodeId);

    const node = ctx.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Visit successors (except continue edges to avoid infinite loops)
    const outgoing = ctx.edges.filter(
      e => e.from === nodeId && e.edgeType !== 'continue'
    );
    for (const edge of outgoing) {
      visit(edge.to);
    }

    temp.delete(nodeId);
    visited.add(nodeId);
    sorted.unshift(node); // Add to front for topological order
  }

  // Start from initial
  visit(initial.id);

  // Add any remaining nodes (e.g., unreachable nodes, shouldn't happen in valid CFG)
  for (const node of ctx.nodes) {
    if (!visited.has(node.id)) {
      sorted.push(node);
    }
  }

  return sorted;
}

/**
 * Post-process edges to mark back edges to recursive nodes as 'continue'
 */
function fixBackEdgeTypes(ctx: BuilderContext): void {
  // Find all recursive nodes
  const recursiveNodes = ctx.nodes.filter(n => n.type === 'recursive') as RecursiveNode[];

  // For each recursive node, find edges that loop back to it
  for (const recNode of recursiveNodes) {
    // Find the body entry of this recursion (first node reached from rec node)
    const bodyEntryEdges = ctx.edges.filter(
      e => e.from === recNode.id && e.edgeType === 'sequence'
    );

    if (bodyEntryEdges.length === 0) continue;

    // The first edge from rec node is to the body entry (rec nodes have 2 sequence edges:
    // one to body, one to exit. The body edge is added first during construction)
    const bodyEntry = bodyEntryEdges[0].to;

    // Find all nodes reachable from body entry, respecting nested recursion boundaries
    const bodyNodes = findReachableNodesInScope(
      ctx,
      bodyEntry,
      recNode.id,  // Stop at edges back to this recursion
      recursiveNodes  // Don't traverse into nested recursion bodies
    );

    // Mark edges from body nodes back to THIS SPECIFIC rec node as 'continue'
    // Note: These edges can be either 'sequence' (direct continue) or 'branch' (continue inside choice)
    for (const edge of ctx.edges) {
      if (edge.to === recNode.id &&
          (edge.edgeType === 'sequence' || edge.edgeType === 'branch') &&
          bodyNodes.has(edge.from)) {
        edge.edgeType = 'continue';
      }
    }
  }
}

/**
 * Find reachable nodes within a recursion scope, respecting nested recursion boundaries
 *
 * Key insight: When finding body nodes for a recursion, we should:
 * 1. Stop at edges back to the target recursion (back-edges)
 * 2. NOT traverse into nested recursion bodies (they have their own scope)
 * 3. Include the nested recursion nodes themselves (they're part of outer scope)
 *
 * @param ctx - Builder context
 * @param startId - Where to start traversal (body entry)
 * @param targetRecId - The recursion node we're analyzing (stop at edges to this)
 * @param allRecNodes - All recursion nodes (to detect nested recursions)
 */
function findReachableNodesInScope(
  ctx: BuilderContext,
  startId: string,
  targetRecId: string,
  allRecNodes: RecursiveNode[]
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [startId];
  const recNodeIds = new Set(allRecNodes.map(n => n.id));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    // Get outgoing edges
    for (const edge of ctx.edges.filter(e => e.from === current)) {
      // Skip edges back to target recursion (these are the back-edges we're trying to find)
      if (edge.to === targetRecId) continue;

      // Skip edges into nested recursion bodies
      // A recursion node has 2 sequence edges: (1) to body entry, (2) to exit
      // We want to include the rec node itself but not traverse into its body
      if (recNodeIds.has(current) && current !== targetRecId) {
        // Current node is a nested recursion node
        // Only follow the EXIT edge (the second sequence edge), not the body entry edge
        const sequenceEdges = ctx.edges.filter(
          e => e.from === current && e.edgeType === 'sequence'
        );
        // First edge is to body (skip), second edge is to exit (follow)
        if (sequenceEdges.length >= 2 && edge.id === sequenceEdges[1].id) {
          if (!reachable.has(edge.to)) {
            queue.push(edge.to);
          }
        }
        // Skip the body entry edge
        continue;
      }

      // Regular traversal for non-recursion nodes
      if (!reachable.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return reachable;
}

/**
 * Check if 'target' is reachable from 'source' (excluding the direct edge)
 */
function isReachableFrom(
  ctx: BuilderContext,
  target: string,
  source: string
): boolean {
  const visited = new Set<string>();
  const queue: string[] = [source];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Found target
    if (current === target) return true;

    // Explore outgoing edges (but not the edge we're checking)
    const outgoing = ctx.edges.filter(
      e => e.from === current && !(e.from === target && e.to === source)
    );
    for (const edge of outgoing) {
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  return false;
}

/**
 * Build protocol body (sequence of interactions)
 * Returns the ID of the entry node
 */
function buildProtocolBody(
  ctx: BuilderContext,
  body: GlobalProtocolBody,
  exitNodeId: string
): string {
  if (body.length === 0) {
    // Empty body - return exit node
    return exitNodeId;
  }

  // Build interactions from right to left (reverse order)
  // This ensures proper sequencing
  let currentExit = exitNodeId;

  for (let i = body.length - 1; i >= 0; i--) {
    const interaction = body[i];
    const entry = buildInteraction(ctx, interaction, currentExit);
    currentExit = entry;
  }

  return currentExit;
}

/**
 * Build a single interaction
 * Returns the ID of the entry node
 */
function buildInteraction(
  ctx: BuilderContext,
  interaction: GlobalInteraction,
  exitNodeId: string
): string {
  switch (interaction.type) {
    case 'MessageTransfer':
      return buildMessageTransfer(ctx, interaction, exitNodeId);

    case 'Choice':
      return buildChoice(ctx, interaction, exitNodeId);

    case 'Parallel':
      return buildParallel(ctx, interaction, exitNodeId);

    case 'Recursion':
      return buildRecursion(ctx, interaction, exitNodeId);

    case 'Continue':
      return buildContinue(ctx, interaction, exitNodeId);

    case 'Do':
      return buildDo(ctx, interaction, exitNodeId);

    default:
      throw new Error(`Unknown interaction type: ${(interaction as any).type}`);
  }
}

// ============================================================================
// Transformation Rules
// ============================================================================

/**
 * Rule 2: Message Transfer
 * Creates an action node
 */
function buildMessageTransfer(
  ctx: BuilderContext,
  msg: MessageTransfer,
  exitNodeId: string
): string {
  const action: MessageAction = {
    kind: 'message',
    from: msg.from,
    to: msg.to,
    label: msg.message.label,
    payloadType: msg.message.payload?.payloadType.type === 'SimpleType'
      ? (msg.message.payload.payloadType as any).name
      : msg.message.payload?.payloadType.type === 'ParametricType'
      ? (msg.message.payload.payloadType as any).name
      : undefined,
  };

  const actionNode = addNode(ctx, createActionNode(action));
  addEdge(ctx, actionNode.id, exitNodeId, 'sequence');

  return actionNode.id;
}

/**
 * Rule 4: Choice
 * Creates branch and merge nodes
 */
function buildChoice(
  ctx: BuilderContext,
  choice: Choice,
  exitNodeId: string
): string {
  // Create merge node (where branches converge)
  const mergeNode = addNode(ctx, createMergeNode());
  addEdge(ctx, mergeNode.id, exitNodeId, 'sequence');

  // Create branch node
  const branchNode = addNode(ctx, createBranchNode(choice.at));

  // Build each branch
  for (let i = 0; i < choice.branches.length; i++) {
    const branch = choice.branches[i];
    const branchEntry = buildProtocolBody(ctx, branch.body, mergeNode.id);

    // Connect branch node to this branch's entry
    addEdge(
      ctx,
      branchNode.id,
      branchEntry,
      'branch',
      branch.label || `branch${i + 1}`
    );
  }

  return branchNode.id;
}

/**
 * Rule 7: Parallel Composition
 * Creates fork and join nodes
 */
function buildParallel(
  ctx: BuilderContext,
  parallel: Parallel,
  exitNodeId: string
): string {
  const parallelId = generateParallelId();

  // Create join node (where branches synchronize)
  const joinNode = addNode(ctx, createJoinNode(parallelId));
  addEdge(ctx, joinNode.id, exitNodeId, 'sequence');

  // Create fork node
  const forkNode = addNode(ctx, createForkNode(parallelId));

  // Build each parallel branch
  for (let i = 0; i < parallel.branches.length; i++) {
    const branch = parallel.branches[i];
    const branchEntry = buildProtocolBody(ctx, branch.body, joinNode.id);

    // Connect fork node to this branch's entry
    addEdge(ctx, forkNode.id, branchEntry, 'fork', `branch${i + 1}`);
  }

  return forkNode.id;
}

/**
 * Rule 6: Recursion
 * Creates recursive node with back edge for continue
 */
function buildRecursion(
  ctx: BuilderContext,
  recursion: Recursion,
  exitNodeId: string
): string {
  // Create recursive node
  const recNode = addNode(ctx, createRecursiveNode(recursion.label));

  // Register this recursion label
  ctx.recursionLabels.set(recursion.label, recNode.id);

  // Check if body ends with a continue statement (infinite loop)
  const body = recursion.body as GlobalProtocolBody;
  const lastStatement = body[body.length - 1];
  const endsWithContinue = lastStatement?.type === 'Continue' &&
    (lastStatement as Continue).label === recursion.label;

  // Build recursion body
  // Paths with explicit 'continue' will loop back to recNode (via buildContinue)
  // Paths without 'continue' will exit to exitNodeId (exit the rec block)
  const bodyEntry = buildProtocolBody(
    ctx,
    body,
    exitNodeId  // Paths without continue exit the rec block
  );

  // Connect recursive node to body entry
  addEdge(ctx, recNode.id, bodyEntry, 'sequence');

  // Always add exit edge to allow nested recursions to work correctly
  // Even if this specific recursion loops infinitely, outer code may continue
  if (exitNodeId !== recNode.id) {  // Don't create self-loop
    addEdge(ctx, recNode.id, exitNodeId, 'sequence');
  }

  return recNode.id;
}

/**
 * Continue statement
 * Simply returns the recursive node as the exit point
 * This creates a back edge naturally when the previous statement connects to it
 */
function buildContinue(
  ctx: BuilderContext,
  cont: Continue,
  exitNodeId: string
): string {
  // Find the recursive node for this label
  const recNodeId = ctx.recursionLabels.get(cont.label);

  if (!recNodeId) {
    throw new Error(`Continue references undefined recursion label: ${cont.label}`);
  }

  // Simply return the recursive node ID
  // The previous statement in the sequence will connect to it,
  // creating the back edge naturally
  // (We ignore exitNodeId because continue doesn't continue to what's after)
  return recNodeId;
}

/**
 * Do statement (sub-protocol invocation)
 * Creates a sub-protocol action node with protocol name and role arguments
 */
function buildDo(
  ctx: BuilderContext,
  doStmt: Do,
  exitNodeId: string
): string {
  const action: SubProtocolAction = {
    kind: 'subprotocol',
    protocol: doStmt.protocol,
    roleArguments: doStmt.roleArguments,
  };

  const actionNode = addNode(ctx, createActionNode(action));
  addEdge(ctx, actionNode.id, exitNodeId, 'sequence');

  return actionNode.id;
}
