/**
 * WebCola Simulation Store
 *
 * Dedicated state management for the WebCola-based CFSM visualization.
 * Manages graph nodes (roles), links (buffers), message animations,
 * and simulation execution state.
 */

import { writable, derived, get } from 'svelte/store';
import type { CFSM, CFSMTransition, CFSMAction } from '../../core/projection/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Queued message in a buffer
 */
export interface QueuedMessage {
  id: string;
  label: string;
  payloadType?: string;
  timestamp: number;
  from: string;
  to: string;
}

/**
 * Message currently being animated
 */
export interface AnimatingMessage extends QueuedMessage {
  progress: number;  // 0-1 animation progress
  action: 'sending' | 'receiving';
}

/**
 * Role state for visualization
 */
export interface RoleState {
  currentState: string;
  previousState: string | null;
  lastActionType: 'send' | 'receive' | 'tau' | 'choice' | 'idle';
  isActive: boolean;  // Currently executing
}

/**
 * Graph node for WebCola layout
 */
export interface GraphNode {
  id: string;  // Role name
  role: string;
  cfsm: CFSM;
  state: RoleState;
  // WebCola layout properties
  x?: number;
  y?: number;
  width: number;
  height: number;
  fixed?: boolean;
}

/**
 * Graph link for WebCola layout
 */
export interface GraphLink {
  id: string;  // "A->B"
  source: number | GraphNode;  // Source node index or ref
  target: number | GraphNode;  // Target node index or ref
  messages: QueuedMessage[];
}

/**
 * Simulation event for the log
 */
export interface SimEvent {
  id: string;
  timestamp: number;
  type: 'send' | 'receive' | 'state-change' | 'choice';
  role: string;
  details: string;
  messageLabel?: string;
  fromState?: string;
  toState?: string;
}

/**
 * Main simulation state
 */
export interface WebColaSimState {
  // Protocol data
  protocolName: string;
  protocolSource: string;

  // Graph structure
  nodes: GraphNode[];
  links: GraphLink[];

  // Execution state
  stepCount: number;
  isPlaying: boolean;
  speed: number;  // ms per step
  isComplete: boolean;
  isDeadlocked: boolean;

  // Animation
  animatingMessages: AnimatingMessage[];

  // Event log
  events: SimEvent[];

  // Error state
  error: string | null;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: WebColaSimState = {
  protocolName: '',
  protocolSource: '',
  nodes: [],
  links: [],
  stepCount: 0,
  isPlaying: false,
  speed: 500,
  isComplete: false,
  isDeadlocked: false,
  animatingMessages: [],
  events: [],
  error: null,
};

// ============================================================================
// Store Creation
// ============================================================================

function createWebColaSimStore() {
  const { subscribe, set, update } = writable<WebColaSimState>(initialState);

  // Internal state for simulation
  let simulationInterval: ReturnType<typeof setInterval> | null = null;
  let messageIdCounter = 0;
  let eventIdCounter = 0;

  /**
   * Generate unique message ID
   */
  function nextMessageId(): string {
    return `msg-${++messageIdCounter}`;
  }

  /**
   * Generate unique event ID
   */
  function nextEventId(): string {
    return `evt-${++eventIdCounter}`;
  }

  /**
   * Get action type color
   */
  function getActionColor(actionType: CFSMAction['type']): string {
    switch (actionType) {
      case 'send': return '#4FC3F7';     // Blue
      case 'receive': return '#81C784';  // Green
      case 'tau': return '#9E9E9E';      // Gray
      case 'choice': return '#FFD54F';   // Yellow
      default: return '#BDBDBD';
    }
  }

  /**
   * Initialize simulation from CFSMs
   */
  function initialize(
    cfsms: Map<string, CFSM>,
    protocolName: string,
    protocolSource: string
  ) {
    messageIdCounter = 0;
    eventIdCounter = 0;

    const roles = Array.from(cfsms.keys());

    // Create nodes for each role
    const nodes: GraphNode[] = roles.map((role) => {
      const cfsm = cfsms.get(role)!;
      return {
        id: role,
        role,
        cfsm,
        state: {
          currentState: cfsm.initialState,
          previousState: null,
          lastActionType: 'idle',
          isActive: false,
        },
        width: 80,
        height: 80,
      };
    });

    // Create links for all possible role pairs (bidirectional buffers)
    const links: GraphLink[] = [];
    for (let i = 0; i < roles.length; i++) {
      for (let j = 0; j < roles.length; j++) {
        if (i !== j) {
          // Check if there's any communication from roles[i] to roles[j]
          const sourceCfsm = cfsms.get(roles[i])!;
          const hasComm = sourceCfsm.transitions.some(t => {
            if (t.action.type === 'send') {
              const to = Array.isArray(t.action.to) ? t.action.to : [t.action.to];
              return to.includes(roles[j]);
            }
            return false;
          });

          if (hasComm) {
            links.push({
              id: `${roles[i]}->${roles[j]}`,
              source: i,
              target: j,
              messages: [],
            });
          }
        }
      }
    }

    set({
      protocolName,
      protocolSource,
      nodes,
      links,
      stepCount: 0,
      isPlaying: false,
      speed: 500,
      isComplete: false,
      isDeadlocked: false,
      animatingMessages: [],
      events: [],
      error: null,
    });
  }

  /**
   * Get enabled transitions for a role
   */
  function getEnabledTransitions(state: WebColaSimState, roleIndex: number): CFSMTransition[] {
    const node = state.nodes[roleIndex];
    if (!node) return [];

    const currentStateId = node.state.currentState;
    const cfsm = node.cfsm;

    // Get outgoing transitions from current state
    const outgoing = cfsm.transitions.filter(t => t.from === currentStateId);

    // Filter to enabled transitions
    return outgoing.filter(t => {
      const action = t.action;

      switch (action.type) {
        case 'send':
          // Send is always enabled if we're in the right state
          return true;

        case 'receive': {
          // Receive is enabled if there's a message in the buffer from the sender
          const bufferId = `${action.from}->${node.role}`;
          const buffer = state.links.find(l => l.id === bufferId);
          if (!buffer) return false;

          // Check for matching message
          return buffer.messages.some(m => m.label === action.message.label);
        }

        case 'tau':
        case 'choice':
          // Always enabled
          return true;

        case 'subprotocol':
          // TODO: Handle sub-protocols
          return false;

        default:
          return false;
      }
    });
  }

  /**
   * Execute a single transition for a role
   */
  function executeTransition(roleIndex: number, transitionId: string) {
    update(state => {
      const node = state.nodes[roleIndex];
      if (!node) return state;

      const transition = node.cfsm.transitions.find(t => t.id === transitionId);
      if (!transition) return state;

      const action = transition.action;
      const newState = { ...state };
      newState.nodes = [...state.nodes];
      newState.links = [...state.links];
      newState.events = [...state.events];
      newState.animatingMessages = [...state.animatingMessages];

      // Update the node
      const updatedNode: GraphNode = {
        ...node,
        state: {
          currentState: transition.to,
          previousState: node.state.currentState,
          lastActionType: action.type as RoleState['lastActionType'],
          isActive: true,
        },
      };
      newState.nodes[roleIndex] = updatedNode;

      // Handle action-specific effects
      switch (action.type) {
        case 'send': {
          const recipients = Array.isArray(action.to) ? action.to : [action.to];
          for (const recipient of recipients) {
            const bufferId = `${node.role}->${recipient}`;
            const bufferIndex = newState.links.findIndex(l => l.id === bufferId);

            if (bufferIndex >= 0) {
              const message: QueuedMessage = {
                id: nextMessageId(),
                label: action.message.label,
                payloadType: action.message.payload?.payloadType?.toString(),
                timestamp: Date.now(),
                from: node.role,
                to: recipient,
              };

              // Add to buffer
              newState.links[bufferIndex] = {
                ...newState.links[bufferIndex],
                messages: [...newState.links[bufferIndex].messages, message],
              };

              // Add animation
              newState.animatingMessages.push({
                ...message,
                progress: 0,
                action: 'sending',
              });

              // Log event
              newState.events.push({
                id: nextEventId(),
                timestamp: Date.now(),
                type: 'send',
                role: node.role,
                details: `${node.role} -> ${recipient}: ${action.message.label}`,
                messageLabel: action.message.label,
                fromState: transition.from,
                toState: transition.to,
              });
            }
          }
          break;
        }

        case 'receive': {
          const bufferId = `${action.from}->${node.role}`;
          const bufferIndex = newState.links.findIndex(l => l.id === bufferId);

          if (bufferIndex >= 0) {
            const buffer = newState.links[bufferIndex];
            const msgIndex = buffer.messages.findIndex(m => m.label === action.message.label);

            if (msgIndex >= 0) {
              const message = buffer.messages[msgIndex];

              // Remove from buffer
              const newMessages = [...buffer.messages];
              newMessages.splice(msgIndex, 1);
              newState.links[bufferIndex] = {
                ...buffer,
                messages: newMessages,
              };

              // Add animation
              newState.animatingMessages.push({
                ...message,
                progress: 0,
                action: 'receiving',
              });

              // Log event
              newState.events.push({
                id: nextEventId(),
                timestamp: Date.now(),
                type: 'receive',
                role: node.role,
                details: `${node.role} <- ${action.from}: ${action.message.label}`,
                messageLabel: action.message.label,
                fromState: transition.from,
                toState: transition.to,
              });
            }
          }
          break;
        }

        case 'tau':
        case 'choice': {
          newState.events.push({
            id: nextEventId(),
            timestamp: Date.now(),
            type: action.type === 'choice' ? 'choice' : 'state-change',
            role: node.role,
            details: action.type === 'choice'
              ? `${node.role} chose branch: ${action.branch}`
              : `${node.role}: tau transition`,
            fromState: transition.from,
            toState: transition.to,
          });
          break;
        }
      }

      newState.stepCount++;

      // Check for completion
      const allTerminal = newState.nodes.every(n =>
        n.cfsm.terminalStates.includes(n.state.currentState)
      );
      if (allTerminal) {
        newState.isComplete = true;
        newState.isPlaying = false;
      }

      return newState;
    });
  }

  /**
   * Execute one step of the simulation (auto-select transition)
   */
  function step() {
    const state = get({ subscribe });

    if (state.isComplete || state.isDeadlocked) {
      return false;
    }

    // Find first role with enabled transitions (round-robin would be better)
    for (let i = 0; i < state.nodes.length; i++) {
      const enabled = getEnabledTransitions(state, i);
      if (enabled.length > 0) {
        // Pick first enabled transition (could be random or manual)
        executeTransition(i, enabled[0].id);
        return true;
      }
    }

    // No enabled transitions - check for deadlock
    const allTerminal = state.nodes.every(n =>
      n.cfsm.terminalStates.includes(n.state.currentState)
    );

    if (!allTerminal) {
      update(s => ({ ...s, isDeadlocked: true, isPlaying: false }));
    }

    return false;
  }

  /**
   * Start auto-play
   */
  function play() {
    update(s => ({ ...s, isPlaying: true }));

    const state = get({ subscribe });
    simulationInterval = setInterval(() => {
      const currentState = get({ subscribe });
      if (!currentState.isPlaying || currentState.isComplete || currentState.isDeadlocked) {
        pause();
        return;
      }
      step();
    }, state.speed);
  }

  /**
   * Pause auto-play
   */
  function pause() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    update(s => ({ ...s, isPlaying: false }));
  }

  /**
   * Toggle play/pause
   */
  function togglePlay() {
    const state = get({ subscribe });
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  /**
   * Reset to initial state
   */
  function reset() {
    pause();

    update(state => {
      const newNodes = state.nodes.map(node => ({
        ...node,
        state: {
          currentState: node.cfsm.initialState,
          previousState: null,
          lastActionType: 'idle' as const,
          isActive: false,
        },
      }));

      const newLinks = state.links.map(link => ({
        ...link,
        messages: [],
      }));

      return {
        ...state,
        nodes: newNodes,
        links: newLinks,
        stepCount: 0,
        isComplete: false,
        isDeadlocked: false,
        animatingMessages: [],
        events: [],
        error: null,
      };
    });
  }

  /**
   * Set simulation speed
   */
  function setSpeed(speed: number) {
    update(s => ({ ...s, speed }));

    // Restart interval with new speed if playing
    const state = get({ subscribe });
    if (state.isPlaying) {
      pause();
      play();
    }
  }

  /**
   * Clear animation (called after animation completes)
   */
  function clearAnimation(messageId: string) {
    update(state => ({
      ...state,
      animatingMessages: state.animatingMessages.filter(m => m.id !== messageId),
    }));
  }

  /**
   * Update animation progress
   */
  function updateAnimationProgress(messageId: string, progress: number) {
    update(state => ({
      ...state,
      animatingMessages: state.animatingMessages.map(m =>
        m.id === messageId ? { ...m, progress } : m
      ),
    }));
  }

  return {
    subscribe,

    // Initialization
    initialize,

    // Simulation control
    step,
    play,
    pause,
    togglePlay,
    reset,
    setSpeed,

    // Animation
    clearAnimation,
    updateAnimationProgress,

    // Helpers
    getEnabledTransitions: (roleIndex: number) => {
      const state = get({ subscribe });
      return getEnabledTransitions(state, roleIndex);
    },
    getActionColor,

    // Direct state access
    getState: () => get({ subscribe }),
  };
}

// ============================================================================
// Export
// ============================================================================

export const webcolaSimStore = createWebColaSimStore();

// Derived stores for specific state slices
export const isPlaying = derived(webcolaSimStore, $s => $s.isPlaying);
export const stepCount = derived(webcolaSimStore, $s => $s.stepCount);
export const isComplete = derived(webcolaSimStore, $s => $s.isComplete);
export const isDeadlocked = derived(webcolaSimStore, $s => $s.isDeadlocked);
export const simEvents = derived(webcolaSimStore, $s => $s.events);
export const animatingMessages = derived(webcolaSimStore, $s => $s.animatingMessages);
