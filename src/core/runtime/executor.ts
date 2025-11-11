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
} from './types';
import type { CFSM, CFSMState, CFSMTransition } from '../projection/types';
import type { MessageTransport } from './types';

/**
 * CFSM Executor
 * Manages execution of a single role's state machine
 */
export class Executor {
  private role: string;
  private cfsm: CFSM;
  private transport: MessageTransport;
  private observers: ExecutionObserver[];
  private options: ExecutorConfig['options'];

  private currentState: string;
  private visitedStates: string[] = [];
  private blocked: boolean = false;
  private completed: boolean = false;
  private stepCount: number = 0;

  constructor(config: ExecutorConfig) {
    this.role = config.role;
    this.cfsm = config.cfsm;
    this.transport = config.transport;
    this.observers = config.observers || [];
    this.options = config.options || {};

    // Initialize at initial state
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
    };
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
    if (this.options.maxSteps && this.stepCount >= this.options.maxSteps) {
      const error: ExecutionError = {
        type: 'no-transition',
        message: `Max steps limit (${this.options.maxSteps}) reached`,
        state: this.currentState,
      };
      return { success: false, error };
    }

    this.stepCount++;

    // Auto-advance through epsilon transitions until we hit an action or terminal
    while (true) {
      // Get current state
      const state = this.cfsm.states.find(s => s.id === this.currentState);
      if (!state) {
        const error: ExecutionError = {
          type: 'no-transition',
          message: `Current state ${this.currentState} not found in CFSM`,
          state: this.currentState,
        };
        return { success: false, error };
      }

      // Check if terminal
      if (state.type === 'terminal') {
        this.completed = true;
        return { success: true, newState: this.currentState };
      }

      // Get outgoing transitions
      const transitions = this.cfsm.transitions.filter(t => t.from === this.currentState);
      if (transitions.length === 0) {
        const error: ExecutionError = {
          type: 'no-transition',
          message: `No transitions from state ${this.currentState}`,
          state: this.currentState,
        };
        return { success: false, error };
      }

      // Execute based on state type
      if (state.type === 'send') {
        return await this.executeSend(state, transitions);
      } else if (state.type === 'receive') {
        return await this.executeReceive(state, transitions);
      } else if (state.type === 'choice') {
        return await this.executeChoice(transitions);
      } else if (state.type === 'fork') {
        return await this.executeFork(transitions);
      } else if (state.type === 'join') {
        return await this.executeJoin(transitions);
      } else {
        // Initial, merge, or other - auto-advance through epsilon
        const transition = transitions[0];
        this.transitionTo(transition.to);
        // Continue loop to execute next state
      }
    }
  }

  /**
   * Execute send action
   */
  private async executeSend(state: CFSMState, transitions: CFSMTransition[]): Promise<ExecutionResult> {
    if (!state.action) {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Send state has no action',
        state: this.currentState,
      };
      return { success: false, error };
    }

    const action = state.action;

    // Create message
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      from: action.from,
      to: action.to,
      label: action.label,
      timestamp: Date.now(),
    };

    // Send through transport
    await this.transport.send(message);

    // Notify observers
    this.notifyMessageSent(message);

    // Take transition
    const transition = transitions[0]; // Send states have single transition
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
  private async executeReceive(state: CFSMState, transitions: CFSMTransition[]): Promise<ExecutionResult> {
    if (!state.action) {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Receive state has no action',
        state: this.currentState,
      };
      return { success: false, error };
    }

    const expectedAction = state.action;

    // Check if message available
    if (!this.transport.hasMessage(this.role)) {
      this.blocked = true;
      const error: ExecutionError = {
        type: 'message-not-ready',
        message: `Waiting for message: ${expectedAction.label}`,
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
    if (this.options.strictMode && message.label !== expectedAction.label) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Expected message ${expectedAction.label}, got ${message.label}`,
        state: this.currentState,
        details: { expected: expectedAction.label, received: message.label },
      };
      this.notifyError(error);
      return { success: false, error };
    }

    this.blocked = false;

    // Notify observers
    this.notifyMessageReceived(message);

    // Take transition
    const transition = transitions[0]; // Receive states have single transition
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
   * Transition to new state
   */
  private transitionTo(newState: string): void {
    const oldState = this.currentState;
    this.currentState = newState;
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
    this.currentState = this.cfsm.initialState;
    this.visitedStates = [this.currentState];
    this.blocked = false;
    this.completed = false;
    this.stepCount = 0;
  }
}

// Import ExecutionObserver type
import type { ExecutionObserver } from './types';
