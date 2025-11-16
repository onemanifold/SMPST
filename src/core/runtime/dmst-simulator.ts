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
import { DMstExecutor, type DMstExecutorConfig } from './dmst-executor';

// ============================================================================
// DMst Simulator
// ============================================================================

/**
 * DMst-aware multi-role protocol simulator.
 *
 * ARCHITECTURE (Executor Pattern):
 * - Simulator orchestrates multiple DMstExecutor instances
 * - Each executor manages one role's CFSM execution
 * - Simulator handles:
 *   - Fair scheduling (round-robin)
 *   - Dynamic participant creation
 *   - Invitation synchronization
 *   - Completion/deadlock detection
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
export class DMstSimulator {
  private state: DMstSimulationState;
  private transport: MessageTransport;
  private cfsms: Map<string, CFSM>; // Static role CFSMs
  private dynamicCFSMs: Map<string, CFSM>; // Dynamic role type → CFSM template

  // Executor pattern: One executor per role
  private executors: Map<string, DMstExecutor> = new Map();

  // Fair scheduling: Round-robin role selection
  private nextRoleIndex: number = 0;
  private roleNames: string[] = [];

  // CFSM registry for sub-protocol calls
  private cfsmRegistry: Map<string, Map<string, CFSM>> = new Map();

  // Observer pattern: Event notification (Sprint 2, Issue #5)
  private observers: Set<DMstExecutionObserver> = new Set();

  // Trace recording: Execution history (Sprint 2, Issue #6)
  private trace: DMstExecutionTrace;
  private recordTrace: boolean = false;

  // Pause/resume: Run control (Sprint 2, Issue #7)
  private currentRunPause: (() => void) | null = null;

  constructor(
    staticRoles: Map<string, CFSM>,
    dynamicRoles: Map<string, CFSM> = new Map(),
    transport?: MessageTransport,
    cfsmRegistry?: Map<string, Map<string, CFSM>>,
    options?: {
      recordTrace?: boolean;
    }
  ) {
    this.state = createDMstSimulationState(staticRoles);
    this.transport = transport || new InMemoryTransport();
    this.cfsms = staticRoles;
    this.dynamicCFSMs = dynamicRoles;
    this.cfsmRegistry = cfsmRegistry || new Map();
    this.recordTrace = options?.recordTrace || false;

    // Initialize trace
    this.trace = {
      events: [],
      startTime: Date.now(),
      completed: false,
    };

    // Create executor for each static role
    this.roleNames = Array.from(staticRoles.keys()).sort();
    for (const [role, cfsm] of staticRoles.entries()) {
      const config: DMstExecutorConfig = {
        role,
        cfsm,
        transport: this.transport,
        cfsmRegistry: this.cfsmRegistry,
        dynamicRegistry: this.state.dynamicParticipants,
        dynamicCFSMs: this.dynamicCFSMs,
      };
      this.executors.set(role, new DMstExecutor(config));
    }

    // Add trace recorder if enabled
    if (this.recordTrace) {
      this.addTraceRecorder();
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

  /**
   * Run simulation to completion or max steps.
   *
   * Repeatedly calls step() until:
   * - All roles completed
   * - Deadlock detected
   * - Max steps reached
   * - Pause requested
   *
   * PAUSE/RESUME (Sprint 2, Issue #7):
   * - Uses run-specific closure variable for pause signal
   * - Calling pause() sets signal for current run() only
   * - Signal auto-cleared when run() exits
   * - Internal state preserved between runs
   *
   * @param maxSteps - Maximum steps (default: 1000)
   * @returns Final state
   */
  async run(maxSteps: number = 1000): Promise<DMstSimulationState> {
    let steps = 0;

    // Run-specific pause signal (closure variable)
    let pauseRequested = false;

    // Expose pause setter for this specific run() invocation
    this.currentRunPause = () => { pauseRequested = true; };

    try {
      while (!this.state.completed && !this.state.deadlocked && steps < maxSteps && !pauseRequested) {
        await this.step();
        steps++;

        // Yield to event loop to allow pause() and other async operations
        await new Promise(resolve => setImmediate(resolve));
      }

      if (steps >= maxSteps && !this.state.completed) {
        this.state.error = {
          type: 'deadlock',
          message: `Simulation exceeded max steps (${maxSteps})`,
        };
      }

      // Update trace completion status
      if (this.state.completed) {
        this.trace.completed = true;
        this.trace.endTime = Date.now();
      }

      return this.state;
    } finally {
      // Clear run-specific pause handler (auto-cleanup)
      this.currentRunPause = null;
    }
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
      dynamicRegistry: this.state.dynamicParticipants,
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
    const pending = this.state.dynamicParticipants.pendingInvitations.get(inviter) || [];
    if (!pending.includes(invitee)) {
      pending.push(invitee);
      this.state.dynamicParticipants.pendingInvitations.set(inviter, pending);
    }
  }

  /**
   * Process pending invitations.
   *
   * Checks if dynamic participants have received both create and invite,
   * and completes invitation if so.
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
  pause(): void {
    if (this.currentRunPause) {
      this.currentRunPause();  // Set current run's pause signal
    }
  }
}

