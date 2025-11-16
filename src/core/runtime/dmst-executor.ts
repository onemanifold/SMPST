/**
 * DMst Executor Implementation
 *
 * Extends the classic CFSM Executor to handle DMst-specific actions:
 * - Dynamic participant creation (create)
 * - Invitation protocol synchronization (invite)
 * - Protocol updates (Sprint 3 - future work)
 *
 * Inherits from classic Executor:
 * - ✅ Sub-protocol call stack semantics (inherited data structures)
 * - ✅ Observer pattern for events (inherited methods)
 * - ✅ State management and transitions (inherited getState)
 *
 * Implements directly (adapted from executor.ts:136-460):
 * - ✅ Epsilon auto-advance loop
 * - ✅ Standard CFSM actions (send, receive, subprotocol)
 * - ✅ DMst actions (create, invite)
 *
 * Based on Castro-Perez & Yoshida (ECOOP 2023) operational semantics.
 *
 * ARCHITECTURE NOTE:
 * This class extends Executor to inherit state management and observer pattern,
 * but completely overrides step() to handle DMst actions. Some code is duplicated
 * from executor.ts to handle private method access limitations. This is intentional
 * to avoid modifying the classic Executor and risking regressions.
 */

import { Executor } from './executor';
import type {
  ExecutorConfig,
  ExecutionResult,
  ExecutionError,
  Message,
  MessageTransport,
  CallStackFrame,
} from './types';
import type {
  CFSM,
  CFSMTransition,
  CreateAction,
  InviteAction,
  SendAction,
  ReceiveAction,
  SubProtocolCallAction,
} from '../projection/types';
import type {
  DynamicParticipantRegistry,
} from './dmst-runtime';

/**
 * DMst Executor Configuration
 * Extends classic ExecutorConfig with DMst-specific registry
 */
export interface DMstExecutorConfig extends ExecutorConfig {
  // Dynamic participant registry for creation/invitation
  dynamicRegistry?: DynamicParticipantRegistry;

  // Dynamic role templates (role name → CFSM template)
  dynamicCFSMs?: Map<string, CFSM>;
}

/**
 * DMst CFSM Executor
 *
 * Executes a single role's CFSM with DMst extensions.
 *
 * KEY FEATURES:
 * - ✅ Epsilon auto-advance: Automatically traverses tau transitions
 * - ✅ Sub-protocol call stack: Handles nested protocol invocations
 * - ✅ Dynamic participant creation: Handles 'create' actions
 * - ✅ Invitation synchronization: Handles 'invite' actions
 * - ✅ Observer pattern: Fires events for state changes, messages, errors
 */
export class DMstExecutor extends Executor {
  private dynamicRegistry?: DynamicParticipantRegistry;
  private dynamicCFSMs?: Map<string, CFSM>;

  constructor(config: DMstExecutorConfig) {
    super(config);
    this.dynamicRegistry = config.dynamicRegistry;
    this.dynamicCFSMs = config.dynamicCFSMs;
  }

  /**
   * Execute one step (one transition)
   *
   * COMPLETE REIMPLEMENTATION of executor.ts:106-239 with DMst extensions.
   *
   * FORMAL SEMANTICS (Honda et al. 2008):
   * - One step = one action (send, receive) OR auto-advance through epsilon
   * - Epsilon transitions are transparent (structural states)
   * - Sub-protocol calls push onto call stack
   *
   * ALGORITHM:
   * 1. Loop until hitting an action or terminal:
   *    a. Check terminal state (pop call stack if in sub-protocol)
   *    b. Get outgoing transitions
   *    c. If epsilon: advance state and continue loop
   *    d. If action: execute and return
   * 2. Return execution result
   *
   * DIFFERENCES FROM PARENT:
   * - Handles 'create' and 'invite' actions
   * - Otherwise identical to parent's step() implementation
   */
  async step(): Promise<ExecutionResult> {
    const state = this.getState();

    // Check if already completed
    if (state.completed) {
      const error: ExecutionError = {
        type: 'already-completed',
        message: 'Role has already reached terminal state',
        state: state.currentState,
      };
      this.dmstNotifyError(error);
      return { success: false, error };
    }

    // Access private fields via type assertions (necessary due to inheritance)
    const currentCFSM = (this as any).currentCFSM as CFSM;
    const options = (this as any).options;
    const stepCount = (this as any).stepCount;

    // Check max steps limit
    if (options?.maxSteps && stepCount >= options.maxSteps) {
      const error: ExecutionError = {
        type: 'no-transition',
        message: `Max steps limit (${options.maxSteps}) reached`,
        state: state.currentState,
      };
      return { success: false, error };
    }

    (this as any).stepCount++;

    // Track execution results (messages sent/received during this step)
    let messagesSent: Message[] = [];
    let messagesReceived: Message[] = [];
    let hadAction = false;

    // Auto-advance through epsilon transitions until we hit an action or terminal
    while (true) {
      const currentState = this.getState().currentState;
      const callStack = this.getState().callStack;
      const terminalStates = currentCFSM.terminalStates;

      // Check if terminal (terminal states are explicitly listed in CFSM)
      if (terminalStates.includes(currentState)) {
        // If in sub-protocol, pop from call stack and return to parent
        if (callStack.length > 0) {
          const frame = callStack.pop()!;
          // Return to parent CFSM and state
          (this as any).currentCFSM = frame.parentCFSM;
          (this as any).currentState = frame.returnState;
          (this as any).visitedStates.push(frame.returnState);
          // Continue loop to execute in parent context
          continue;
        }

        // Root protocol completed
        (this as any).completed = true;
        return {
          success: true,
          newState: currentState,
          messagesSent: messagesSent.length > 0 ? messagesSent : undefined,
          messagesConsumed: messagesReceived.length > 0 ? messagesReceived : undefined,
        };
      }

      // Get outgoing transitions from current CFSM
      const transitions = currentCFSM.transitions.filter(t => t.from === currentState);

      if (transitions.length === 0) {
        const error: ExecutionError = {
          type: 'no-transition',
          message: `No transitions from state ${currentState}`,
          state: currentState,
        };
        return { success: false, error };
      }

      // Check first transition's action to determine what to do
      const firstTransition = transitions[0];
      const action = firstTransition.action;

      // No action = epsilon/tau transition - auto-advance
      if (!action || action.type === 'tau') {
        this.dmstTransitionTo(firstTransition.to);
        continue; // Continue loop to execute next state
      }

      // If we already executed an action and now hit another one, stop here
      if (hadAction) {
        return {
          success: true,
          newState: currentState,
          messagesSent: messagesSent.length > 0 ? messagesSent : undefined,
          messagesConsumed: messagesReceived.length > 0 ? messagesReceived : undefined,
        };
      }

      // Execute action based on type
      let result: ExecutionResult;

      switch (action.type) {
        case 'send':
          result = await this.dmstExecuteSend(firstTransition);
          break;

        case 'receive':
          result = await this.dmstExecuteReceive(firstTransition);
          break;

        case 'subprotocol':
          result = await this.dmstExecuteSubProtocol(firstTransition);
          break;

        case 'choice':
          // Internal choice - take the transition
          this.dmstTransitionTo(firstTransition.to);
          result = { success: true, newState: firstTransition.to };
          break;

        case 'create':
          result = await this.executeCreate(firstTransition, action as CreateAction);
          break;

        case 'invite':
          result = await this.executeInvite(firstTransition, action as InviteAction);
          break;

        default:
          const error: ExecutionError = {
            type: 'protocol-violation',
            message: `Unknown action type: ${(action as any).type}`,
            state: currentState,
          };
          return { success: false, error };
      }

      if (!result.success) {
        return result;
      }

      // Accumulate messages
      if (result.messagesSent) {
        messagesSent.push(...result.messagesSent);
      }
      if (result.messagesConsumed) {
        messagesReceived.push(...result.messagesConsumed);
      }

      hadAction = true;

      // After action, continue loop to auto-advance through epsilon transitions
      continue;
    }
  }

  /**
   * Transition to new state
   * Copied from executor.ts:489-510 (private method)
   */
  private dmstTransitionTo(newState: string): void {
    const oldState = this.getState().currentState;
    (this as any).currentState = newState;

    const visitedStates = (this as any).visitedStates as string[];
    const MAX_VISITED_STATES = 10000;
    if (visitedStates.length >= MAX_VISITED_STATES) {
      (this as any).visitedStates = visitedStates.slice(MAX_VISITED_STATES / 2);
    }
    visitedStates.push(newState);

    // Check if reached terminal
    const cfsm = (this as any).cfsm as CFSM;
    if (cfsm.terminalStates.includes(newState)) {
      (this as any).completed = true;
    }

    // Notify observers
    this.dmstNotifyStateChange(oldState, newState);
  }

  /**
   * Notify observers of state change
   * Copied from executor.ts:514-527
   */
  private dmstNotifyStateChange(fromState: string, toState: string): void {
    const observers = (this as any).observers as any[];
    const role = this.getState().role;

    const event = {
      type: 'state-change' as const,
      timestamp: Date.now(),
      role,
      fromState,
      toState,
    };

    observers.forEach(observer => {
      observer.onStateChange?.(event);
    });
  }

  /**
   * Notify observers of error
   * Copied from executor.ts:563-574
   */
  private dmstNotifyError(error: ExecutionError): void {
    const observers = (this as any).observers as any[];
    const role = this.getState().role;

    const event = {
      type: 'error' as const,
      timestamp: Date.now(),
      role,
      error,
    };

    observers.forEach(observer => {
      observer.onError?.(event);
    });
  }

  /**
   * Notify observers of message sent
   */
  private dmstNotifyMessageSent(message: Message): void {
    const observers = (this as any).observers as any[];

    const event = {
      type: 'message-sent' as const,
      timestamp: Date.now(),
      message,
    };

    observers.forEach(observer => {
      observer.onMessageSent?.(event);
    });
  }

  /**
   * Notify observers of message received
   */
  private dmstNotifyMessageReceived(message: Message): void {
    const observers = (this as any).observers as any[];
    const role = this.getState().role;

    const event = {
      type: 'message-received' as const,
      timestamp: Date.now(),
      role,
      message,
    };

    observers.forEach(observer => {
      observer.onMessageReceived?.(event);
    });
  }

  /**
   * Execute send action
   * Adapted from executor.ts:243-283
   */
  private async dmstExecuteSend(transition: CFSMTransition): Promise<ExecutionResult> {
    const action = transition.action;
    if (!action || action.type !== 'send') {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Transition has no send action',
        state: this.getState().currentState,
      };
      return { success: false, error };
    }

    const sendAction = action as SendAction;
    const transport = (this as any).transport as MessageTransport;
    const role = this.getState().role;

    // Create message
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      from: role,
      to: sendAction.to,
      label: sendAction.message.label,
      payload: sendAction.message.payload,
      timestamp: Date.now(),
    };

    // Send through transport
    await transport.send(message);

    // Notify observers
    this.dmstNotifyMessageSent(message);

    // Take transition
    this.dmstTransitionTo(transition.to);

    return {
      success: true,
      newState: transition.to,
      messagesSent: [message],
    };
  }

  /**
   * Execute receive action
   * Adapted from executor.ts:288-351
   */
  private async dmstExecuteReceive(transition: CFSMTransition): Promise<ExecutionResult> {
    const action = transition.action;
    if (!action || action.type !== 'receive') {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Transition has no receive action',
        state: this.getState().currentState,
      };
      return { success: false, error };
    }

    const receiveAction = action as ReceiveAction;
    const transport = (this as any).transport as MessageTransport;
    const role = this.getState().role;
    const options = (this as any).options;

    // Check if message available
    if (!transport.hasMessage(role)) {
      (this as any).blocked = true;
      const error: ExecutionError = {
        type: 'message-not-ready',
        message: `Waiting for message: ${receiveAction.message.label}`,
        state: this.getState().currentState,
      };
      return { success: false, error };
    }

    // Receive message
    const message = await transport.receive(role);
    if (!message) {
      (this as any).blocked = true;
      const error: ExecutionError = {
        type: 'message-not-ready',
        message: 'No message available',
        state: this.getState().currentState,
      };
      return { success: false, error };
    }

    // Verify message matches expected
    if (options?.strictMode && message.label !== receiveAction.message.label) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Expected message ${receiveAction.message.label}, got ${message.label}`,
        state: this.getState().currentState,
        details: { expected: receiveAction.message.label, received: message.label },
      };
      this.dmstNotifyError(error);
      return { success: false, error };
    }

    (this as any).blocked = false;

    // Notify observers
    this.dmstNotifyMessageReceived(message);

    // Take transition
    this.dmstTransitionTo(transition.to);

    return {
      success: true,
      newState: transition.to,
      messagesConsumed: [message],
    };
  }

  /**
   * Execute sub-protocol invocation
   * Adapted from executor.ts:403-485
   * Implements call stack push/pop semantics
   */
  private async dmstExecuteSubProtocol(transition: CFSMTransition): Promise<ExecutionResult> {
    const action = transition.action;
    if (!action || action.type !== 'subprotocol') {
      const error: ExecutionError = {
        type: 'no-transition',
        message: 'Transition has no sub-protocol action',
        state: this.getState().currentState,
      };
      return { success: false, error };
    }

    const subProtocolAction = action as SubProtocolCallAction;
    const cfsmRegistry = (this as any).cfsmRegistry as Map<string, Map<string, CFSM>>;
    const role = this.getState().role;

    // Look up sub-protocol CFSM from registry
    const protocolCFSMs = cfsmRegistry.get(subProtocolAction.protocol);
    if (!protocolCFSMs) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Sub-protocol '${subProtocolAction.protocol}' not found in registry`,
        state: this.getState().currentState,
        details: { protocol: subProtocolAction.protocol },
      };
      return { success: false, error };
    }

    // Map this role to the sub-protocol's formal parameter using role mapping
    const formalRole = Object.entries(subProtocolAction.roleMapping)
      .find(([, actual]) => actual === role)?.[0];

    if (!formalRole) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `Role '${role}' not found in role mapping for sub-protocol '${subProtocolAction.protocol}'`,
        state: this.getState().currentState,
        details: {
          protocol: subProtocolAction.protocol,
          role,
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
        state: this.getState().currentState,
        details: {
          protocol: subProtocolAction.protocol,
          formalRole,
          actualRole: role
        },
      };
      return { success: false, error };
    }

    // Create call stack frame for parent context
    const frame: CallStackFrame = {
      parentCFSM: (this as any).currentCFSM,
      returnState: subProtocolAction.returnState,
      roleMapping: subProtocolAction.roleMapping,
      protocol: subProtocolAction.protocol,
    };

    // Push parent frame onto call stack
    const callStack = this.getState().callStack;
    callStack.push(frame);

    // Switch to sub-protocol execution context
    (this as any).currentCFSM = subProtocolCFSM;
    (this as any).currentState = subProtocolCFSM.initialState;

    const visitedStates = (this as any).visitedStates as string[];
    visitedStates.push(subProtocolCFSM.initialState);

    return {
      success: true,
      newState: subProtocolCFSM.initialState,
    };
  }

  /**
   * Execute create action
   *
   * DMst-SPECIFIC: Creates a new dynamic participant instance.
   *
   * From ECOOP 2023 Definition 12:
   * [[p creates r]]_p = !create(r) (creator sends)
   * [[p creates r]]_r = ?create from p (created receives)
   *
   * Implementation:
   * 1. Generate instance ID if not provided
   * 2. Get CFSM template for dynamic role
   * 3. Send creation message (handled by DMstSimulator)
   * 4. Take transition
   */
  private async executeCreate(
    transition: CFSMTransition,
    action: CreateAction
  ): Promise<ExecutionResult> {
    if (!this.dynamicRegistry) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: 'Dynamic participant registry not configured',
        state: this.getState().currentState,
      };
      return { success: false, error };
    }

    // Get role template CFSM
    const cfsmTemplate = this.dynamicCFSMs?.get(action.role);
    if (!cfsmTemplate) {
      const error: ExecutionError = {
        type: 'protocol-violation',
        message: `No CFSM template for dynamic role: ${action.role}`,
        state: this.getState().currentState,
        details: { role: action.role },
      };
      return { success: false, error };
    }

    // Generate instance ID
    const nextId = this.dynamicRegistry.nextInstanceId.get(action.role) || 1;
    const instanceId = action.instance || `${action.role}_${nextId}`;

    const transport = (this as any).transport as MessageTransport;
    const role = this.getState().role;

    // Create and send message (will be handled by DMstSimulator)
    const message: Message = {
      id: `create_${instanceId}_${Date.now()}`,
      from: role,
      to: instanceId,
      label: 'create',
      payload: {
        role: action.role,
        instanceId,
        cfsmTemplate: cfsmTemplate,
      },
      timestamp: Date.now(),
    };

    await transport.send(message);

    // Notify observers
    this.dmstNotifyMessageSent(message);

    // Take transition
    this.dmstTransitionTo(transition.to);

    return {
      success: true,
      newState: transition.to,
      messagesSent: [message],
    };
  }

  /**
   * Execute invite action
   *
   * DMst-SPECIFIC: Sends invitation to dynamic participant.
   *
   * From ECOOP 2023 Definition 12:
   * [[p invites q]]_p = !invite to q
   * [[p invites q]]_q = ?invite from p
   *
   * Implementation:
   * 1. Send invitation message to target instance
   * 2. Take transition
   * (Registry updates handled by DMstSimulator)
   */
  private async executeInvite(
    transition: CFSMTransition,
    action: InviteAction
  ): Promise<ExecutionResult> {
    const transport = (this as any).transport as MessageTransport;
    const role = this.getState().role;

    // Send invitation message
    const message: Message = {
      id: `invite_${action.target}_${Date.now()}`,
      from: role,
      to: action.target,
      label: 'invite',
      payload: undefined,
      timestamp: Date.now(),
    };

    await transport.send(message);

    // Notify observers
    this.dmstNotifyMessageSent(message);

    // Take transition
    this.dmstTransitionTo(transition.to);

    return {
      success: true,
      newState: transition.to,
      messagesSent: [message],
    };
  }
}

