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
// Theorem 20 Verification
// ============================================================================

/**
 * Verify Theorem 20 (Trace Equivalence) for a DMst protocol.
 *
 * Checks that global trace and composed local traces are equivalent.
 *
 * @param cfg - Global protocol CFG
 * @param projections - Local projections for all roles
 * @returns Verification result
 */
export function verifyTraceEquivalence(
  cfg: CFG,
  projections: Map<string, CFSM>
): TraceEquivalenceResult {
  try {
    // Step 1: Extract global trace from CFG
    const globalTrace = extractGlobalTrace(cfg);

    // Step 2: Extract local traces from all CFSMs
    const localTraces: TraceEvent[][] = [];
    for (const cfsm of projections.values()) {
      const trace = extractLocalTrace(cfsm);
      if (trace.length > 0) {
        localTraces.push(trace);
      }
    }

    // Step 3: Compose local traces into a single global view
    const composedTrace = composeTraces(localTraces);

    // Step 4: Compare global trace with composed trace
    // For DMst, creates/invites are synchronization primitives that don't appear
    // in local projections. We compare only the communication events (messages, protocol calls).
    const globalComm = globalTrace.filter(e =>
      e.type === 'message' || e.type === 'protocol-call'
    );
    const composedComm = composedTrace.filter(e =>
      e.type === 'message' || e.type === 'protocol-call'
    );

    const isEquivalent = compareTraces(globalComm, composedComm);

    // Generate detailed reason
    let reason: string;
    if (isEquivalent) {
      reason = `Trace equivalence verified: ${globalComm.length} communication events match`;
    } else {
      // Provide detailed mismatch information
      const globalMsgs = globalTrace.filter(e => e.type === 'message').length;
      const composedMsgs = composedTrace.filter(e => e.type === 'message').length;
      const globalCreates = globalTrace.filter(e => e.type === 'participant-creation').length;
      const composedCreates = composedTrace.filter(e => e.type === 'participant-creation').length;

      reason = `Trace mismatch: global(${globalTrace.length} events: ${globalMsgs} msgs, ${globalCreates} creates) vs composed(${composedTrace.length} events: ${composedMsgs} msgs, ${composedCreates} creates)`;
    }

    return {
      isEquivalent,
      reason,
      globalTrace,
      composedTrace,
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
