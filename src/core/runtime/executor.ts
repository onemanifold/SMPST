/**
 * CFSM Executor Implementation
 *
 * Executes a single role's CFSM (state machine).
 * Clean separation: executor doesn't know about UI, only manages state transitions.
 */

import type {
  ExecutorConfig,
  ExecutionState,
  ExecutionResult,
  ExecutionError,
  Message,
  StateChangeEvent,
  MessageSentEvent,
  MessageReceivedEvent,
  ErrorEvent,
  CallStackFrame,
} from './types';
import type {
  CFSM,
  CFSMState,
  CFSMTransition,
  SendAction,
  ReceiveAction,
  SubProtocolCallAction,
} from '../projection/types';
import type { MessageTransport } from './types';

/**
 * CFSM Executor
 * Manages execution of a single role's state machine
 * Now with call stack support for sub-protocol execution
 */
export class Executor {
  private role: string;
  private cfsm: CFSM;  // Root CFSM
  private transport: MessageTransport;
  private cfsmRegistry: Map<string, Map<string, CFSM>>;
  private observers: ExecutionObserver[];
  private options: ExecutorConfig['options'];

  private currentState: string;
  private visitedStates: string[] = [];
  private blocked: boolean = false;
  private completed: boolean = false;
  private stepCount: number = 0;

  // Call stack for sub-protocol execution
  // Empty = executing root protocol
  // Non-empty = executing sub-protocol(s)
  // Each frame represents a PARENT context to return to
  private callStack: CallStackFrame[] = [];

  // Current CFSM being executed
  // If callStack empty: this is this.cfsm (root)
  // If callStack non-empty: this is the sub-protocol's CFSM
  private currentCFSM: CFSM;

  constructor(config: ExecutorConfig) {
    this.role = config.role;
    this.cfsm = config.cfsm;
    this.transport = config.transport;
    this.cfsmRegistry = config.cfsmRegistry || new Map();
    this.observers = config.observers || [];
    this.options = config.options || {};

    // Initialize at initial state of root CFSM
    this.currentCFSM = this.cfsm;
    this.currentState = this.cfsm.initialState;
    this.visitedStates.push(this.currentState);
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return {
      role: this.role,
      currentState: this.currentState,
      visitedStates: [...this.visitedStates],
      pendingMessages: this.transport.getPendingMessages(this.role),
      blocked: this.blocked,
      completed: this.completed,
      callStack: [...this.callStack],  // Return copy of call stack
    };
  }

  /**
   * Get the current CFSM being executed
   */
  private getCurrentCFSM(): CFSM {
    return this.currentCFSM;
  }

  /**
   * Get terminal states for current execution context
   */
  private getCurrentTerminalStates(): string[] {
    return this.currentCFSM.terminalStates;
  }

  /**
   * Execute one step (one transition)
   */
  async step(): Promise<ExecutionResult> {
    // Check if already completed
    if (this.completed) {
      const error: ExecutionError = {
        type: 'already-completed',
        message: 'Role has already reached terminal state',
        state: this.currentState,
      };
      this.notifyError(error);
      return { success: false, error };
    }

    // Check max steps limit
    if (this.options?.maxSteps && this.stepCount >= this.options.maxSteps) {
      const error: ExecutionError = {
        type: 'no-transition',
        message: `Max steps limit (${this.options.maxSteps}) reached`,
        state: this.currentState,
      };
      return { success: false, error };
    }

    this.stepCount++;

    // Track execution results (messages sent/received during this step)
    let messagesSent: Message[] = [];
    let messagesReceived: Message[] = [];
    let hadAction = false;

    // Auto-advance through epsilon transitions until we hit an action or terminal
    while (true) {
      const currentCFSM = this.getCurrentCFSM();
      const terminalStates = this.getCurrentTerminalStates();

      // Check if terminal (terminal states are explicitly listed in CFSM)
      if (terminalStates.includes(this.currentState)) {
        // If in sub-protocol, pop from call stack and return to parent
        if (this.callStack.length > 0) {
          const frame = this.callStack.pop()!;
          // Return to parent CFSM and state
          this.currentCFSM = frame.parentCFSM;
          this.currentState = frame.returnState;
          // Continue loop to execute in parent context
          continue;
        }

        // Root protocol completed
        this.completed = true;
        return {
          success: true,
          newState: this.currentState,
          messagesSent: messagesSent.length > 0 ? messagesSent : undefined,
          messagesConsumed: messagesReceived.length > 0 ? messagesReceived : undefined,
        };
      }

      // Get outgoing transitions from current CFSM
      const transitions = currentCFSM.transitions.filter(t => t.from === this.currentState);

      if (transitions.length === 0) {
        const error: ExecutionError = {
          type: 'no-transition',
          message: `No transitions from state ${this.currentState}`,
          state: this.currentState,
        };
        return { success: false, error };
      }

      // Check first transition's action to determine what to do
      // Note: For non-deterministic states (choice), we need to handle multiple transitions
      const firstTransition = transitions[0];
      const action = firstTransition.action;

      // No action = epsilon/tau transition - auto-advance
      if (!action) {
        this.transitionTo(firstTransition.to);
        // Continue loop to execute next state
        continue;
      }

      // If we already executed an action and now hit another one, stop here
      if (hadAction) {
        // Return success with accumulated results
        return {
          success: true,
          newState: this.currentState,
          messagesSent: messagesSent.length > 0 ? messagesSent : undefined,
          messagesConsumed: messagesReceived.length > 0 ? messagesReceived : undefined,
        };
      }

      // Execute based on action type (actions live on transitions, not states!)
      if (action.type === 'send') {
        const result = await this.executeSend(firstTransition);
        if (!result.success) {
          return result;
        }
        // Accumulate messages and continue to auto-advance through epsilon transitions
        if (result.messagesSent) {
          messagesSent.push(...result.messagesSent);
        }
        hadAction = true;
        // After action, continue loop to auto-advance through epsilon transitions
        continue;
      } else if (action.type === 'receive') {
        const result = await this.executeReceive(firstTransition);
        if (!result.success) {
          return result;
        }
        // Accumulate messages and continue to auto-advance through epsilon transitions
        if (result.messagesConsumed) {
          messagesReceived.push(...result.messagesConsumed);
        }
        hadAction = true;
        // After action, continue loop to auto-advance through epsilon transitions
        continue;
      } else if (action.type === 'tau') {
        // Explicit tau action - treat as epsilon
        this.transitionTo(firstTransition.to);
        continue;
      } else if (action.type === 'subprotocol') {
        // Sub-protocol invocation - push onto call stack
        const result = await this.executeSubProtocol(firstTransition);
        if (!result.success) {
          return result;
        }
        // Sub-protocol has been pushed onto stack, continue to execute it
        continue;
      } else {
        // Choice or other complex action - handle multiple transitions
        return await this.executeChoice(transitions);
      }
    }
  }

  /**
   * Execute send action
   */
  private async executeSend(transition: CFSMTransition): Promise<ExecutionResult> {
    const action = transition.action;

    if (!action || action.type !== 'send') {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Transition has no send action',
        state: this.currentState,
      };
      return { success: false, error };
    }

    // Type narrowing - action is now SendAction
    const sendAction = action as SendAction;

    // Create message
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      from: this.role,
      to: sendAction.to,
      label: sendAction.label,
      timestamp: Date.now(),
    };

    // Send through transport
    await this.transport.send(message);

    // Notify observers
    this.notifyMessageSent(message);

    // Take transition
    const newState = transition.to;
    this.transitionTo(newState);

    return {
      success: true,
      newState,
      messagesSent: [message],
    };
  }

  /**
   * Execute receive action
   */
  private async executeReceive(transition: CFSMTransition): Promise<ExecutionResult> {
    const action = transition.action;
    if (!action || action.type !== 'receive') {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Transition has no receive action',
        state: this.currentState,
      };
      return { success: false, error };
    }

    // Type narrowing - action is now ReceiveAction
    const receiveAction = action as ReceiveAction;

    // Check if message available
    if (!this.transport.hasMessage(this.role)) {
      this.blocked = true;
      const error: ExecutionError = {
        type: 'message-not-ready',
        message: `Waiting for message: ${receiveAction.label}`,
        state: this.currentState,
      };
      return { success: false, error };
    }

    // Receive message
    const message = await this.transport.receive(this.role);
    if (!message) {
      this.blocked = true;
      const error: ExecutionError = {
        type: 'message-not-ready',
        message: 'No message available',
        state: this.currentState,
      };
      return { success: false, error };
    }

    // Verify message matches expected
    if (this.options?.strictMode && message.label !== receiveAction.label) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Expected message ${receiveAction.label}, got ${message.label}`,
        state: this.currentState,
        details: { expected: receiveAction.label, received: message.label },
      };
      this.notifyError(error);
      return { success: false, error };
    }

    this.blocked = false;

    // Notify observers
    this.notifyMessageReceived(message);

    // Take transition
    const newState = transition.to;
    this.transitionTo(newState);

    return {
      success: true,
      newState,
      messagesConsumed: [message],
    };
  }

  /**
   * Execute choice (internal or external)
   */
  private async executeChoice(transitions: CFSMTransition[]): Promise<ExecutionResult> {
    // For now, pick first transition (could be random or based on condition)
    // In real implementation, this would involve decision logic
    const transition = transitions[0];
    const newState = transition.to;
    this.transitionTo(newState);

    return {
      success: true,
      newState,
    };
  }

  /**
   * Execute fork (enter parallel)
   */
  private async executeFork(transitions: CFSMTransition[]): Promise<ExecutionResult> {
    // Take first branch transition
    const transition = transitions[0];
    const newState = transition.to;
    this.transitionTo(newState);

    return {
      success: true,
      newState,
    };
  }

  /**
   * Execute join (exit parallel)
   */
  private async executeJoin(transitions: CFSMTransition[]): Promise<ExecutionResult> {
    // Simply take the transition
    const transition = transitions[0];
    const newState = transition.to;
    this.transitionTo(newState);

    return {
      success: true,
      newState,
    };
  }

  /**
   * Execute sub-protocol invocation
   * Pushes new frame onto call stack and transitions to sub-protocol's initial state
   */
  private async executeSubProtocol(transition: CFSMTransition): Promise<ExecutionResult> {
    const action = transition.action;
    if (!action || action.type !== 'subprotocol') {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Transition has no sub-protocol action',
        state: this.currentState,
      };
      return { success: false, error };
    }

    // Type narrowing - action is now SubProtocolCallAction
    const subProtocolAction = action as SubProtocolCallAction;

    // Look up sub-protocol CFSM from registry
    const protocolCFSMs = this.cfsmRegistry.get(subProtocolAction.protocol);
    if (!protocolCFSMs) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Sub-protocol '${subProtocolAction.protocol}' not found in registry`,
        state: this.currentState,
        details: { protocol: subProtocolAction.protocol },
      };
      return { success: false, error };
    }

    // Map this role to the sub-protocol's formal parameter using role mapping
    // The roleMapping maps: formalRole → actualRole (e.g., {Client: 'Alice', Server: 'Bob'})
    // We need to find which formal role corresponds to this executor's actual role
    const formalRole = Object.entries(subProtocolAction.roleMapping)
      .find(([formal, actual]) => actual === this.role)?.[0];

    if (!formalRole) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Role '${this.role}' not found in role mapping for sub-protocol '${subProtocolAction.protocol}'`,
        state: this.currentState,
        details: {
          protocol: subProtocolAction.protocol,
          role: this.role,
          roleMapping: subProtocolAction.roleMapping
        },
      };
      return { success: false, error };
    }

    // Get the CFSM for the formal role in the sub-protocol
    const subProtocolCFSM = protocolCFSMs.get(formalRole);
    if (!subProtocolCFSM) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `CFSM for role '${formalRole}' not found in sub-protocol '${subProtocolAction.protocol}'`,
        state: this.currentState,
        details: {
          protocol: subProtocolAction.protocol,
          formalRole,
          actualRole: this.role
        },
      };
      return { success: false, error };
    }

    // Create call stack frame for parent context
    const frame: CallStackFrame = {
      parentCFSM: this.currentCFSM,        // Current CFSM becomes parent
      returnState: subProtocolAction.returnState,  // Where to return after sub-protocol completes
      roleMapping: subProtocolAction.roleMapping,
      protocol: subProtocolAction.protocol,
    };

    // Push parent frame onto call stack
    this.callStack.push(frame);

    // Switch to sub-protocol execution context
    this.currentCFSM = subProtocolCFSM;
    this.currentState = subProtocolCFSM.initialState;
    this.visitedStates.push(this.currentState);

    return {
      success: true,
      newState: this.currentState,
    };
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: string): void {
    const oldState = this.currentState;
    this.currentState = newState;

    // Limit visitedStates array size to prevent memory issues
    // Keep only last 10000 states
    const MAX_VISITED_STATES = 10000;
    if (this.visitedStates.length >= MAX_VISITED_STATES) {
      // Remove oldest half when limit reached
      this.visitedStates = this.visitedStates.slice(MAX_VISITED_STATES / 2);
    }
    this.visitedStates.push(newState);

    // Check if reached terminal
    if (this.cfsm.terminalStates.includes(newState)) {
      this.completed = true;
    }

    // Notify observers
    this.notifyStateChange(oldState, newState);
  }

  /**
   * Notify observers of state change
   */
  private notifyStateChange(fromState: string, toState: string): void {
    const event: StateChangeEvent = {
      type: 'state-change',
      timestamp: Date.now(),
      role: this.role,
      fromState,
      toState,
    };

    this.observers.forEach(observer => {
      observer.onStateChange?.(event);
    });
  }

  /**
   * Notify observers of message sent
   */
  private notifyMessageSent(message: Message): void {
    const event: MessageSentEvent = {
      type: 'message-sent',
      timestamp: Date.now(),
      message,
    };

    this.observers.forEach(observer => {
      observer.onMessageSent?.(event);
    });
  }

  /**
   * Notify observers of message received
   */
  private notifyMessageReceived(message: Message): void {
    const event: MessageReceivedEvent = {
      type: 'message-received',
      timestamp: Date.now(),
      role: this.role,
      message,
    };

    this.observers.forEach(observer => {
      observer.onMessageReceived?.(event);
    });
  }

  /**
   * Notify observers of error
   */
  private notifyError(error: ExecutionError): void {
    const event: ErrorEvent = {
      type: 'error',
      timestamp: Date.now(),
      role: this.role,
      error,
    };

    this.observers.forEach(observer => {
      observer.onError?.(event);
    });
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentCFSM = this.cfsm;  // Reset to root CFSM
    this.currentState = this.cfsm.initialState;
    this.visitedStates = [this.currentState];
    this.callStack = [];  // Clear call stack
    this.blocked = false;
    this.completed = false;
    this.stepCount = 0;
  }

  /**
   * Add an observer to this executor
   */
  addObserver(observer: ExecutionObserver): void {
    this.observers.push(observer);
  }

  /**
   * Remove an observer from this executor
   */
  removeObserver(observer: ExecutionObserver): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }
}

// Import ExecutionObserver type
import type { ExecutionObserver } from './types';
