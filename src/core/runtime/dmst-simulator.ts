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
 */

import type { CFSM, CFSMAction, SendAction, ReceiveAction } from '../projection/types';
import type {
  MessageTransport,
  Message,
  ExecutionState,
  ExecutionResult,
  ExecutionError,
  SimulationStepResult,
  ExecutorConfig,
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

  constructor(
    staticRoles: Map<string, CFSM>,
    dynamicRoles: Map<string, CFSM> = new Map(),
    transport?: MessageTransport
  ) {
    this.state = createDMstSimulationState(staticRoles);
    this.transport = transport || new InMemoryTransport();
    this.cfsms = staticRoles;
    this.dynamicCFSMs = dynamicRoles;
  }

  /**
   * Execute one step of the simulation.
   *
   * Strategy:
   * 1. Process pending invitations
   * 2. Step all ready participants
   * 3. Handle creation/invitation actions
   * 4. Detect completion/deadlock
   *
   * @returns Step result with updates
   */
  async step(): Promise<SimulationStepResult> {
    this.state.step++;

    // Process pending invitations
    await this.processPendingInvitations();

    // Get all active participants
    const allParticipants = getAllActiveParticipants(this.state);

    const updates = new Map<string, ExecutionResult>();

    // Step each participant
    for (const [role, execState] of allParticipants) {
      if (execState.completed || execState.blocked) {
        continue; // Skip completed or blocked roles
      }

      const cfsm = this.getCFSMForRole(role);
      if (!cfsm) {
        continue;
      }

      const result = await this.stepRole(role, cfsm, execState);
      updates.set(role, result);

      // Handle DMst-specific actions
      if (result.success && result.messagesSent) {
        for (const msg of result.messagesSent) {
          await this.handleDMstAction(role, msg);
        }
      }
    }

    // Check completion
    const completed = allParticipantsTerminated(this.state);
    const deadlocked = detectDMstDeadlock(this.state, this.transport);

    this.state.completed = completed;
    this.state.deadlocked = deadlocked;

    return {
      success: true,
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
   */
  private async stepRole(
    role: string,
    cfsm: CFSM,
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    // Find available transitions from current state
    const transitions = cfsm.transitions.filter(t => t.from === execState.currentState);

    if (transitions.length === 0) {
      // No transitions - check if terminal
      if (cfsm.terminalStates.includes(execState.currentState)) {
        execState.completed = true;
        return { success: true };
      }

      // Stuck state
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

    // Try first transition (deterministic CFSM assumption)
    const transition = transitions[0];
    const action = transition.action;

    // Handle action
    const result = await this.executeAction(role, action, execState);

    if (result.success && result.newState) {
      execState.currentState = result.newState;
      execState.visitedStates.push(result.newState);

      // Check if reached terminal
      if (cfsm.terminalStates.includes(result.newState)) {
        execState.completed = true;
      }
    }

    return result;
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

      case 'subprotocol-call':
        return this.executeProtocolCall(role, action, execState);

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
   */
  private async executeProtocolCall(
    role: string,
    action: any, // SubProtocolCallAction
    execState: ExecutionState
  ): Promise<ExecutionResult> {
    // TODO: Implement protocol call stack semantics
    // For now, just succeed (placeholder)
    return { success: true };
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
