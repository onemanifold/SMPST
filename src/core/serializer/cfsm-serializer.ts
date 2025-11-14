/**
 * CFSM to Scribble Serializer
 *
 * Converts CFSM (Communicating Finite State Machine) back to Scribble local protocol text.
 *
 * This completes the round-trip: Global Protocol → CFG → CFSM → Local Protocol Text
 *
 * APPROACH:
 * - Walk CFSM state machine from initial to terminal states
 * - Reconstruct structured Scribble syntax from flat transition graph
 * - Detect patterns: sequences, choices (branching), parallel (not in local), recursion (back edges)
 *
 * CHALLENGES:
 * - CFSM is operational (states + transitions), Scribble is declarative (structured)
 * - Need to infer structure from graph topology
 * - Handle tau transitions (should be eliminated in output)
 */

import type {
  CFSM,
  CFSMTransition,
  CFSMAction,
  SendAction,
  ReceiveAction,
} from '../projection/types';
import type { Message, Type } from '../ast/types';

// ============================================================================
// Serializer Options
// ============================================================================

export interface CFSMSerializerOptions {
  /** Indentation string (default: 2 spaces) */
  indent?: string;

  /** Line ending style */
  lineEnding?: '\n' | '\r\n';

  /** Whether to include state IDs as comments (for debugging) */
  includeStateIds?: boolean;

  /** Whether to simplify tau transitions (default: true) */
  simplifyTau?: boolean;
}

const DEFAULT_OPTIONS: Required<CFSMSerializerOptions> = {
  indent: '  ',
  lineEnding: '\n',
  includeStateIds: false,
  simplifyTau: true,
};

// ============================================================================
// Main Serialization Function
// ============================================================================

/**
 * Serialize a CFSM to Scribble local protocol text
 *
 * @param cfsm - CFSM to serialize
 * @param options - Serialization options
 * @returns Scribble local protocol text
 */
export function serializeCFSM(
  cfsm: CFSM,
  options: CFSMSerializerOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // Protocol signature
  const signature = buildProtocolSignature(cfsm);
  lines.push(signature + ' {');

  // Protocol body - walk CFSM and reconstruct structure
  const body = serializeCFSMBody(cfsm, 1, opts);
  if (body) {
    lines.push(body);
  }

  // Close protocol
  lines.push('}');

  return lines.join(opts.lineEnding);
}

/**
 * Build the protocol signature line
 *
 * Example: local protocol TwoBuyer_Buyer1 at Buyer1()
 */
function buildProtocolSignature(cfsm: CFSM): string {
  // Build parameters
  let paramStr = '()';
  if (cfsm.parameters && cfsm.parameters.length > 0) {
    const params = cfsm.parameters.map(p => `${p.kind} ${p.name}`).join(', ');
    paramStr = `(${params})`;
  }

  return `local protocol ${cfsm.protocolName}_${cfsm.role} at ${cfsm.role}${paramStr}`;
}

// ============================================================================
// Body Serialization
// ============================================================================

/**
 * Serialize CFSM body by walking the state machine
 */
function serializeCFSMBody(
  cfsm: CFSM,
  indentLevel: number,
  opts: Required<CFSMSerializerOptions>
): string {
  const lines: string[] = [];
  const visited = new Set<string>();

  // Start from initial state
  const initialTransitions = cfsm.transitions.filter(
    t => t.from === cfsm.initialState
  );

  for (const trans of initialTransitions) {
    const serialized = walkTransitions(
      cfsm,
      trans.from,
      indentLevel,
      visited,
      opts
    );
    lines.push(...serialized);
  }

  return lines.join(opts.lineEnding);
}

/**
 * Walk transitions from a state and serialize them
 *
 * Handles:
 * - Sequential transitions (simple path)
 * - Branching (choice/select)
 * - Back edges (recursion - detected but not fully handled in local protocols)
 * - Terminal states
 */
function walkTransitions(
  cfsm: CFSM,
  fromState: string,
  indentLevel: number,
  visited: Set<string>,
  opts: Required<CFSMSerializerOptions>
): string[] {
  const lines: string[] = [];
  const indent = opts.indent.repeat(indentLevel);

  // Prevent infinite loops (handle cycles)
  if (visited.has(fromState)) {
    // Back edge detected - this is a recursion point
    // In local protocols, this should be handled by rec/continue
    // For now, just add a comment
    if (opts.includeStateIds) {
      lines.push(`${indent}// Back edge to state ${fromState}`);
    }
    return lines;
  }

  visited.add(fromState);

  // Get outgoing transitions from this state
  const outgoing = cfsm.transitions.filter(t => t.from === fromState);

  if (outgoing.length === 0) {
    // Terminal state or isolated state
    if (opts.includeStateIds && !cfsm.terminalStates.includes(fromState)) {
      lines.push(`${indent}// Dead end at state ${fromState}`);
    }
    return lines;
  }

  // Case 1: Single transition (sequential)
  if (outgoing.length === 1) {
    const trans = outgoing[0];

    // Serialize the action
    const actionLine = serializeAction(trans.action, indent, opts);
    if (actionLine) {
      lines.push(actionLine);
    }

    // Continue walking from target state (unless it's terminal)
    if (!cfsm.terminalStates.includes(trans.to)) {
      const next = walkTransitions(cfsm, trans.to, indentLevel, visited, opts);
      lines.push(...next);
    }

    return lines;
  }

  // Case 2: Multiple transitions (choice/branching)
  // In local protocols, this represents internal choice (select) or external choice (offer)
  // We can infer which by looking at the first action in each branch
  lines.push(`${indent}choice {`);

  for (let i = 0; i < outgoing.length; i++) {
    const trans = outgoing[i];

    if (i > 0) {
      lines.push(`${indent}} or {`);
    }

    // Serialize the branch
    const actionLine = serializeAction(trans.action, opts.indent.repeat(indentLevel + 1), opts);
    if (actionLine) {
      lines.push(actionLine);
    }

    // Continue walking this branch
    if (!cfsm.terminalStates.includes(trans.to)) {
      const branchLines = walkTransitions(
        cfsm,
        trans.to,
        indentLevel + 1,
        new Set(visited), // New visited set for each branch
        opts
      );
      lines.push(...branchLines);
    }
  }

  lines.push(`${indent}}`);

  return lines;
}

// ============================================================================
// Action Serialization
// ============================================================================

/**
 * Serialize a CFSM action to Scribble syntax
 */
function serializeAction(
  action: CFSMAction,
  indent: string,
  opts: Required<CFSMSerializerOptions>
): string | null {
  switch (action.type) {
    case 'send':
      return serializeSendAction(action, indent);

    case 'receive':
      return serializeReceiveAction(action, indent);

    case 'tau':
      // Tau actions are internal/silent - skip in output unless debugging
      if (!opts.simplifyTau && opts.includeStateIds) {
        return `${indent}// τ (silent transition)`;
      }
      return null;

    case 'choice':
      // Choice actions are structural, handled by branching logic
      return null;

    case 'subprotocol':
      return serializeSubProtocolAction(action, indent);

    default:
      return `${indent}// Unknown action type`;
  }
}

/**
 * Serialize Send action
 *
 * Format: message(payload) to Role;
 */
function serializeSendAction(action: SendAction, indent: string): string {
  const message = serializeMessage(action.message);
  const to = Array.isArray(action.to) ? action.to.join(', ') : action.to;
  return `${indent}${message} to ${to};`;
}

/**
 * Serialize Receive action
 *
 * Format: message(payload) from Role;
 */
function serializeReceiveAction(action: ReceiveAction, indent: string): string {
  const message = serializeMessage(action.message);
  return `${indent}${message} from ${action.from};`;
}

/**
 * Serialize SubProtocol action
 *
 * Format: do Protocol(roles);
 */
function serializeSubProtocolAction(
  action: import('../projection/types').SubProtocolCallAction,
  indent: string
): string {
  const roles = Object.values(action.roleMapping).join(', ');
  return `${indent}do ${action.protocol}(${roles});`;
}

/**
 * Serialize message signature
 *
 * ENRICHED: Uses full Message object with Type AST
 *
 * Formats:
 * - label(Type)              - with payload
 * - label()                  - no payload
 * - label(Map<String, User>) - parametric types
 */
function serializeMessage(message: Message): string {
  const { label, payload } = message;

  if (!payload) {
    return `${label}()`;
  }

  const typeStr = serializeType(payload.payloadType);
  return `${label}(${typeStr})`;
}

/**
 * Serialize type
 *
 * ENRICHED: Handles full Type AST structure
 */
function serializeType(type: Type): string {
  if (type.type === 'SimpleType') {
    return type.name;
  }

  if (type.type === 'ParametricType') {
    const args = type.arguments.map(serializeType).join(', ');
    return `${type.name}<${args}>`;
  }

  return 'Unknown';
}

// ============================================================================
// Batch Serialization
// ============================================================================

/**
 * Serialize multiple CFSMs to Scribble text
 *
 * @param cfsms - Map of role to CFSM
 * @param options - Serialization options
 * @returns Map of role to serialized text
 */
export function serializeAllCFSMs(
  cfsms: Map<string, CFSM>,
  options: CFSMSerializerOptions = {}
): Map<string, string> {
  const serialized = new Map<string, string>();

  for (const [role, cfsm] of cfsms) {
    serialized.set(role, serializeCFSM(cfsm, options));
  }

  return serialized;
}
