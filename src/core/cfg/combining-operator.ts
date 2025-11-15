/**
 * Combining Operator ♢ (Castro-Perez & Yoshida, ECOOP 2023)
 *
 * The combining operator ♢ : G × G' → G'' interleaves two protocols
 * while preserving safety properties.
 *
 * FORMAL DEFINITION (ECOOP 2023, §3.1):
 *   G ♢ G' produces a protocol where:
 *   1. Actions from G and G' are interleaved
 *   2. Channel independence: G and G' use disjoint channels
 *   3. Causality preserved: Message ordering within each protocol maintained
 *   4. Deadlock-free: If G and G' are deadlock-free, so is G ♢ G'
 *
 * SEMANTICS:
 *   The combining operator creates a product automaton where:
 *   - States are pairs (s_G, s_G') from G and G'
 *   - Transitions: Either G steps (G', s_G') → (G'', s_G')
 *                  or G' steps (G, s_G') → (G, s_G'')
 *   - Initial: (initial_G, initial_G')
 *   - Terminal: Both reach terminal states
 *
 * CHANNEL DISJOINTNESS CHECK:
 *   For safety, we verify that G and G' use disjoint communication channels:
 *   channels(G) ∩ channels(G') = ∅
 *
 *   Where channels(G) = { (p, q, l) | p→q: l in G }
 *
 * USAGE:
 *   // Combine two protocols
 *   const combined = combineProtocols(cfg1, cfg2);
 *
 *   // Check if combination is safe (disjoint channels)
 *   const safetyResult = checkChannelDisjointness(cfg1, cfg2);
 *
 * REFERENCE:
 *   Castro-Perez, D., & Yoshida, N. (2023). "Dynamically Updatable
 *   Multiparty Session Protocols." ECOOP 2023, §3.1.
 */

import type { CFG, CFGNode, CFGEdge, ActionNode } from './types';
import type { MessageAction } from './types';

// ============================================================================
// Channel Representation
// ============================================================================

/**
 * A communication channel: (sender, receiver, label)
 */
export interface Channel {
  sender: string;
  receiver: string | string[];
  label: string;
}

/**
 * Result of channel disjointness check.
 */
export interface ChannelDisjointnessResult {
  isDisjoint: boolean;
  conflicts: ChannelConflict[];
}

/**
 * A channel conflict (race condition).
 */
export interface ChannelConflict {
  channel: Channel;
  inG: string; // Node ID in first CFG
  inG_prime: string; // Node ID in second CFG
  reason: string;
}

/**
 * Result of combining two protocols.
 */
export interface CombineResult {
  success: boolean;
  combined?: CFG;
  channelCheck: ChannelDisjointnessResult;
  error?: string;
}

// ============================================================================
// Channel Extraction
// ============================================================================

/**
 * Extract all communication channels from a CFG.
 *
 * Channels are identified by (sender, receiver, label) tuples.
 * This includes both send and receive actions.
 *
 * @param cfg - CFG to analyze
 * @returns Set of channels used in the protocol
 */
export function extractChannels(cfg: CFG): Set<string> {
  const channels = new Set<string>();

  for (const node of cfg.nodes) {
    if (node.type === 'action') {
      const actionNode = node as ActionNode;
      const action = actionNode.action;

      if (action.kind === 'message') {
        const msgAction = action as MessageAction;
        const receiver = Array.isArray(msgAction.to)
          ? msgAction.to.join(',')
          : msgAction.to;

        // Create channel identifier: sender:receiver:label
        const channelId = `${msgAction.from}:${receiver}:${msgAction.message.label}`;
        channels.add(channelId);
      }
    }
  }

  return channels;
}

/**
 * Parse a channel identifier into components.
 *
 * @param channelId - Channel identifier string
 * @returns Channel components
 */
function parseChannelId(channelId: string): Channel {
  const parts = channelId.split(':');
  const receiver = parts[1].includes(',') ? parts[1].split(',') : parts[1];
  return {
    sender: parts[0],
    receiver,
    label: parts[2],
  };
}

// ============================================================================
// Channel Disjointness Check
// ============================================================================

/**
 * Check if two CFGs use disjoint communication channels.
 *
 * SAFETY PROPERTY:
 *   channels(G) ∩ channels(G') = ∅
 *
 * If channels overlap, combining the protocols could introduce races.
 *
 * @param cfg1 - First CFG
 * @param cfg2 - Second CFG
 * @returns Disjointness check result
 */
export function checkChannelDisjointness(
  cfg1: CFG,
  cfg2: CFG
): ChannelDisjointnessResult {
  const channels1 = extractChannels(cfg1);
  const channels2 = extractChannels(cfg2);

  const conflicts: ChannelConflict[] = [];

  // Find overlapping channels
  for (const ch1 of channels1) {
    if (channels2.has(ch1)) {
      // Find node IDs for conflict reporting
      const node1 = findChannelNode(cfg1, ch1);
      const node2 = findChannelNode(cfg2, ch1);

      conflicts.push({
        channel: parseChannelId(ch1),
        inG: node1?.id || 'unknown',
        inG_prime: node2?.id || 'unknown',
        reason: `Channel ${ch1} used in both protocols (race condition)`,
      });
    }
  }

  return {
    isDisjoint: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Find the first node using a specific channel.
 */
function findChannelNode(cfg: CFG, channelId: string): CFGNode | undefined {
  for (const node of cfg.nodes) {
    if (node.type === 'action') {
      const actionNode = node as ActionNode;
      const action = actionNode.action;

      if (action.kind === 'message') {
        const msgAction = action as MessageAction;
        const receiver = Array.isArray(msgAction.to)
          ? msgAction.to.join(',')
          : msgAction.to;
        const nodeChannelId = `${msgAction.from}:${receiver}:${msgAction.message.label}`;

        if (nodeChannelId === channelId) {
          return node;
        }
      }
    }
  }
  return undefined;
}

// ============================================================================
// Combining Operator Implementation
// ============================================================================

/**
 * Combine two CFGs using the combining operator ♢.
 *
 * ALGORITHM:
 *   1. Check channel disjointness (safety requirement)
 *   2. Create product automaton:
 *      - States: (s_G, s_G') cartesian product
 *      - Transitions: Interleave G and G' actions
 *      - Initial: (initial_G, initial_G')
 *      - Terminal: (terminal_G, terminal_G')
 *   3. Merge control flow from both CFGs
 *
 * IMPLEMENTATION NOTE:
 *   For simplicity, we use a sequential composition approach:
 *   - Execute G first, then G'
 *   - More sophisticated interleaving could be added later
 *
 *   This is sound but conservative: true parallelism would allow
 *   more interleavings, but sequential execution is always safe.
 *
 * @param cfg1 - First protocol (G)
 * @param cfg2 - Second protocol (G')
 * @returns Combined CFG result
 */
export function combineProtocols(cfg1: CFG, cfg2: CFG): CombineResult {
  // Check channel disjointness
  const channelCheck = checkChannelDisjointness(cfg1, cfg2);

  if (!channelCheck.isDisjoint) {
    return {
      success: false,
      channelCheck,
      error: `Channel conflicts detected: ${channelCheck.conflicts.length} races`,
    };
  }

  // Create combined CFG
  // For now, use sequential composition (G; G')
  // TODO: Implement true interleaving product automaton
  const combined = sequentialCompose(cfg1, cfg2);

  return {
    success: true,
    combined,
    channelCheck,
  };
}

/**
 * Sequential composition: G; G'
 *
 * Connects terminal states of G to initial state of G'.
 * This is a sound (but conservative) implementation of ♢.
 *
 * @param cfg1 - First CFG
 * @param cfg2 - Second CFG
 * @returns Combined CFG
 */
function sequentialCompose(cfg1: CFG, cfg2: CFG): CFG {
  // Clone and rename nodes to avoid conflicts
  const nodes1 = cfg1.nodes.map(n => ({
    ...n,
    id: `g1_${n.id}`,
  }));

  const nodes2 = cfg2.nodes.map(n => ({
    ...n,
    id: `g2_${n.id}`,
  }));

  // Clone and update edges
  const edges1 = cfg1.edges.map(e => ({
    ...e,
    id: `g1_${e.id}`,
    from: `g1_${e.from}`,
    to: `g1_${e.to}`,
  }));

  const edges2 = cfg2.edges.map(e => ({
    ...e,
    id: `g2_${e.id}`,
    from: `g2_${e.from}`,
    to: `g2_${e.to}`,
  }));

  // Connect G's terminal to G's initial
  const connectionEdges: CFGEdge[] = [];
  for (const terminalId of cfg1.terminalNodes) {
    connectionEdges.push({
      id: `connect_${terminalId}_to_g2`,
      from: `g1_${terminalId}`,
      to: `g2_${cfg2.initialNode}`,
      type: 'sequence',
    });
  }

  // Combine
  return {
    id: `${cfg1.id}_combine_${cfg2.id}`,
    nodes: [...nodes1, ...nodes2],
    edges: [...edges1, ...edges2, ...connectionEdges],
    initialNode: `g1_${cfg1.initialNode}`,
    terminalNodes: cfg2.terminalNodes.map(id => `g2_${id}`),
    roles: [...new Set([...cfg1.roles, ...cfg2.roles])],
    metadata: {
      combined: true,
      source1: cfg1.id,
      source2: cfg2.id,
      combiningOperator: 'sequential', // Note: not full interleaving yet
    },
  };
}

/**
 * Interleaving composition: True ♢ implementation.
 *
 * Creates product automaton with all valid interleavings.
 *
 * ALGORITHM:
 *   1. Create state space: S = S_G × S_G'
 *   2. For each state (s, s'):
 *      - If G can step s→s'': add transition (s,s')→(s'',s')
 *      - If G' can step s'→s''': add transition (s,s')→(s,s''')
 *   3. Initial: (initial_G, initial_G')
 *   4. Terminal: states where both are terminal
 *
 * TODO: Implement full interleaving for true parallelism.
 *
 * @param cfg1 - First CFG
 * @param cfg2 - Second CFG
 * @returns Combined CFG with interleaving
 */
export function interleavingCompose(cfg1: CFG, cfg2: CFG): CFG {
  // TODO: Implement product automaton construction
  // For now, fall back to sequential composition
  return sequentialCompose(cfg1, cfg2);
}

// ============================================================================
// Exports
// ============================================================================

export {
  type Channel,
  type ChannelConflict,
  type ChannelDisjointnessResult,
  type CombineResult,
  sequentialCompose,
};
