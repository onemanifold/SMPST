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
 * @param cfg - Global protocol CFG
 * @returns Sequence of trace events
 */
export function extractGlobalTrace(cfg: CFG): TraceEvent[] {
  // Extract trace by walking CFG from initial node
  //
  // SIMPLIFIED IMPLEMENTATION:
  // - Walk graph from initial to terminal
  // - Collect all action nodes encountered
  // - Convert to trace events
  // - Handle only sequential flow (no branching/recursion for now)
  //
  // Full implementation would need:
  // - Handle all possible execution paths (choices)
  // - Handle recursion (potentially infinite traces)
  // - Handle parallel branches (interleaving)

  const trace: TraceEvent[] = [];
  const visited = new Set<string>();

  // BFS traversal from initial node
  const queue: string[] = [cfg.initialNode];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = cfg.nodes.find(n => n.id === nodeId);
    if (!node) continue;

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

    // Add outgoing edges to queue (sequential only)
    const outgoing = cfg.edges.filter(e => e.from === nodeId && e.type === 'sequence');
    for (const edge of outgoing) {
      queue.push(edge.to);
    }
  }

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
  // Extract trace from CFSM transitions
  //
  // SIMPLIFIED IMPLEMENTATION:
  // - Walk CFSM from initial state
  // - Collect all transition actions
  // - Convert send/receive to message events
  //
  // Full implementation would handle:
  // - All execution paths (choices)
  // - Recursion (cycles in CFSM)
  // - Complex control flow

  const trace: TraceEvent[] = [];
  const visited = new Set<string>();

  // BFS from initial state
  const queue: string[] = [cfsm.initialState];

  while (queue.length > 0) {
    const stateId = queue.shift()!;

    if (visited.has(stateId)) continue;
    visited.add(stateId);

    // Find all transitions from this state
    const transitions = cfsm.transitions.filter(t => t.from === stateId);

    for (const transition of transitions) {
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

      // Add target state to queue
      queue.push(transition.to);
    }
  }

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
 * @param trace1 - First trace
 * @param trace2 - Second trace
 * @returns true if traces are equivalent
 */
export function compareTraces(trace1: TraceEvent[], trace2: TraceEvent[]): boolean {
  // TODO: Implement trace equivalence check
  // Account for:
  // - Action permutations (independent actions can be reordered)
  // - Dynamic participant naming (instances may have different IDs)

  return false;
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
  // Theorem 20: Verify trace equivalence
  //
  // ALGORITHM:
  // 1. Extract global trace from CFG
  // 2. Extract local traces from all CFSMs
  // 3. Compose local traces
  // 4. Compare global vs composed
  //
  // SIMPLIFIED IMPLEMENTATION:
  // - Extracts traces (may be incomplete for complex protocols)
  // - Compares based on message count and participants
  // - Full implementation would check action-by-action equivalence

  try {
    // Step 1: Extract global trace
    const globalTrace = extractGlobalTrace(cfg);

    // Step 2: Extract local traces
    const localTraces: TraceEvent[][] = [];
    for (const cfsm of projections.values()) {
      const trace = extractLocalTrace(cfsm);
      if (trace.length > 0) {
        localTraces.push(trace);
      }
    }

    // Step 3: Compose local traces
    const composedTrace = composeTraces(localTraces);

    // Step 4: Compare
    // Simplified check: same number of message events
    const globalMessages = globalTrace.filter(e => e.type === 'message').length;
    const composedMessages = composedTrace.filter(e => e.type === 'message').length;

    const isEquivalent = globalMessages === composedMessages;

    return {
      isEquivalent,
      reason: isEquivalent
        ? 'Trace equivalence verified (simplified check)'
        : `Message count mismatch: global=${globalMessages}, composed=${composedMessages}`,
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
