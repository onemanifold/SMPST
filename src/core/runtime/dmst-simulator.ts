/**
 * DMst Simulator - Extended Multi-Role Protocol Execution
 *
 * Extends the standard simulator pattern to handle:
 * - Dynamic participant creation during execution
 * - Invitation protocol synchronization
 * - Protocol call nesting (via DMstExecutor)
 * - Updatable recursion with growing participant sets (Sprint 3)
 *
 * Based on Castro-Perez & Yoshida (ECOOP 2023) operational semantics.
 *
 * SPRINT 1 STATUS (✅ COMPLETE):
 * - ✅ Executor pattern implemented (Issue #4)
 * - ✅ Fair scheduling implemented (Issue #2)
 * - ✅ Epsilon auto-advance (via DMstExecutor) (Issue #3)
 * - ✅ Sub-protocol call stack (via DMstExecutor) (Issue #1)
 *
 * SPRINT 2 STATUS (🚧 IN PROGRESS):
 * - ✅ Observer pattern (Issue #5)
 * - ✅ Trace recording (Issue #6)
 * - ✅ Pause/resume (Issue #7)
 * - ⏸️ Comprehensive tests (Issue #9) - separate test file
 *
 * SPRINT 3 (FUTURE):
 * - ⏸️ Updatable CFSM runtime (Issue #8)
 */

import type { CFSM } from '../projection/types';
import type {
  MessageTransport,
  Message,
  SimulationStepResult,
  ExecutionResult,
  SimulatorConfig,
} from './types';
import type {
  DMstSimulationState,
  ParticipantCreationEvent,
  InvitationCompleteEvent,
} from './dmst-runtime';
import type {
  DMstExecutionObserver,
  DMstExecutionTrace,
} from './dmst-types';
import {
  createDMstSimulationState,
  createDynamicParticipant,
  completeInvitation,
  allParticipantsTerminated,
  detectDMstDeadlock,
} from './dmst-runtime';
import { InMemoryTransport } from './transport';
import { Simulator } from './simulator';
import { DMstExecutor, type DMstExecutorConfig } from './dmst-executor';
import {
  createVersionRegistry,
  registerInitialVersion,
  registerCFSMUpdate,
  type CFSMVersionRegistry,
  type CFSMUpdate,
} from './versioned-cfsm';

// ============================================================================
// DMst Simulator
// ============================================================================

/**
 * DMst-aware multi-role protocol simulator.
 *
 * ARCHITECTURE (Extends Simulator):
 * - Extends base Simulator with DMst-specific capabilities
 * - Inherits: fair scheduling, trace recording, observers, pause/resume
 * - Adds: dynamic participants, version management, invitation protocol
 *
 * - Simulator orchestrates multiple DMstExecutor instances
 * - Each executor manages one role's CFSM execution
 * - Simulator handles:
 *   - Fair scheduling (round-robin) - inherited
 *   - Dynamic participant creation - DMst-specific
 *   - Invitation synchronization - DMst-specific
 *   - Completion/deadlock detection - overridden for DMst
 * - Executor handles:
 *   - Epsilon auto-advance
 *   - Sub-protocol call stack
 *   - Action execution (send, receive, create, invite)
 *
 * FORMAL SEMANTICS (Honda et al. 2008):
 * - One step() = ONE role executes ONE action
 * - Fair scheduling ensures all roles eventually execute
 * - Round-robin prevents starvation
 */
export class DMstSimulator extends Simulator<DMstExecutionTrace, DMstSimulationState> {
  // DMst-specific state (now properly typed via generic parameter)
  protected state: DMstSimulationState;

  // DMst-specific fields
  private cfsms: Map<string, CFSM>; // Static role CFSMs
  private dynamicCFSMs: Map<string, CFSM>; // Dynamic role type → CFSM template
  private cfsmRegistry: Map<string, Map<string, CFSM>> = new Map();

  // Sprint 3: Version registry for updatable recursion
  private versionRegistry: CFSMVersionRegistry;
  private protocolName: string;

  constructor(
    staticRoles: Map<string, CFSM>,
    dynamicRoles: Map<string, CFSM> = new Map(),
    transport?: MessageTransport,
    cfsmRegistry?: Map<string, Map<string, CFSM>>,
    options?: {
      recordTrace?: boolean;
      protocolName?: string;  // Sprint 3: Protocol name for version registry
    }
  ) {
    // Call base Simulator constructor
    super({
      roles: staticRoles,
      transport,
      options: {
        recordTrace: options?.recordTrace,
        maxSteps: 1000,
        strictMode: false,
      },
    });

    // Initialize DMst-specific state
    this.state = createDMstSimulationState(staticRoles);
    this.cfsms = staticRoles;
    this.dynamicCFSMs = dynamicRoles;
    this.cfsmRegistry = cfsmRegistry || new Map();
    this.protocolName = options?.protocolName || 'UnnamedProtocol';

    // Sprint 3: Initialize version registry
    this.versionRegistry = createVersionRegistry();

    // Replace base Executors with DMstExecutors
    this.executors.clear();
    for (const [role, cfsm] of staticRoles.entries()) {
      // Sprint 3: Register initial version (v1)
      registerInitialVersion(this.versionRegistry, this.protocolName, role, cfsm);

      const config: DMstExecutorConfig = {
        role,
        cfsm,
        transport: this.transport,
        cfsmRegistry: this.cfsmRegistry,
        dynamicParticipants: this.state.dynamicParticipants,
        nextInstanceId: this.state.nextInstanceId,
        dynamicCFSMs: this.dynamicCFSMs,
        // Sprint 3: Version tracking
        cfsmVersion: 1,
        protocolName: this.protocolName,
      };
      this.executors.set(role, new DMstExecutor(config));
    }
  }

  /**
   * Execute one step of the simulation.
   *
   * FAIR SCHEDULING (Honda et al. 2008):
   * - Steps ONE role per call (not all roles)
   * - Uses round-robin to select next ready role
   * - Skips completed roles
   * - Returns after ONE role executes ONE transition
   *
   * DMst EXTENSIONS:
   * - Processes pending invitations before stepping
   * - Handles dynamic participant creation
   * - Updates participant registry
   *
   * @param targetRole - Optional specific role to step
   * @returns Step result with updates
   */
  async step(targetRole?: string): Promise<SimulationStepResult> {
    this.state.step++;

    // Process pending invitations (DMst-specific)
    await this.processPendingInvitations();

    const updates = new Map<string, ExecutionResult>();
    let selectedRole: string | null = null;

    if (targetRole) {
      // Step specific role
      const executor = this.executors.get(targetRole);
      if (!executor) {
        return {
          success: false,
          updates,
          state: this.state,
        };
      }

      const result = await executor.step();
      updates.set(targetRole, result);
      selectedRole = targetRole;

      // Handle DMst-specific actions
      await this.handleDMstMessages(targetRole, result);
    } else {
      // Fair scheduling: Round-robin through all roles
      let attempts = 0;

      while (attempts < this.roleNames.length) {
        const candidateRole = this.roleNames[this.nextRoleIndex];

        // Move to next role for next time (round-robin)
        this.nextRoleIndex = (this.nextRoleIndex + 1) % this.roleNames.length;
        attempts++;

        const executor = this.executors.get(candidateRole);
        if (!executor) continue;

        // Skip completed roles
        if (executor.getState().completed) {
          continue;
        }

        // Try to step this role
        const result = await executor.step();
        updates.set(candidateRole, result);
        selectedRole = candidateRole;

        // Handle DMst-specific actions
        await this.handleDMstMessages(candidateRole, result);

        break; // Stepped ONE role - done
      }

      // If no role could step, all are completed or blocked
      if (!selectedRole) {
        // Check completion/deadlock
        const completed = allParticipantsTerminated(this.state);
        const deadlocked = detectDMstDeadlock(this.state, this.transport);

        this.state.completed = completed;
        this.state.deadlocked = deadlocked;

        return {
          success: false,
          updates,
          state: this.state,
          completed,
          deadlocked,
        };
      }
    }

    // Update state from executors
    this.syncStateFromExecutors();

    // Check completion/deadlock
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

  // Note: run() method inherited from Simulator base class
  // The inherited run() calls our overridden step() method

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
    this.nextRoleIndex = 0;

    // Reset all executors
    for (const executor of this.executors.values()) {
      executor.reset();
    }

    // Clear dynamic executors (they'll be recreated during execution)
    const staticRoles = new Set(this.cfsms.keys());
    for (const role of this.executors.keys()) {
      if (!staticRoles.has(role)) {
        this.executors.delete(role);
      }
    }

    // Reset role names to static roles only
    this.roleNames = Array.from(this.cfsms.keys()).sort();

    // Reset trace
    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
    };

    // Clear any active pause handler
    this.currentRunPause = null;
  }

  // ==========================================================================
  // Private Implementation
  // ==========================================================================

  /**
   * Sync simulation state from executors.
   *
   * Updates this.state.roles with current executor states.
   */
  private syncStateFromExecutors(): void {
    for (const [role, executor] of this.executors.entries()) {
      const execState = executor.getState();
      // Only update static roles (dynamic participants have separate state)
      if (this.state.roles.has(role)) {
        this.state.roles.set(role, execState);
      }
    }
  }

  /**
   * Handle DMst-specific messages (create, invite).
   *
   * Checks execution result for creation/invitation messages
   * and updates participant registry accordingly.
   *
   * @param role - Role that produced the messages
   * @param result - Execution result containing messages
   */
  private async handleDMstMessages(
    role: string,
    result: ExecutionResult
  ): Promise<void> {
    if (!result.success || !result.messagesSent) {
      return;
    }

    for (const msg of result.messagesSent) {
      if (msg.label === 'create') {
        await this.handleCreation(role, msg);
      } else if (msg.label === 'invite') {
        await this.handleInvitation(role, msg);
      } else if (msg.label === 'continue-with') {
        // Sprint 3: Handle protocol update
        await this.handleContinueWith(role, msg);
      }
    }
  }

  /**
   * Handle participant creation.
   *
   * Creates new dynamic participant and executor.
   *
   * @param creator - Role that created the participant
   * @param msg - Creation message
   */
  private async handleCreation(creator: string, msg: Message): Promise<void> {
    const payload = msg.payload;
    if (!payload || !payload.role || !payload.instanceId) {
      console.warn('[DMstSimulator] Invalid creation message payload');
      return;
    }

    const roleName = payload.role;
    const instanceId = payload.instanceId;

    // Get CFSM template for this dynamic role
    const cfsmTemplate = this.dynamicCFSMs.get(roleName);
    if (!cfsmTemplate) {
      console.warn(`[DMstSimulator] No CFSM template for dynamic role: ${roleName}`);
      return;
    }

    // Create dynamic participant
    const participant = createDynamicParticipant(
      this.state.dynamicParticipants,
      this.state.nextInstanceId,
      creator,
      roleName,
      cfsmTemplate,
      this.transport
    );

    // Create executor for dynamic participant
    const config: DMstExecutorConfig = {
      role: instanceId,
      cfsm: cfsmTemplate,
      transport: this.transport,
      cfsmRegistry: this.cfsmRegistry,
      dynamicParticipants: this.state.dynamicParticipants,
      nextInstanceId: this.state.nextInstanceId,
      dynamicCFSMs: this.dynamicCFSMs,
    };
    const executor = new DMstExecutor(config);
    this.executors.set(instanceId, executor);

    // Add to role names for fair scheduling (maintain sorted order)
    this.roleNames.push(instanceId);
    this.roleNames.sort();

    // Adjust nextRoleIndex if insertion before current position
    const insertIndex = this.roleNames.indexOf(instanceId);
    if (insertIndex < this.nextRoleIndex) {
      this.nextRoleIndex++;
    }

    // Record creation event
    const event: ParticipantCreationEvent = {
      type: 'participant-creation',
      timestamp: Date.now(),
      creator,
      roleName,
      instanceId: participant.instanceId,
    };
    this.state.creationEvents.push(event);

    // Notify observers (Sprint 2, Issue #5)
    this.notifyParticipantCreation(event);
  }

  /**
   * Handle invitation.
   *
   * Registers pending invitation in registry.
   *
   * @param inviter - Role sending invitation
   * @param msg - Invitation message
   */
  private async handleInvitation(inviter: string, msg: Message): Promise<void> {
    const invitee = typeof msg.to === 'string' ? msg.to : msg.to[0];

    // Register pending invitation
    const pending = this.state.pendingInvitations.get(inviter) || [];
    if (!pending.includes(invitee)) {
      pending.push(invitee);
      this.state.pendingInvitations.set(inviter, pending);
    }
  }

  /**
   * Handle continue-with (protocol update).
   *
   * Sprint 3: Implements updatable recursion.
   *
   * From ECOOP 2023 Section 3.2:
   * When a role executes `continue X with { G }`, the protocol is updated
   * for ALL roles. This creates a new CFSM version with the extension
   * sequenced before the original recursion body.
   *
   * Implementation:
   * 1. Extract update information from message
   * 2. For each role, create extended CFSM
   * 3. Register new version in version registry
   * 4. Broadcast update to all active executors
   * 5. Executors swap to new CFSM version atomically
   *
   * @param updater - Role that triggered the update
   * @param msg - Continue-with message
   */
  private async handleContinueWith(updater: string, msg: Message): Promise<void> {
    const payload = msg.payload;
    if (!payload || !payload.recursionVar || !payload.extension) {
      console.warn('[DMstSimulator] Invalid continue-with message payload');
      return;
    }

    const { recursionVar, extension, currentVersion } = payload;

    // For each role, register and apply update
    // Note: In a full implementation, we'd project the extension to each role's local type
    // For now, we assume the extension CFSM is already role-specific
    for (const [roleName, executor] of this.executors.entries()) {
      try {
        // Create update descriptor
        const update: CFSMUpdate = {
          protocolName: this.protocolName,
          roleName,
          recursionVar,
          extension,  // In full implementation: project extension to this role
          targetVersion: currentVersion,
        };

        // Register update and get new version number
        const newVersion = registerCFSMUpdate(this.versionRegistry, update);

        // Get new CFSM from registry
        const versionedCFSM = this.versionRegistry.versions
          .get(`${this.protocolName}:${roleName}`)
          ?.find(v => v.version === newVersion);

        if (!versionedCFSM) {
          console.warn(`[DMstSimulator] Failed to retrieve version ${newVersion} for ${roleName}`);
          continue;
        }

        // Apply update to executor (atomic CFSM swap)
        executor.applyCFSMUpdate(versionedCFSM.cfsm, newVersion);

      } catch (error) {
        console.error(`[DMstSimulator] Failed to apply update to ${roleName}:`, error);
      }
    }

    // TODO Sprint 3: Add trace event for protocol update
    // TODO Sprint 3: Notify observers of protocol update
  }

  /**
   * Process pending invitations.
   *
   * Checks if dynamic participants have received both create and invite,
   * and completes invitation if so.
   */
  private async processPendingInvitations(): Promise<void> {
    for (const [inviter, invitees] of this.state.pendingInvitations.entries()) {
      for (const inviteeId of invitees) {
        const participant = this.state.dynamicParticipants.get(inviteeId);
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
          completeInvitation(
            this.state.dynamicParticipants,
            this.state.pendingInvitations,
            inviteeId
          );

          // Record event
          const event: InvitationCompleteEvent = {
            type: 'invitation-complete',
            timestamp: Date.now(),
            inviter,
            invitee: inviteeId,
          };
          this.state.invitationEvents.push(event);

          // Notify observers (Sprint 2, Issue #5)
          this.notifyInvitationComplete(event);
        }
      }
    }
  }

  // ==========================================================================
  // Observer Pattern & Trace Recording (Sprint 2, Issues #5 & #6)
  // ==========================================================================

  /**
   * Add an observer to receive execution events.
   *
   * Observers receive notifications for:
   * - Standard MPST events (state change, message sent/received, errors)
   * - DMst-specific events (participant creation, invitation complete)
   *
   * Observers are propagated to all executors (including dynamic participants).
   *
   * @param observer - Observer to add
   */
  addObserver(observer: DMstExecutionObserver): void {
    this.observers.add(observer);

    // Propagate observer to all executors so they can fire events
    for (const executor of this.executors.values()) {
      executor.addObserver(observer);
    }
  }

  /**
   * Remove an observer.
   *
   * @param observer - Observer to remove
   */
  removeObserver(observer: DMstExecutionObserver): void {
    this.observers.delete(observer);

    // Propagate removal to all executors
    for (const executor of this.executors.values()) {
      executor.removeObserver(observer);
    }
  }

  /**
   * Get execution trace.
   *
   * Returns a copy of the trace with all recorded events.
   * Includes both standard MPST events and DMst-specific events.
   *
   * @returns Execution trace
   */
  getTrace(): DMstExecutionTrace {
    return {
      ...this.trace,
      events: [...this.trace.events],
    };
  }

  /**
   * Add trace recorder observer.
   *
   * Creates an observer that records all events to the trace.
   * Called automatically if recordTrace option is true.
   */
  private addTraceRecorder(): void {
    const recorder: DMstExecutionObserver = {
      onStateChange: (event) => {
        this.trace.events.push(event);
      },
      onMessageSent: (event) => {
        this.trace.events.push(event);
      },
      onMessageReceived: (event) => {
        this.trace.events.push(event);
      },
      onError: (event) => {
        this.trace.events.push(event);
      },
      onParticipantCreation: (event) => {
        this.trace.events.push(event);
      },
      onInvitationComplete: (event) => {
        this.trace.events.push(event);
      },
    };

    // Register the observer so it gets propagated to all executors
    this.addObserver(recorder);
  }

  /**
   * Notify observers of participant creation.
   *
   * @param event - Participant creation event
   */
  private notifyParticipantCreation(event: ParticipantCreationEvent): void {
    this.observers.forEach(observer => {
      observer.onParticipantCreation?.(event);
    });
  }

  /**
   * Notify observers of invitation completion.
   *
   * @param event - Invitation complete event
   */
  private notifyInvitationComplete(event: InvitationCompleteEvent): void {
    this.observers.forEach(observer => {
      observer.onInvitationComplete?.(event);
    });
  }

  // ==========================================================================
  // Pause/Resume Control (Sprint 2, Issue #7)
  // ==========================================================================

  /**
   * Pause current run() execution.
   *
   * Sets pause signal for current run() invocation only.
   * If no run() is active, this has no effect.
   *
   * Internal state (stepCount, executor positions) is preserved,
   * allowing resumption by calling run() again.
   */
  // Note: pause() method inherited from Simulator base class
}

