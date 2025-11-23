/**
 * DMst Simulator - Extended Multi-Role Protocol Execution
 *
 * Extends the standard simulator to handle:
 * - Dynamic participant creation during execution
 * - Invitation protocol synchronization
 * - Protocol call nesting
 * - Updatable recursion with growing participant sets
 *
 * Based on Castro-Perez & Yoshida (ECOOP 2023) operational semantics.
 *
 * KNOWN GAPS:
 * - DONE(P0): Sub-protocol call stack - implemented in executeProtocolCall()
 * - DONE(P0): Fair scheduling - round-robin in step() (Honda et al. 2008)
 * - DONE(P0): Epsilon auto-advance - implemented in stepRole() loop
 * - TODO(P0): Should refactor to use Executor pattern (Issue #4)
 * - TODO(P1): Observer pattern not implemented (Issue #5)
 * - TODO(P1): Trace recording not implemented (Issue #6)
 * - TODO(P1): Pause/resume not implemented (Issue #7)
 * - TODO(P1): Updatable CFSM runtime semantics not designed (Issue #8)
 */

import type { CFSM, CFSMAction, SendAction, ReceiveAction, SubProtocolCallAction } from '../projection/types';
import type {
  MessageTransport,
  Message,
  ExecutionState,
  ExecutionResult,
  ExecutionError,
  SimulationStepResult,
  ExecutorConfig,
  CallStackFrame,
} from './types';
import type {
  DMstSimulationState,
  DynamicParticipant,
  ProtocolCallFrame,
  ParticipantCreationEvent,
  InvitationCompleteEvent,
} from './dmst-runtime';
import {
  createDMstSimulationState,
  createDynamicParticipant,
  sendInvitation,
  completeInvitation,
  isParticipantReady,
  getAllActiveParticipants,
  allParticipantsTerminated,
  detectDMstDeadlock,
  pushProtocolCall,
  popProtocolCall,
} from './dmst-runtime';
import { InMemoryTransport } from './transport';

// ============================================================================
// DMst Simulator
// ============================================================================

/**
 * DMst-aware multi-role protocol simulator.
 *
 * Orchestrates execution of:
 * - Static participants (pre-declared)
 * - Dynamic participants (created during execution)
 * - Nested protocol calls
 * - Updatable recursion
 */
export class DMstSimulator {
  private state: DMstSimulationState;
  private transport: MessageTransport;
  private cfsms: Map<string, CFSM>; // Static role CFSMs
  private dynamicCFSMs: Map<string, CFSM>; // Dynamic role type → CFSM template

  /**
   * CFSM registry for sub-protocol resolution.
   * Maps: protocol name → role name → CFSM
   * Used for protocol call stack semantics (ECOOP 2023, Definition 1)
   */
  private cfsmRegistry: Map<string, Map<string, CFSM>>;

  /**
   * Fair scheduling: round-robin role selection index
   * Ensures each role gets a turn to execute (Honda et al. 2008 semantics)
   */
  private nextRoleIndex: number = 0;

  constructor(
    staticRoles: Map<string, CFSM>,
    dynamicRoles: Map<string, CFSM> = new Map(),
    transport?: MessageTransport,
    cfsmRegistry?: Map<string, Map<string, CFSM>>
  ) {
    this.state = createDMstSimulationState(staticRoles);
    this.transport = transport || new InMemoryTransport();
    this.cfsms = staticRoles;
    this.dynamicCFSMs = dynamicRoles;
    this.cfsmRegistry = cfsmRegistry || new Map();
    this.nextRoleIndex = 0;
  }

  /**
   * Register a sub-protocol's CFSMs for call stack resolution.
   *
   * @param protocolName - Name of the sub-protocol
   * @param roleCFSMs - Map of role name to CFSM for that protocol
   */
  registerSubProtocol(protocolName: string, roleCFSMs: Map<string, CFSM>): void {
    this.cfsmRegistry.set(protocolName, roleCFSMs);
  }

  /**
   * Execute one step of the simulation.
   *
   * FAIR SCHEDULING (Honda et al. 2008 semantics):
   * - One step() call = one CFSM transition = one role
   * - Round-robin selection ensures fairness
   *
   * Strategy:
   * 1. Process pending invitations
   * 2. Select ONE ready participant (round-robin fair scheduling)
   * 3. Execute one transition for that participant
   * 4. Handle DMst-specific actions (creation/invitation)
   * 5. Detect completion/deadlock
   *
   * @returns Step result with updates
   */
  async step(): Promise<SimulationStepResult> {
    this.state.step++;

    // Process pending invitations
    await this.processPendingInvitations();

    // Get all active participants
    const allParticipants = getAllActiveParticipants(this.state);
    const roleNames = Array.from(allParticipants.keys());

    const updates = new Map<string, ExecutionResult>();
    let selectedRole: string | null = null;

    // Fair scheduling: round-robin selection of ONE role to step
    // Following Honda et al. 2008 semantics (one step = one transition)
    const startIndex = this.nextRoleIndex % Math.max(roleNames.length, 1);
    let attempts = 0;

    while (attempts < roleNames.length) {
      const candidateIndex = (startIndex + attempts) % roleNames.length;
      const candidateRole = roleNames[candidateIndex];
      const execState = allParticipants.get(candidateRole);

      // Move to next role for next time (round-robin)
      this.nextRoleIndex = (candidateIndex + 1) % Math.max(roleNames.length, 1);
      attempts++;

      if (!execState || execState.completed || execState.blocked) {
        continue; // Skip completed or blocked roles
      }

      const cfsm = this.getCFSMForRole(candidateRole);
      if (!cfsm) {
        continue;
      }

      const result = await this.stepRole(candidateRole, cfsm, execState);
      updates.set(candidateRole, result);
      selectedRole = candidateRole;

      // Handle DMst-specific actions
      if (result.success && result.messagesSent) {
        for (const msg of result.messagesSent) {
          await this.handleDMstAction(candidateRole, msg);
        }
      }

      break; // Stepped ONE role - done (fair scheduling)
    }

    // Check completion
    const completed = allParticipantsTerminated(this.state);
    const deadlocked = detectDMstDeadlock(this.state, this.transport);

    this.state.completed = completed;
    this.state.deadlocked = deadlocked;

    return {
      success: selectedRole !== null,
      updates,
      state: this.state,
      completed,
      deadlocked,
    };
  }

  /**
   * Run simulation to completion or max steps.
   *
   * @param maxSteps - Maximum steps (default: 1000)
   * @returns Final state
   */
  async run(maxSteps: number = 1000): Promise<DMstSimulationState> {
    let steps = 0;

    while (!this.state.completed && !this.state.deadlocked && steps < maxSteps) {
      await this.step();
      steps++;
    }

    if (steps >= maxSteps && !this.state.completed) {
      this.state.error = {
        type: 'deadlock',
        message: `Simulation exceeded max steps (${maxSteps})`,
      };
    }

    return this.state;
  }

  /**
   * Get current simulation state.
   */
  getState(): DMstSimulationState {
    return this.state;
  }

  /**
   * Reset simulation to initial state.
   */
  reset(): void {
    this.state = createDMstSimulationState(this.cfsms);
    // Clear transport messages
    // Note: InMemoryTransport doesn't have clear() yet, would need to add
  }

  // ==========================================================================
  // Private Implementation
  // ==========================================================================

  /**
   * Step a single role.
   *
   * Implements epsilon auto-advance and sub-protocol call stack semantics.
   * Loops through tau transitions until hitting an action or terminal state.
   * When reaching terminal state in a sub-protocol, pops the call stack
   * and returns to parent protocol context.
   */
  private async stepRole(
    role: string,
    cfsm: CFSM,
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    let messagesSent: Message[] = [];
    let messagesReceived: Message[] = [];
    let hadAction = false;

    // Get the current effective CFSM (may be sub-protocol CFSM if in call stack)
    const getCurrentCFSM = (): CFSM => {
      if (execState.callStack.length > 0) {
        // In a sub-protocol - look up the current sub-protocol CFSM
        const frame = execState.callStack[execState.callStack.length - 1];
        const subKey = `${role}_subprotocol_${frame.protocol}`;
        return this.cfsms.get(subKey) || cfsm;
      }
      return cfsm;
    };

    // Auto-advance through epsilon transitions until we hit an action or terminal
    while (true) {
      const currentCFSM = getCurrentCFSM();

      // Check if terminal - handle sub-protocol completion
      if (currentCFSM.terminalStates.includes(execState.currentState)) {
        // If in sub-protocol, pop call stack and return to parent
        if (execState.callStack.length > 0) {
          const frame = execState.callStack.pop()!;

          // Restore parent context
          execState.currentState = frame.returnState;
          execState.visitedStates.push(frame.returnState);

          // Pop from simulator's protocol call stack
          popProtocolCall(this.state.protocolCallStack);

          // Clean up temporary sub-protocol CFSM
          const subProtocolKey = `${role}_subprotocol_${frame.protocol}`;
          this.cfsms.delete(subProtocolKey);

          // Continue loop to execute in parent context
          continue;
        }

        // Root protocol completed
        execState.completed = true;
        return {
          success: true,
          newState: execState.currentState,
          messagesSent: messagesSent.length > 0 ? messagesSent : undefined,
          messagesConsumed: messagesReceived.length > 0 ? messagesReceived : undefined,
        };
      }

      // Find available transitions from current state
      const transitions = currentCFSM.transitions.filter(
        t => t.from === execState.currentState
      );

      if (transitions.length === 0) {
        // No transitions and not terminal - stuck state
        execState.blocked = true;
        return {
          success: false,
          error: {
            type: 'no-transition',
            message: `No transition from state ${execState.currentState}`,
            state: execState.currentState,
          },
        };
      }

      // Try first transition
      const transition = transitions[0];
      const action = transition.action;

      // Handle tau (epsilon) transition - auto-advance
      if (!action || action.type === 'tau') {
        execState.currentState = transition.to;
        execState.visitedStates.push(transition.to);
        continue;
      }

      // If we already executed an action and now hit another, return
      if (hadAction) {
        return {
          success: true,
          newState: execState.currentState,
          messagesSent: messagesSent.length > 0 ? messagesSent : undefined,
          messagesConsumed: messagesReceived.length > 0 ? messagesReceived : undefined,
        };
      }

      // Execute the action
      const result = await this.executeAction(role, action, execState);

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

      // Update state if action succeeded
      if (result.newState) {
        execState.currentState = result.newState;
        execState.visitedStates.push(result.newState);
      } else {
        // Take transition to next state
        execState.currentState = transition.to;
        execState.visitedStates.push(transition.to);
      }

      hadAction = true;
      // Continue loop to auto-advance through any subsequent tau transitions
    }
  }

  /**
   * Execute a CFSM action.
   */
  private async executeAction(
    role: string,
    action: CFSMAction,
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    switch (action.type) {
      case 'send':
        return this.executeSend(role, action as SendAction, execState);

      case 'receive':
        return this.executeReceive(role, action as ReceiveAction, execState);

      case 'tau':
        // Silent transition - just succeed
        return { success: true };

      case 'choice':
        // Internal choice - just succeed (branch already determined)
        return { success: true };

      case 'subprotocol':
        return this.executeProtocolCall(role, action as SubProtocolCallAction, execState);

      default:
        return {
          success: false,
          error: {
            type: 'protocol-violation',
            message: `Unknown action type: ${(action as any).type}`,
          },
        };
    }
  }

  /**
   * Execute send action.
   */
  private async executeSend(
    role: string,
    action: SendAction,
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    const message: Message = {
      id: `msg_${Date.now()}_${role}`,
      from: role,
      to: action.to,
      label: action.message.label,
      payload: action.message.payload,
      timestamp: Date.now(),
    };

    await this.transport.send(message);

    return {
      success: true,
      messagesSent: [message],
    };
  }

  /**
   * Execute receive action.
   */
  private async executeReceive(
    role: string,
    action: ReceiveAction,
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    // Check for matching message in queue
    const msg = await this.transport.receive(role);

    if (!msg) {
      // No message available - block
      execState.blocked = true;
      return {
        success: false,
        error: {
          type: 'message-not-ready',
          message: `Waiting for message: ${action.message.label} from ${action.from}`,
        },
      };
    }

    // Verify message matches expected action
    if (msg.label !== action.message.label || msg.from !== action.from) {
      return {
        success: false,
        error: {
          type: 'protocol-violation',
          message: `Expected ${action.message.label} from ${action.from}, got ${msg.label} from ${msg.from}`,
        },
      };
    }

    return {
      success: true,
      messagesConsumed: [msg],
    };
  }

  /**
   * Execute protocol call.
   *
   * Implements sub-protocol call stack semantics from ECOOP 2023, Definition 1:
   * p ↪→ x⟨q⟩ (caller p invokes protocol x with participants q)
   *
   * Algorithm:
   * 1. Look up sub-protocol CFSM from registry
   * 2. Map roles (formal params → actual args)
   * 3. Push CallStackFrame onto call stack
   * 4. Switch currentCFSM to sub-protocol CFSM
   * 5. Set currentState to sub-protocol initial state
   * 6. On sub-protocol completion, pop stack and restore parent context
   */
  private async executeProtocolCall(
    role: string,
    action: SubProtocolCallAction,
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    // Look up sub-protocol CFSMs from registry
    const protocolCFSMs = this.cfsmRegistry.get(action.protocol);
    if (!protocolCFSMs) {
      return {
        success: false,
        error: {
          type: 'protocol-violation',
          message: `Sub-protocol '${action.protocol}' not found in registry`,
          details: { protocol: action.protocol, role },
        },
      };
    }

    // Find the formal role corresponding to this actual role
    // The roleMapping maps: formalRole → actualRole
    const formalRole = Object.entries(action.roleMapping)
      .find(([formal, actual]) => actual === role)?.[0];

    if (!formalRole) {
      return {
        success: false,
        error: {
          type: 'protocol-violation',
          message: `Role '${role}' not found in role mapping for sub-protocol '${action.protocol}'`,
          details: { protocol: action.protocol, role, roleMapping: action.roleMapping },
        },
      };
    }

    // Get the CFSM for this role in the sub-protocol
    const subProtocolCFSM = protocolCFSMs.get(formalRole);
    if (!subProtocolCFSM) {
      return {
        success: false,
        error: {
          type: 'protocol-violation',
          message: `CFSM for role '${formalRole}' not found in sub-protocol '${action.protocol}'`,
          details: { protocol: action.protocol, formalRole, actualRole: role },
        },
      };
    }

    // Get the current CFSM for this role
    const currentCFSM = this.getCFSMForRole(role);
    if (!currentCFSM) {
      return {
        success: false,
        error: {
          type: 'protocol-violation',
          message: `No CFSM found for role '${role}'`,
        },
      };
    }

    // Create call stack frame for parent context
    const frame: ProtocolCallFrame = {
      protocol: action.protocol,
      caller: role,
      participants: new Map(Object.entries(action.roleMapping)),
      cfsms: new Map([[formalRole, currentCFSM]]),
      states: new Map([[role, { ...execState }]]),
      calledAt: Date.now(),
    };

    // Push frame onto protocol call stack
    pushProtocolCall(this.state.protocolCallStack, frame);

    // Switch execution context to sub-protocol
    // Store the sub-protocol CFSM for this role temporarily
    this.cfsms.set(`${role}_subprotocol_${action.protocol}`, subProtocolCFSM);

    // Update execution state to start at sub-protocol initial state
    execState.currentState = subProtocolCFSM.initialState;
    execState.visitedStates.push(subProtocolCFSM.initialState);
    execState.callStack.push({
      parentCFSM: currentCFSM,
      returnState: action.returnState,
      roleMapping: action.roleMapping,
      protocol: action.protocol,
    });

    return { success: true, newState: subProtocolCFSM.initialState };
  }

  /**
   * Check and handle sub-protocol completion.
   *
   * When a role reaches a terminal state in a sub-protocol,
   * pop the call stack and return to the parent protocol.
   */
  private handleSubProtocolCompletion(
    role: string,
    execState: ExecutionState,
    cfsm: CFSM
  ): boolean {
    // Check if current state is terminal in the current context
    if (!cfsm.terminalStates.includes(execState.currentState)) {
      return false;
    }

    // If we have a call stack, pop and return to parent
    if (execState.callStack.length > 0) {
      const frame = execState.callStack.pop()!;

      // Restore parent CFSM context
      execState.currentState = frame.returnState;
      execState.visitedStates.push(frame.returnState);

      // Pop from simulator's protocol call stack
      popProtocolCall(this.state.protocolCallStack);

      // Clean up temporary sub-protocol CFSM
      const subProtocolKey = `${role}_subprotocol_${frame.protocol}`;
      this.cfsms.delete(subProtocolKey);

      return true; // Handled - continue execution in parent context
    }

    // No call stack - truly at terminal state
    return false;
  }

  /**
   * Handle DMst-specific actions (creation, invitation).
   */
  private async handleDMstAction(role: string, msg: Message): Promise<void> {
    // Check if message is a creation action
    if (msg.label === 'create') {
      await this.handleCreation(role, msg);
    }

    // Check if message is an invitation action
    if (msg.label === 'invite') {
      await this.handleInvitation(role, msg);
    }
  }

  /**
   * Handle participant creation.
   */
  private async handleCreation(creator: string, msg: Message): Promise<void> {
    const to = typeof msg.to === 'string' ? msg.to : msg.to[0];

    // Extract role name from instance ID (e.g., "Worker_1" → "Worker")
    const roleName = to.split('_')[0];

    // Get CFSM template for this dynamic role
    const cfsmTemplate = this.dynamicCFSMs.get(roleName);
    if (!cfsmTemplate) {
      console.warn(`No CFSM template for dynamic role: ${roleName}`);
      return;
    }

    // Create dynamic participant
    const participant = createDynamicParticipant(
      this.state.dynamicParticipants,
      creator,
      roleName,
      cfsmTemplate,
      this.transport
    );

    // Record creation event
    const event: ParticipantCreationEvent = {
      type: 'participant-creation',
      timestamp: Date.now(),
      creator,
      roleName,
      instanceId: participant.instanceId,
    };
    this.state.creationEvents.push(event);
  }

  /**
   * Handle invitation.
   */
  private async handleInvitation(inviter: string, msg: Message): Promise<void> {
    const invitee = typeof msg.to === 'string' ? msg.to : msg.to[0];

    // Send invitation
    sendInvitation(this.state.dynamicParticipants, inviter, invitee, this.transport);
  }

  /**
   * Process pending invitations.
   */
  private async processPendingInvitations(): Promise<void> {
    const registry = this.state.dynamicParticipants;

    for (const [inviter, invitees] of registry.pendingInvitations.entries()) {
      for (const inviteeId of invitees) {
        const participant = registry.participants.get(inviteeId);
        if (!participant) continue;

        // Check if participant has received both create and invite messages
        const hasCreate = participant.state.pendingMessages.some(
          m => m.label === 'create'
        );
        const hasInvite = participant.state.pendingMessages.some(
          m => m.label === 'invite'
        );

        if (hasCreate && hasInvite) {
          // Complete invitation
          completeInvitation(registry, inviteeId);

          // Record event
          const event: InvitationCompleteEvent = {
            type: 'invitation-complete',
            timestamp: Date.now(),
            inviter,
            invitee: inviteeId,
          };
          this.state.invitationEvents.push(event);
        }
      }
    }
  }

  /**
   * Get CFSM for a role (static or dynamic).
   */
  private getCFSMForRole(role: string): CFSM | undefined {
    // Check static roles first
    if (this.cfsms.has(role)) {
      return this.cfsms.get(role);
    }

    // Check dynamic participants
    const participant = this.state.dynamicParticipants.participants.get(role);
    if (participant) {
      return participant.cfsm;
    }

    return undefined;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { DMstSimulator };
