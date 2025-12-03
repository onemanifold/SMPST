/**
 * CFSM Executor - Pure Execution Engine
 *
 * Executes a single role's CFSM autonomously without debugging features.
 * Designed for concurrent distributed execution where roles run in parallel.
 *
 * Key Principles:
 * - No history/snapshots (debugging features belong in CFSMDebugger)
 * - Autonomous execution via async run() method
 * - Event-driven coordination (emits 'ready', 'blocked', 'complete')
 * - Natural blocking on receive() in concurrent mode
 * - Supports sub-protocol call stack
 *
 * Architecture:
 * - CFSMExecutor: pure execution (this class)
 * - CFSMDebugger: wraps executor, adds time-travel
 * - CFSMSimulator: compatibility wrapper for existing code
 */

import type { CFSM, CFSMTransition, CFSMAction } from '../projection/types';
import type { Message, CFSMExecutorConfig, CallStackFrame } from './cfsm-simulator-types';
import type { ChannelEnd } from './channel';

type EventCallback = (...args: any[]) => void;

/**
 * Backward compatibility helpers
 */
function getActionLabel(action: any): string {
  if (action.message?.label) return action.message.label;
  if (action.label) return action.label;
  throw new Error('Action missing label');
}

function getActionPayloadType(action: any): string | undefined {
  if (action.message?.payload?.payloadType?.name) {
    return action.message.payload.payloadType.name;
  }
  return action.payloadType;
}

/**
 * Pure CFSM execution engine
 */
export class CFSMExecutor {
  private rootCFSM: CFSM;
  private currentCFSM: CFSM;
  private currentState: string;
  private completed: boolean = false;
  private stepCount: number = 0;

  // Channels for distributed execution
  private channels?: Map<string, ChannelEnd>;

  // Sub-protocol support
  private callStack: CallStackFrame[] = [];
  private cfsmRegistry: Map<string, Map<string, CFSM>>;

  // Configuration
  private maxSteps: number;

  // Event emitter
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // Message ID counter
  private messageIdCounter: number = 0;

  constructor(cfsm: CFSM, config: CFSMExecutorConfig = {}) {
    this.rootCFSM = cfsm;
    this.currentCFSM = cfsm;
    this.currentState = cfsm.initialState;
    this.channels = config.channels;
    this.cfsmRegistry = config.cfsmRegistry || new Map();
    this.maxSteps = config.maxSteps ?? 1000;
  }

  /**
   * Event emitter pattern for coordination
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  /**
   * Get current state (for debugging/inspection)
   */
  getState() {
    return {
      role: this.rootCFSM.role,
      currentState: this.currentState,
      completed: this.completed,
      stepCount: this.stepCount,
      callStackDepth: this.callStack.length,
    };
  }

  /**
   * Check if execution is complete
   */
  isComplete(): boolean {
    return this.completed;
  }

  /**
   * Get enabled transitions from current state
   *
   * Returns transitions that can be executed from the current state.
   * For sequential stepping, this checks message availability to avoid blocking.
   *
   * Note: With BisimulationCoordinator, this method's hasMessage() check is
   * less relevant because the coordinator uses event-driven coordination
   * via onIncoming handlers. The hasMessage() check remains for backward
   * compatibility with DistributedSimulator's sequential stepping pattern.
   */
  getEnabledTransitions(): CFSMTransition[] {
    const transitions = this.currentCFSM.transitions.filter(t => t.from === this.currentState);

    // In channel mode, filter by message availability for receive transitions
    // This is necessary for sequential stepping to avoid blocking
    if (this.channels) {
      return transitions.filter(t => {
        if (t.action.type === 'receive') {
          const channel = this.channels!.get(t.action.from);
          if (!channel) return false;
          return channel.hasMessage();
        }
        return true;
      });
    }

    return transitions;
  }

  /**
   * Autonomous execution - runs until completion or blocked
   * For concurrent distributed execution
   */
  async run(): Promise<void> {
    while (!this.completed && this.stepCount < this.maxSteps) {
      const transitions = this.currentCFSM.transitions.filter(t => t.from === this.currentState);

      if (transitions.length === 0) {
        // Check if terminal
        if (this.currentCFSM.terminalStates.includes(this.currentState)) {
          await this.handleTerminal();
          continue;
        }

        // No transitions and not terminal = error
        this.emit('error', { type: 'no-transition', state: this.currentState });
        return;
      }

      // Select transition (first for now)
      const transition = transitions[0];

      // Execute transition
      // Note: 'ready' events are emitted by debugger's mediated channels
      // when messages arrive, not here. This avoids premature 'ready'
      // emission for receive transitions that might block.
      await this.executeTransition(transition);

      this.stepCount++;
    }

    if (this.stepCount >= this.maxSteps) {
      this.emit('max-steps-reached');
    }
  }

  /**
   * Execute a single transition (for sequential stepping mode)
   */
  async step(): Promise<void> {
    if (this.completed) {
      throw new Error('Already completed');
    }

    const transitions = this.getEnabledTransitions();
    if (transitions.length === 0) {
      // Check if terminal
      if (this.currentCFSM.terminalStates.includes(this.currentState)) {
        await this.handleTerminal();
        return;
      }
      throw new Error('No enabled transitions');
    }

    await this.executeTransition(transitions[0]);
    this.stepCount++;

    // Check if reached terminal state after execution
    if (this.currentCFSM.terminalStates.includes(this.currentState)) {
      await this.handleTerminal();
    }
  }

  /**
   * Execute a single transition
   */
  private async executeTransition(transition: CFSMTransition): Promise<void> {
    const action = transition.action;

    switch (action.type) {
      case 'send':
        await this.executeSend(transition);
        break;
      case 'receive':
        await this.executeReceive(transition);
        break;
      case 'tau':
        this.executeTau(transition);
        break;
      case 'choice':
        this.executeChoice(transition);
        break;
      case 'subprotocol':
        await this.executeSubProtocol(transition);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  /**
   * Execute send action
   */
  private async executeSend(transition: CFSMTransition): Promise<void> {
    const action = transition.action;
    if (action.type !== 'send') throw new Error('Expected send action');

    const recipients = Array.isArray(action.to) ? action.to : [action.to];
    const messages: Message[] = recipients.map(to => ({
      id: `${this.rootCFSM.role}-msg-${this.messageIdCounter++}`,
      from: this.rootCFSM.role,
      to,
      label: getActionLabel(action),
      payloadType: getActionPayloadType(action),
      timestamp: Date.now(),
    }));

    if (this.channels) {
      // Send via channels (async, non-blocking per MPST)
      for (const msg of messages) {
        const channel = this.channels.get(msg.to);
        if (!channel) {
          throw new Error(`No channel to ${msg.to} from ${this.rootCFSM.role}`);
        }
        await channel.send(msg);
      }
    }

    // Emit send event
    for (const msg of messages) {
      this.emit('send', {
        messageId: msg.id,
        to: msg.to,
        label: msg.label,
        payloadType: msg.payloadType,
      });
    }

    // Transition to next state
    this.currentState = transition.to;
  }

  /**
   * Execute receive action
   * In concurrent mode: naturally blocks until message available
   */
  private async executeReceive(transition: CFSMTransition): Promise<void> {
    const action = transition.action;
    if (action.type !== 'receive') throw new Error('Expected receive action');

    if (!this.channels) {
      throw new Error('Receive requires channels');
    }

    const channel = this.channels.get(action.from);
    if (!channel) {
      throw new Error(`No channel from ${action.from} to ${this.rootCFSM.role}`);
    }

    // Await receive - blocks until message arrives (concurrent mode)
    const msg = await channel.receive();

    // Verify message label matches
    const expectedLabel = getActionLabel(action);
    if (msg.label !== expectedLabel) {
      throw new Error(
        `Protocol violation: expected ${expectedLabel} from ${action.from}, got ${msg.label}`
      );
    }

    // Emit receive event
    this.emit('receive', {
      messageId: msg.id,
      from: msg.from,
      label: msg.label,
      payloadType: msg.payloadType,
    });

    // Transition to next state
    this.currentState = transition.to;
  }

  /**
   * Execute tau (internal) action
   */
  private executeTau(transition: CFSMTransition): void {
    this.currentState = transition.to;
    this.emit('tau', { from: transition.from, to: transition.to });
  }

  /**
   * Execute choice action
   */
  private executeChoice(transition: CFSMTransition): void {
    const action = transition.action;
    if (action.type !== 'choice') throw new Error('Expected choice action');

    this.currentState = transition.to;
    this.emit('choice', { branch: action.branch });
  }

  /**
   * Execute sub-protocol call
   */
  private async executeSubProtocol(transition: CFSMTransition): Promise<void> {
    const action = transition.action;
    if (action.type !== 'subprotocol') throw new Error('Expected subprotocol action');

    // Look up sub-protocol CFSM
    const protocolCFSMs = this.cfsmRegistry.get(action.protocol);
    if (!protocolCFSMs) {
      throw new Error(`Sub-protocol not found: ${action.protocol}`);
    }

    // Map actual role to sub-protocol role
    const actualRole = this.rootCFSM.role;
    const subRole = action.roleMapping[actualRole];
    if (!subRole) {
      throw new Error(`No role mapping for ${actualRole} in ${action.protocol}`);
    }

    const subCFSM = protocolCFSMs.get(subRole);
    if (!subCFSM) {
      throw new Error(`CFSM not found for role ${subRole} in ${action.protocol}`);
    }

    // Push call frame
    this.callStack.push({
      protocol: action.protocol,
      parentCFSM: this.currentCFSM,
      returnState: action.returnState,
    });

    // Enter sub-protocol
    this.currentCFSM = subCFSM;
    this.currentState = subCFSM.initialState;

    this.emit('subprotocol-enter', {
      protocol: action.protocol,
      depth: this.callStack.length,
    });
  }

  /**
   * Handle reaching terminal state
   */
  private async handleTerminal(): Promise<void> {
    if (this.callStack.length > 0) {
      // Pop from sub-protocol
      const frame = this.callStack.pop()!;

      this.emit('subprotocol-exit', {
        protocol: frame.protocol,
        depth: this.callStack.length,
      });

      // Return to parent
      this.currentCFSM = frame.parentCFSM;
      this.currentState = frame.returnState;
    } else {
      // Root protocol completed
      this.completed = true;
      this.emit('complete', { role: this.rootCFSM.role, steps: this.stepCount });
    }
  }
}
