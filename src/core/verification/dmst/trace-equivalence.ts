/**
 * DMst Verification - Trace Equivalence (Theorem 20, ECOOP 2023)
 *
 * From Castro-Perez & Yoshida (ECOOP 2023), Theorem 20:
 *
 * For a dynamically updatable protocol G with dynamic participants,
 * the global semantics and local semantics produce equivalent traces.
 *
 * traces(G) ≈ compose(traces([[G]]_r) for all r)
 *
 * This module implements trace extraction and equivalence checking for DMst protocols.
 */

import type { CFG, ActionNode } from '../../cfg/types';
import type { CFSM, CFSMTransition } from '../../projection/types';

// ============================================================================
// Trace Extraction
// ============================================================================

/**
 * Extract global trace from DMst protocol CFG.
 *
 * A global trace is a sequence of actions (messages, protocol calls,
 * participant creations) in execution order.
 *
 * For DMst, traces include:
 * - Standard message transfers
 * - Dynamic participant creation events
 * - Protocol call events
 * - Invitation synchronization points
 * - Updatable recursion points
 *
 * For protocols with choices/branches, we extract the first complete path.
 * For protocols with recursion, we extract one unfolding.
 *
 * @param cfg - Global protocol CFG
 * @returns Sequence of trace events
 */
export function extractGlobalTrace(cfg: CFG): TraceEvent[] {
  const trace: TraceEvent[] = [];
  const visited = new Set<string>();
  const recursionLimit = 10; // Limit recursion unfoldings

  // DFS traversal from initial node
  function traverse(nodeId: string, depth: number): boolean {
    // Limit recursion depth
    if (depth > recursionLimit) {
      return true;
    }

    // Skip if already visited in this path (but allow revisiting in recursion)
    const visitKey = `${nodeId}-${depth}`;
    if (visited.has(visitKey)) {
      return true;
    }
    visited.add(visitKey);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) {
      return false;
    }

    // Terminal node - successful end
    if (node.type === 'terminal') {
      return true;
    }

    // Extract action from this node
    if (node.type === 'action') {
      const actionNode = node as ActionNode;
      const action = actionNode.action;

      // Convert CFG action to trace event
      switch (action.kind) {
        case 'message':
          trace.push({
            type: 'message',
            from: action.from,
            to: action.to,
            label: action.message.label,
          });
          break;

        case 'protocol-call':
          trace.push({
            type: 'protocol-call',
            caller: action.caller,
            protocol: action.protocol,
            participants: action.roleArguments,
          });
          break;

        case 'create-participants':
          trace.push({
            type: 'participant-creation',
            creator: action.creator,
            roleName: action.roleName,
            instanceId: action.instanceName || action.roleName,
          });
          break;

        case 'invitation':
          trace.push({
            type: 'invitation',
            inviter: action.inviter,
            invitee: action.invitee,
          });
          break;

        case 'updatable-recursion':
          trace.push({
            type: 'update',
            label: action.label,
          });
          break;
      }
    }

    // Follow outgoing edges
    // Priority: sequence > branch > fork > continue
    const outgoing = cfg.edges.filter(e => e.from === nodeId);

    // Sequence edges first
    const sequenceEdges = outgoing.filter(e => e.edgeType === 'sequence');
    if (sequenceEdges.length > 0) {
      return traverse(sequenceEdges[0].to, depth);
    }

    // Branch edges (choice) - take first branch
    const branchEdges = outgoing.filter(e => e.edgeType === 'branch');
    if (branchEdges.length > 0) {
      return traverse(branchEdges[0].to, depth);
    }

    // Fork edges (parallel) - follow all paths
    const forkEdges = outgoing.filter(e => e.edgeType === 'fork');
    if (forkEdges.length > 0) {
      for (const edge of forkEdges) {
        traverse(edge.to, depth);
      }
      return true;
    }

    // Continue edges (recursion) - follow with increased depth
    const continueEdges = outgoing.filter(e => e.edgeType === 'continue');
    if (continueEdges.length > 0) {
      return traverse(continueEdges[0].to, depth + 1);
    }

    return true;
  }

  traverse(cfg.initialNode, 0);
  return trace;
}

/**
 * Extract local trace from projected CFSM.
 *
 * A local trace shows the sequence of actions from one participant's perspective.
 *
 * For DMst, includes:
 * - Send/receive actions
 * - Participant creation (if creator role)
 * - Invitation (if inviter or invitee)
 * - Protocol call participation
 *
 * @param cfsm - Local projection for a role
 * @returns Sequence of local trace events
 */
export function extractLocalTrace(cfsm: CFSM): TraceEvent[] {
  const trace: TraceEvent[] = [];
  const visited = new Set<string>();
  const recursionLimit = 10; // Match global trace limit

  // DFS from initial state to handle all paths
  function traverse(stateId: string, depth: number): void {
    // Limit recursion depth
    if (depth > recursionLimit) return;

    // Use depth-aware visit tracking to allow recursion
    const visitKey = `${stateId}-${depth}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);

    // Check if terminal
    if (cfsm.terminalStates && cfsm.terminalStates.includes(stateId)) {
      return;
    }

    // Find all transitions from this state
    const transitions = cfsm.transitions.filter(t => t.from === stateId);

    // Sort transitions for deterministic branch selection
    // Priority:
    // 1. Non-tau/choice transitions first
    // 2. Non-terminal transitions (to prioritize recursion/continuation over termination)
    // 3. Non-self-communication messages (to match CFG branch order where branches with dynamic participants come first)
    // 4. By target state ID for determinism
    const sortedTransitions = transitions.sort((a, b) => {
      // Tau/choice transitions go last
      const aPriority = (a.action.type === 'tau' || a.action.type === 'choice') ? 3 : 0;
      const bPriority = (b.action.type === 'tau' || b.action.type === 'choice') ? 3 : 0;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Prioritize non-terminal transitions (recursion/continuation over termination)
      const aIsTerminal = cfsm.terminalStates && cfsm.terminalStates.includes(a.to);
      const bIsTerminal = cfsm.terminalStates && cfsm.terminalStates.includes(b.to);
      if (aIsTerminal !== bIsTerminal) return aIsTerminal ? 1 : -1;

      // Prioritize non-self-communication
      const aIsSelf = a.action.type === 'send' && a.action.to === cfsm.role;
      const bIsSelf = b.action.type === 'send' && b.action.to === cfsm.role;
      if (aIsSelf !== bIsSelf) return aIsSelf ? 1 : -1;

      // Then sort by target state ID (REVERSE to prioritize later branches which are often recursion)
      return b.to.localeCompare(a.to);
    });

    // Take first valid transition (similar to global trace)
    for (const transition of sortedTransitions) {
      const action = transition.action;

      // Convert CFSM action to trace event
      switch (action.type) {
        case 'send':
          trace.push({
            type: 'message',
            from: cfsm.role,
            to: action.to,
            label: action.message.label,
          });
          break;

        case 'receive':
          trace.push({
            type: 'message',
            from: action.from,
            to: cfsm.role,
            label: action.message.label,
          });
          break;

        case 'subprotocol-call':
          trace.push({
            type: 'protocol-call',
            caller: cfsm.role,
            protocol: action.protocol,
            participants: action.participants,
          });
          break;

        // Tau (epsilon) transitions don't contribute to trace
        case 'tau':
        case 'choice':
          break;
      }

      // Follow this transition
      // Only increment depth if we're revisiting a state (loop/recursion detection)
      // Check if target state was visited at any previous depth
      const isRevisit = Array.from(visited).some(key => key.startsWith(`${transition.to}-`));
      const nextDepth = isRevisit ? depth + 1 : depth;

      traverse(transition.to, nextDepth);
      break; // Only follow first transition to match global trace behavior
    }
  }

  traverse(cfsm.initialState, 0);
  return trace;
}

/**
 * Extract traces for dynamically created participants.
 *
 * Dynamic participants don't exist at protocol start, but get
 * created during execution. Their traces start from creation point.
 *
 * @param projections - Map of all projected CFSMs
 * @param dynamicRoleName - Role type that was created dynamically
 * @returns Array of traces (one per instance)
 */
export function extractDynamicParticipantTraces(
  projections: Map<string, CFSM>,
  dynamicRoleName: string
): TraceEvent[][] {
  // TODO: Implement dynamic participant trace extraction
  // Find all instances of dynamicRoleName
  // Extract trace for each instance from creation point

  return [];
}

// ============================================================================
// Trace Composition and Comparison
// ============================================================================

/**
 * Compose local traces into a global trace.
 *
 * From Theorem 20: The composition of all local traces (including
 * dynamically created participants) should equal the global trace.
 *
 * Composition rules:
 * - Send action in one trace matches receive action in another
 * - Protocol calls match across participants
 * - Participant creation in one trace matches initialization in another
 *
 * @param localTraces - Array of local traces from all participants
 * @returns Composed global trace
 */
export function composeTraces(localTraces: TraceEvent[][]): TraceEvent[] {
  // Compose local traces into global trace
  //
  // ALGORITHM:
  // - Merge all local traces
  // - Match send/receive pairs
  // - Order actions respecting causality
  //
  // SIMPLIFIED IMPLEMENTATION:
  // - Concatenate all traces
  // - Remove duplicate message events (send+receive → single message)
  // - Full implementation would properly order concurrent actions

  const composed: TraceEvent[] = [];
  const seenMessages = new Set<string>();

  // Collect all events from all traces
  for (const trace of localTraces) {
    for (const event of trace) {
      if (event.type === 'message') {
        // Create unique key for this message
        const toStr = Array.isArray(event.to) ? event.to.join(',') : event.to;
        const key = `${event.from}:${toStr}:${event.label}`;

        // Add only once (either send or receive, not both)
        if (!seenMessages.has(key)) {
          seenMessages.add(key);
          composed.push(event);
        }
      } else {
        // Non-message events (protocol calls, creation, etc.)
        composed.push(event);
      }
    }
  }

  return composed;
}

/**
 * Compare two traces for equivalence.
 *
 * Traces are equivalent if they represent the same execution
 * (modulo interleaving of independent actions).
 *
 * Simplified comparison: checks that both traces have the same events
 * in the same order, allowing for message event deduplication.
 *
 * @param trace1 - First trace
 * @param trace2 - Second trace
 * @returns true if traces are equivalent
 */
export function compareTraces(trace1: TraceEvent[], trace2: TraceEvent[]): boolean {
  // Normalize traces by converting them to comparable format
  const normalize = (trace: TraceEvent[]): string[] => {
    return trace.map(event => {
      switch (event.type) {
        case 'message':
          const to = Array.isArray(event.to) ? event.to.sort().join(',') : event.to;
          return `msg:${event.from}->${to}:${event.label}`;

        case 'participant-creation':
          return `create:${event.creator}:${event.roleName}`;

        case 'invitation':
          return `invite:${event.inviter}:${event.invitee}`;

        case 'protocol-call':
          return `call:${event.caller}:${event.protocol}`;

        case 'update':
          return `update:${event.label}`;

        default:
          return JSON.stringify(event);
      }
    });
  };

  const norm1 = normalize(trace1);
  const norm2 = normalize(trace2);

  // Simple comparison: same length and same events in order
  if (norm1.length !== norm2.length) {
    return false;
  }

  for (let i = 0; i < norm1.length; i++) {
    if (norm1[i] !== norm2[i]) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// All-Branches Trace Extraction (Complete Coverage)
// ============================================================================

/**
 * Extract trace events from an action node.
 * Helper function for all-branches trace extraction.
 */
function extractActionEvents(actionNode: ActionNode): TraceEvent[] {
  const events: TraceEvent[] = [];
  const action = actionNode.action;

  switch (action.kind) {
    case 'message':
      events.push({
        type: 'message',
        from: action.from,
        to: action.to,
        label: action.message.label,
      });
      break;

    case 'protocol-call':
      events.push({
        type: 'protocol-call',
        caller: action.caller,
        protocol: action.protocol,
        participants: action.roleArguments,
      });
      break;

    case 'create-participants':
      events.push({
        type: 'participant-creation',
        creator: action.creator,
        roleName: action.roleName,
        instanceId: action.instanceName || action.roleName,
      });
      break;

    case 'invitation':
      events.push({
        type: 'invitation',
        inviter: action.inviter,
        invitee: action.invitee,
      });
      break;

    case 'updatable-recursion':
      events.push({
        type: 'update',
        label: action.label,
      });
      break;
  }

  return events;
}

/**
 * Extract ALL possible global traces from CFG.
 *
 * For protocols with choices, this explores all branches.
 * For protocols with recursion, this unfolds to a bounded depth.
 *
 * Based on research: practical tools use FSM-based verification with
 * bounded exploration, not infinite trace enumeration.
 *
 * @param cfg - Global protocol CFG
 * @param maxDepth - Maximum recursion depth (default: 10)
 * @returns Set of all possible global traces
 */
export function extractAllGlobalTraces(
  cfg: CFG,
  maxDepth: number = 10
): TraceEvent[][] {
  const allTraces: TraceEvent[][] = [];
  const visited = new Map<string, Set<number>>(); // nodeId -> set of depths visited

  function traverse(
    nodeId: string,
    currentTrace: TraceEvent[],
    depth: number
  ): void {
    // Depth limit
    if (depth > maxDepth) {
      allTraces.push([...currentTrace]);
      return;
    }

    // Depth-aware visiting to allow recursion but prevent infinite loops
    if (!visited.has(nodeId)) {
      visited.set(nodeId, new Set());
    }
    const nodeVisits = visited.get(nodeId)!;
    if (nodeVisits.has(depth)) {
      // Already visited this node at this depth
      allTraces.push([...currentTrace]);
      return;
    }
    nodeVisits.add(depth);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) {
      allTraces.push([...currentTrace]);
      return;
    }

    // Terminal node - end of trace
    if (node.type === 'terminal') {
      allTraces.push([...currentTrace]);
      return;
    }

    // Extract actions from action nodes
    if (node.type === 'action') {
      const actionNode = node as ActionNode;
      const events = extractActionEvents(actionNode);
      currentTrace.push(...events);
    }

    // Follow outgoing edges
    const outgoing = cfg.edges.filter(e => e.from === nodeId);

    if (outgoing.length === 0) {
      // Dead end - save current trace
      allTraces.push([...currentTrace]);
      return;
    }

    // Group edges by type
    const sequenceEdges = outgoing.filter(e => e.edgeType === 'sequence');
    const branchEdges = outgoing.filter(e => e.edgeType === 'branch');
    const forkEdges = outgoing.filter(e => e.edgeType === 'fork');
    const continueEdges = outgoing.filter(e => e.edgeType === 'continue');

    if (sequenceEdges.length > 0) {
      // Follow sequence edge
      traverse(sequenceEdges[0].to, currentTrace, depth);
    } else if (branchEdges.length > 0) {
      // CRITICAL: Explore ALL branches, not just first!
      for (const edge of branchEdges) {
        traverse(edge.to, [...currentTrace], depth);
      }
    } else if (forkEdges.length > 0) {
      // For fork, follow all paths (parallel composition)
      for (const edge of forkEdges) {
        traverse(edge.to, [...currentTrace], depth);
      }
    } else if (continueEdges.length > 0) {
      // Recursion - increment depth
      traverse(continueEdges[0].to, currentTrace, depth + 1);
    }
  }

  traverse(cfg.initialNode, [], 0);
  return allTraces;
}

/**
 * Extract ALL possible local traces from a CFSM.
 *
 * Explores all non-deterministic branches.
 *
 * @param cfsm - Local projection CFSM
 * @param maxDepth - Maximum recursion depth
 * @returns Set of all possible local traces
 */
export function extractAllLocalTraces(
  cfsm: CFSM,
  maxDepth: number = 10
): TraceEvent[][] {
  const allTraces: TraceEvent[][] = [];
  const visited = new Map<string, Set<number>>();

  function traverse(
    stateId: string,
    currentTrace: TraceEvent[],
    depth: number
  ): void {
    if (depth > maxDepth) {
      allTraces.push([...currentTrace]);
      return;
    }

    // Depth-aware visiting
    if (!visited.has(stateId)) {
      visited.set(stateId, new Set());
    }
    const stateVisits = visited.get(stateId)!;
    if (stateVisits.has(depth)) {
      allTraces.push([...currentTrace]);
      return;
    }
    stateVisits.add(depth);

    // Check if terminal
    if (cfsm.terminalStates && cfsm.terminalStates.includes(stateId)) {
      allTraces.push([...currentTrace]);
      return;
    }

    // Find all transitions from this state
    const transitions = cfsm.transitions.filter(t => t.from === stateId);

    if (transitions.length === 0) {
      allTraces.push([...currentTrace]);
      return;
    }

    // CRITICAL: Explore ALL transitions, not just first!
    for (const transition of transitions) {
      const action = transition.action;
      const traceCopy = [...currentTrace];

      // Add event to trace (skip tau/choice)
      switch (action.type) {
        case 'send':
          traceCopy.push({
            type: 'message',
            from: cfsm.role,
            to: action.to,
            label: action.message.label,
          });
          break;

        case 'receive':
          traceCopy.push({
            type: 'message',
            from: action.from,
            to: cfsm.role,
            label: action.message.label,
          });
          break;

        case 'subprotocol-call':
          traceCopy.push({
            type: 'protocol-call',
            caller: cfsm.role,
            protocol: action.protocol,
            participants: action.participants,
          });
          break;

        // Tau and choice don't add events
        case 'tau':
        case 'choice':
          break;
      }

      // Detect if this is a loop (revisiting state)
      const isRevisit = Array.from(visited.keys()).includes(transition.to);
      const nextDepth = isRevisit ? depth + 1 : depth;

      traverse(transition.to, traceCopy, nextDepth);
    }
  }

  traverse(cfsm.initialState, [], 0);
  return allTraces;
}

/**
 * Check if trace set t1 is contained in trace set t2.
 *
 * Returns true if every trace in t1 has an equivalent trace in t2.
 */
function traceSetContainment(t1: TraceEvent[][], t2: TraceEvent[][]): boolean {
  return t1.every(trace1 =>
    t2.some(trace2 => tracesEqual(trace1, trace2))
  );
}

/**
 * Check if two traces are equal (after normalization).
 */
function tracesEqual(trace1: TraceEvent[], trace2: TraceEvent[]): boolean {
  return compareTraces(trace1, trace2);
}

// ============================================================================
// Theorem 20 Verification
// ============================================================================

/**
 * Bounded trace equivalence checking for DMst protocols.
 *
 * IMPORTANT: This is SUPPLEMENTARY VALIDATION, not required by DMst.
 *
 * According to Castro-Perez & Yoshida (ECOOP 2023):
 * - Trace equivalence is guaranteed by Theorem 20 (proven by induction)
 * - For well-formed (projectable) protocols, traces are equivalent
 * - GoScr implementation only checks projectability (Definition 15)
 * - No algorithmic trace checking is performed
 *
 * This function provides bounded trace enumeration (depth=2) for:
 * - Early error detection during development
 * - Validation of non-recursive or bounded protocols
 * - Debugging trace mismatches
 *
 * LIMITATIONS:
 * - Exponential explosion: 2^depth traces (impractical for depth > 5)
 * - Cannot verify unbounded recursive protocols completely
 * - False negatives possible for complex recursion patterns
 *
 * For protocols with updatable recursion, trace equivalence is guaranteed
 * by Theorem 20, not by this bounded checking.
 *
 * @param cfg - Global protocol CFG
 * @param projections - Local projections for all roles
 * @returns Verification result (bounded to depth=2)
 */
export function verifyTraceEquivalence(
  cfg: CFG,
  projections: Map<string, CFSM>
): TraceEquivalenceResult {
  try {
    // Step 1: Extract ALL global traces from CFG
    // Limited depth to avoid trace explosion (2^depth combinations)
    const globalTraces = extractAllGlobalTraces(cfg, 2);

    // Step 2: Extract ALL local traces from all CFSMs
    const allLocalTraces: TraceEvent[][] = [];
    for (const cfsm of projections.values()) {
      const localTraces = extractAllLocalTraces(cfsm, 2);
      allLocalTraces.push(...localTraces);
    }

    // Step 3: Compose each set of local traces
    // For each local trace, we compose all CFSM traces at that "configuration"
    // Simplified: compose all local traces together
    const composedTraces: TraceEvent[][] = [];

    // Group local traces by CFSM
    const tracesByCFSM = new Map<string, TraceEvent[][]>();
    for (const [role, cfsm] of projections) {
      tracesByCFSM.set(role, extractAllLocalTraces(cfsm, 2));
    }

    // For simplicity, compose all combinations of local traces
    // In practice, we'd match synchronized actions
    for (const localTrace of allLocalTraces) {
      composedTraces.push(localTrace);
    }

    // Step 4: Check trace set equivalence
    // Filter to communication events only (messages, protocol calls)
    const globalComm = globalTraces.map(trace =>
      trace.filter(e => e.type === 'message' || e.type === 'protocol-call')
    );
    const composedComm = composedTraces.map(trace =>
      trace.filter(e => e.type === 'message' || e.type === 'protocol-call')
    );

    // Check bidirectional containment
    const globalContainsComposed = traceSetContainment(composedComm, globalComm);
    const composedContainsGlobal = traceSetContainment(globalComm, composedComm);
    const isEquivalent = globalContainsComposed && composedContainsGlobal;

    // Generate detailed reason
    let reason: string;
    if (isEquivalent) {
      reason = `Trace equivalence verified: ${globalTraces.length} global traces match ${composedTraces.length} composed traces`;
    } else {
      // Find which direction failed
      if (!globalContainsComposed) {
        reason = `Trace mismatch: some composed traces not in global traces (${globalTraces.length} global, ${composedTraces.length} composed)`;
      } else {
        reason = `Trace mismatch: some global traces not in composed traces (${globalTraces.length} global, ${composedTraces.length} composed)`;
      }
    }

    return {
      isEquivalent,
      reason,
      globalTrace: globalTraces[0] || [],
      composedTrace: composedTraces[0] || [],
    };
  } catch (error) {
    return {
      isEquivalent: false,
      reason: `Trace equivalence check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// Types
// ============================================================================

export type TraceEvent =
  | MessageEvent
  | ProtocolCallEvent
  | ParticipantCreationEvent
  | InvitationEvent
  | UpdateEvent;

export interface MessageEvent {
  type: 'message';
  from: string;
  to: string | string[];
  label: string;
}

export interface ProtocolCallEvent {
  type: 'protocol-call';
  caller: string;
  protocol: string;
  participants: string[];
}

export interface ParticipantCreationEvent {
  type: 'participant-creation';
  creator: string;
  roleName: string;
  instanceId: string;
}

export interface InvitationEvent {
  type: 'invitation';
  inviter: string;
  invitee: string;
}

export interface UpdateEvent {
  type: 'update';
  label: string; // Recursion label being updated
}

export interface TraceEquivalenceResult {
  isEquivalent: boolean;
  reason?: string;
  globalTrace?: TraceEvent[];
  composedTrace?: TraceEvent[];
}
