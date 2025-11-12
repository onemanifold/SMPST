/**
 * Local Protocol Serializer
 *
 * Converts Local Protocol AST back to Scribble text format.
 *
 * This allows round-trip: Global Protocol → Local Protocol AST → Text
 */

import type {
  LocalProtocolDeclaration,
  LocalInteraction,
  Send,
  Receive,
  LocalChoice,
  LocalParallel,
  Recursion,
  Continue,
  Do,
  Message,
  Type,
  Payload,
  ProtocolParameter,
} from '../ast/types';

// ============================================================================
// Main Serialization Functions
// ============================================================================

export interface SerializerOptions {
  /**
   * Indentation string (default: 2 spaces)
   */
  indent?: string;

  /**
   * Whether to include location comments
   */
  includeLocations?: boolean;

  /**
   * Line ending style
   */
  lineEnding?: '\n' | '\r\n';
}

const DEFAULT_OPTIONS: Required<SerializerOptions> = {
  indent: '  ',
  includeLocations: false,
  lineEnding: '\n',
};

/**
 * Serialize a local protocol declaration to Scribble text
 *
 * @param protocol - Local protocol declaration
 * @param options - Serialization options
 * @returns Scribble text representation
 */
export function serializeLocalProtocol(
  protocol: LocalProtocolDeclaration,
  options: SerializerOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // Protocol signature
  const signature = buildProtocolSignature(protocol);
  lines.push(signature + ' {');

  // Protocol body
  const body = serializeBody(protocol.body, 1, opts);
  lines.push(body);

  // Close protocol
  lines.push('}');

  return lines.join(opts.lineEnding);
}

/**
 * Build the protocol signature line
 *
 * Example: local protocol BookJourney_Customer at Customer(role Agency, role Service)
 */
function buildProtocolSignature(protocol: LocalProtocolDeclaration): string {
  const parts: string[] = ['local protocol', protocol.name, 'at', protocol.role];

  // Add parameters if any
  if (protocol.parameters && protocol.parameters.length > 0) {
    const params = protocol.parameters.map(serializeParameter).join(', ');
    parts.push(`(${params})`);
  } else {
    parts.push('()');
  }

  return parts.join(' ');
}

/**
 * Serialize a protocol parameter
 */
function serializeParameter(param: ProtocolParameter): string {
  return `${param.kind} ${param.name}`;
}

/**
 * Serialize protocol body (sequence of interactions)
 */
function serializeBody(
  body: LocalInteraction[],
  indentLevel: number,
  opts: Required<SerializerOptions>
): string {
  const lines: string[] = [];

  for (const interaction of body) {
    const serialized = serializeInteraction(interaction, indentLevel, opts);
    if (serialized) {
      lines.push(serialized);
    }
  }

  return lines.join(opts.lineEnding);
}

/**
 * Serialize a single local interaction
 */
function serializeInteraction(
  interaction: LocalInteraction,
  indentLevel: number,
  opts: Required<SerializerOptions>
): string {
  const indent = opts.indent.repeat(indentLevel);

  switch (interaction.type) {
    case 'Send':
      return serializeSend(interaction, indent);

    case 'Receive':
      return serializeReceive(interaction, indent);

    case 'LocalChoice':
      return serializeLocalChoice(interaction, indentLevel, opts);

    case 'LocalParallel':
      return serializeLocalParallel(interaction, indentLevel, opts);

    case 'Recursion':
      return serializeRecursion(interaction, indentLevel, opts);

    case 'Continue':
      return serializeContinue(interaction, indent);

    case 'Do':
      return serializeDo(interaction, indent);

    default:
      throw new Error(`Unknown interaction type: ${(interaction as any).type}`);
  }
}

// ============================================================================
// Interaction Serializers
// ============================================================================

/**
 * Serialize Send action
 *
 * Format: message(payload) to Role;
 */
function serializeSend(send: Send, indent: string): string {
  const message = serializeMessage(send.message);
  return `${indent}${message} to ${send.to};`;
}

/**
 * Serialize Receive action
 *
 * Format: message(payload) from Role;
 */
function serializeReceive(receive: Receive, indent: string): string {
  const message = serializeMessage(receive.message);
  return `${indent}${message} from ${receive.from};`;
}

/**
 * Serialize message signature
 *
 * Formats:
 * - label(Type)              - with payload
 * - label()                  - no payload
 * - label(field:Type)        - with field annotation
 */
function serializeMessage(message: Message): string {
  const { label, payload } = message;

  if (!payload) {
    return `${label}()`;
  }

  const payloadStr = serializePayload(payload);
  return `${label}(${payloadStr})`;
}

/**
 * Serialize payload
 */
function serializePayload(payload: Payload): string {
  return serializeType(payload.payloadType);
}

/**
 * Serialize type
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

/**
 * Serialize Local Choice
 *
 * Format (select - internal choice):
 *   choice at Role {
 *     label1: { ... }
 *   } or {
 *     label2: { ... }
 *   }
 *
 * Format (offer - external choice):
 *   choice at Role {
 *     label1: { ... }
 *   } or {
 *     label2: { ... }
 *   }
 */
function serializeLocalChoice(
  choice: LocalChoice,
  indentLevel: number,
  opts: Required<SerializerOptions>
): string {
  const indent = opts.indent.repeat(indentLevel);
  const innerIndent = opts.indent.repeat(indentLevel + 1);
  const lines: string[] = [];

  // Choice header
  if (choice.kind === 'select') {
    lines.push(`${indent}choice at ${choice.at || 'self'} {`);
  } else {
    // offer - external choice
    lines.push(`${indent}choice at ${choice.at || 'unknown'} {`);
  }

  // Branches
  for (let i = 0; i < choice.branches.length; i++) {
    const branch = choice.branches[i];

    if (i > 0) {
      lines.push(`${indent}} or {`);
    }

    // Branch label (as comment or part of first interaction)
    if (branch.label) {
      lines.push(`${innerIndent}// Branch: ${branch.label}`);
    }

    // Branch body
    const body = serializeBody(branch.body, indentLevel + 1, opts);
    if (body) {
      lines.push(body);
    }
  }

  lines.push(`${indent}}`);

  return lines.join(opts.lineEnding);
}

/**
 * Serialize Local Parallel
 *
 * Format:
 *   parallel {
 *     ...
 *   } and {
 *     ...
 *   }
 */
function serializeLocalParallel(
  parallel: LocalParallel,
  indentLevel: number,
  opts: Required<SerializerOptions>
): string {
  const indent = opts.indent.repeat(indentLevel);
  const lines: string[] = [];

  lines.push(`${indent}parallel {`);

  for (let i = 0; i < parallel.branches.length; i++) {
    const branch = parallel.branches[i];

    if (i > 0) {
      lines.push(`${indent}} and {`);
    }

    const body = serializeBody(branch.body, indentLevel + 1, opts);
    if (body) {
      lines.push(body);
    }
  }

  lines.push(`${indent}}`);

  return lines.join(opts.lineEnding);
}

/**
 * Serialize Recursion
 *
 * Format:
 *   rec Label {
 *     ...
 *     continue Label;
 *   }
 */
function serializeRecursion(
  recursion: Recursion,
  indentLevel: number,
  opts: Required<SerializerOptions>
): string {
  const indent = opts.indent.repeat(indentLevel);
  const lines: string[] = [];

  lines.push(`${indent}rec ${recursion.label} {`);

  const body = serializeBody(
    recursion.body as LocalInteraction[],
    indentLevel + 1,
    opts
  );
  if (body) {
    lines.push(body);
  }

  lines.push(`${indent}}`);

  return lines.join(opts.lineEnding);
}

/**
 * Serialize Continue
 *
 * Format: continue Label;
 */
function serializeContinue(cont: Continue, indent: string): string {
  return `${indent}continue ${cont.label};`;
}

/**
 * Serialize Do (sub-protocol invocation)
 *
 * Format: do Protocol(args) at Roles;
 */
function serializeDo(doStmt: Do, indent: string): string {
  const args = doStmt.roleArguments.join(', ');
  return `${indent}do ${doStmt.protocol}(${args});`;
}

// ============================================================================
// Pretty Printing Utilities
// ============================================================================

/**
 * Format a local protocol for pretty printing
 *
 * Adds extra blank lines between major sections
 */
export function prettyPrint(
  protocol: LocalProtocolDeclaration,
  options: SerializerOptions = {}
): string {
  const basic = serializeLocalProtocol(protocol, options);

  // Add extra formatting (blank lines between major interactions)
  // This is optional, can be enhanced
  return basic;
}

/**
 * Serialize multiple local protocols
 *
 * @param protocols - Map of role to local protocol
 * @param options - Serialization options
 * @returns Map of role to serialized text
 */
export function serializeAll(
  protocols: Map<string, LocalProtocolDeclaration>,
  options: SerializerOptions = {}
): Map<string, string> {
  const serialized = new Map<string, string>();

  for (const [role, protocol] of protocols) {
    serialized.set(role, serializeLocalProtocol(protocol, options));
  }

  return serialized;
}
