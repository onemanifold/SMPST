/**
 * Distributed Simulator - Multi-Role Coordination
 *
 * Coordinates execution of multiple CFSMs running asynchronously.
 * Implements distributed execution semantics with message passing.
 *
 * ============================================================================
 * ARCHITECTURE
 * ============================================================================
 *
 * - Each role has its own CFSM simulator (local view)
 * - Global coordinator manages message delivery
 * - Messages sent asynchronously, delivered by coordinator
 * - FIFO channels: messages from A→B delivered in send order
 *
 * Execution Model:
 * 1. Select enabled role (scheduling strategy)
 * 2. Execute one transition in that role's CFSM
 * 3. Collect outgoing messages
 * 4. Deliver messages to recipient buffers
 * 5. Check for deadlock/completion
 * 6. Repeat
 *
 * Deadlock Detection:
 * - Deadlock: No role has enabled transitions
 * - Can happen due to circular waits in distributed setting
 * - Different from CFG's static deadlock freedom (which only checks role conflicts)
 *
 * References:
 * - Honda, Yoshida, Carbone (2008): Distributed implementation of session types
 * - Deadlock analysis in communicating systems
 */

import type { CFSM } from '../projection/types';
import { CFSMSimulator } from './cfsm-simulator';
import type {
  Message,
  DistributedSimulatorConfig,
  DistributedExecutionState,
  DistributedStepResult,
  DistributedRunResult,
  CFSMExecutionTrace,
  MessageBuffer,
} from './cfsm-simulator-types';

export class DistributedSimulator {
  private cfsms: Map<string, CFSM>;
  private simulators: Map<string, CFSMSimulator>;
  private config: Required<DistributedSimulatorConfig>;

  // Global state
  private globalSteps: number = 0;
  private inFlightMessages: Message[] = []; // Sent but not yet delivered
  private reachedMaxSteps: boolean = false;
  private deadlocked: boolean = false;

  // Scheduling state
  private lastScheduledRole: string | null = null;
  private roleScheduleCount: Map<string, number> = new Map();

  constructor(cfsms: Map<string, CFSM>, config: DistributedSimulatorConfig = {}) {
    this.cfsms = cfsms;
    this.config = {
      maxSteps: config.maxSteps ?? 1000,
      maxBufferSize: config.maxBufferSize ?? 0,
      deliveryModel: config.deliveryModel ?? 'fifo',
      recordTrace: config.recordTrace ?? false,
      schedulingStrategy: config.schedulingStrategy ?? 'round-robin',
      exploreAllInterleavings: config.exploreAllInterleavings ?? false,
    };

    // Create simulators
    this.simulators = new Map();
    for (const [role, cfsm] of cfsms) {
      this.simulators.set(
        role,
        new CFSMSimulator(cfsm, {
          maxSteps: config.maxSteps,
          maxBufferSize: config.maxBufferSize,
          recordTrace: config.recordTrace,
          transitionStrategy: 'first', // Distributed coordinator controls scheduling
        })
      );
      this.roleScheduleCount.set(role, 0);
    }
  }

  /**
   * Get current distributed state
   */
  getState(): DistributedExecutionState {
    const roleStates = new Map<string, string>();
    const roleSteps = new Map<string, number>();
    const roleBuffers = new Map<string, MessageBuffer>();

    for (const [role, sim] of this.simulators) {
      const state = sim.getState();
      roleStates.set(role, state.currentState);
      roleSteps.set(role, state.stepCount);
      roleBuffers.set(role, state.buffer);
    }

    const enabledRoles = this.getEnabledRoles();
    const allCompleted = Array.from(this.simulators.values()).every(sim => sim.isComplete());
    const anyCompleted = Array.from(this.simulators.values()).some(sim => sim.isComplete());

    return {
      roleStates,
      roleSteps,
      globalSteps: this.globalSteps,
      inFlightMessages: [...this.inFlightMessages],
      roleBuffers,
      anyCompleted,
      allCompleted,
      deadlocked: this.deadlocked,
      enabledRoles,
    };
  }

  /**
   * Get roles that can make progress (have enabled transitions)
   */
  private getEnabledRoles(): string[] {
    const enabled: string[] = [];

    for (const [role, sim] of this.simulators) {
      if (sim.isComplete()) continue;

      const transitions = sim.getEnabledTransitions();
      if (transitions.length > 0) {
        enabled.push(role);
      }
    }

    return enabled;
  }

  /**
   * Execute one global step (one role executes one transition)
   */
  step(): DistributedStepResult {
    // Check if done
    if (this.globalSteps >= this.config.maxSteps) {
      this.reachedMaxSteps = true;
      const error = {
        type: 'max-steps' as const,
        message: `Maximum global steps (${this.config.maxSteps}) reached`,
      };
      return { success: false, error, state: this.getState() };
    }

    // Get enabled roles
    const enabledRoles = this.getEnabledRoles();

    // Check for completion
    if (enabledRoles.length === 0) {
      const allComplete = Array.from(this.simulators.values()).every(sim => sim.isComplete());

      if (allComplete) {
        // Normal termination
        return { success: true, state: this.getState() };
      } else {
        // Deadlock - no one can progress but not all complete
        this.deadlocked = true;
        const error = {
          type: 'deadlock' as const,
          message: 'Distributed deadlock detected - no role can make progress',
          roles: Array.from(this.simulators.keys()).filter(r => !this.simulators.get(r)!.isComplete()),
        };
        return { success: false, error, state: this.getState() };
      }
    }

    // Select role to execute
    const role = this.selectRole(enabledRoles);
    const simulator = this.simulators.get(role)!;

    // Execute one step in selected role
    const result = simulator.step();

    if (!result.success) {
      return {
        success: false,
        role,
        error: {
          type: 'no-progress',
          message: `Role ${role} failed to step: ${result.error?.message}`,
          roles: [role],
          details: result.error,
        },
        state: this.getState(),
      };
    }

    this.globalSteps++;

    // Collect and deliver outgoing messages
    const messages = simulator.getOutgoingMessages();
    this.deliverMessages(messages);

    return {
      success: true,
      role,
      transition: result.transition,
      action: result.action,
      state: this.getState(),
    };
  }

  /**
   * Select which role to execute next
   */
  private selectRole(enabledRoles: string[]): string {
    if (enabledRoles.length === 0) {
      throw new Error('No enabled roles');
    }

    if (enabledRoles.length === 1) {
      return enabledRoles[0];
    }

    // Apply scheduling strategy
    switch (this.config.schedulingStrategy) {
      case 'round-robin': {
        // Find next role after last scheduled (round-robin)
        const roles = Array.from(this.simulators.keys());
        if (this.lastScheduledRole === null) {
          return enabledRoles[0];
        }

        const lastIndex = roles.indexOf(this.lastScheduledRole);
        for (let i = 1; i <= roles.length; i++) {
          const nextRole = roles[(lastIndex + i) % roles.length];
          if (enabledRoles.includes(nextRole)) {
            this.lastScheduledRole = nextRole;
            this.roleScheduleCount.set(nextRole, (this.roleScheduleCount.get(nextRole) || 0) + 1);
            return nextRole;
          }
        }
        return enabledRoles[0];
      }

      case 'fair': {
        // Execute role with fewest steps so far
        let minRole = enabledRoles[0];
        let minCount = this.roleScheduleCount.get(minRole) || 0;

        for (const role of enabledRoles) {
          const count = this.roleScheduleCount.get(role) || 0;
          if (count < minCount) {
            minRole = role;
            minCount = count;
          }
        }

        this.lastScheduledRole = minRole;
        this.roleScheduleCount.set(minRole, minCount + 1);
        return minRole;
      }

      case 'random': {
        const role = enabledRoles[Math.floor(Math.random() * enabledRoles.length)];
        this.lastScheduledRole = role;
        this.roleScheduleCount.set(role, (this.roleScheduleCount.get(role) || 0) + 1);
        return role;
      }

      case 'manual':
        throw new Error('Manual scheduling not yet implemented');

      default:
        return enabledRoles[0];
    }
  }

  /**
   * Deliver messages to recipient buffers
   */
  private deliverMessages(messages: Message[]): void {
    if (this.config.deliveryModel === 'fifo') {
      // FIFO: deliver in order
      for (const msg of messages) {
        this.deliverMessage(msg);
      }
    } else {
      // Unordered: can deliver in any order (for now just deliver all)
      for (const msg of messages) {
        this.deliverMessage(msg);
      }
    }
  }

  /**
   * Deliver one message to recipient
   */
  private deliverMessage(message: Message): void {
    const recipient = this.simulators.get(message.to);
    if (!recipient) {
      throw new Error(`Unknown recipient role: ${message.to}`);
    }

    try {
      recipient.deliverMessage(message);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Buffer overflow')) {
        throw new Error(`Buffer overflow delivering message to ${message.to}`);
      }
      throw error;
    }
  }

  /**
   * Run to completion (or deadlock/maxSteps)
   */
  run(): DistributedRunResult {
    while (!this.deadlocked && !this.reachedMaxSteps) {
      const enabled = this.getEnabledRoles();

      // Check if all done
      if (enabled.length === 0) {
        const allComplete = Array.from(this.simulators.values()).every(sim => sim.isComplete());
        if (allComplete) {
          // Success - all roles completed
          break;
        } else {
          // Deadlock
          this.deadlocked = true;
          const traces = this.getTraces();
          return {
            success: false,
            globalSteps: this.globalSteps,
            state: this.getState(),
            traces,
            error: {
              type: 'deadlock',
              message: 'Distributed deadlock - no role can progress',
              roles: Array.from(this.simulators.keys()).filter(r => !this.simulators.get(r)!.isComplete()),
            },
          };
        }
      }

      const result = this.step();

      if (!result.success && result.error?.type !== 'deadlock') {
        return {
          success: false,
          globalSteps: this.globalSteps,
          state: this.getState(),
          traces: this.getTraces(),
          error: result.error,
        };
      }

      if (result.error?.type === 'deadlock') {
        const traces = this.getTraces();
        return {
          success: false,
          globalSteps: this.globalSteps,
          state: this.getState(),
          traces,
          error: result.error,
        };
      }
    }

    const allComplete = Array.from(this.simulators.values()).every(sim => sim.isComplete());
    const traces = this.getTraces();

    return {
      success: allComplete && !this.deadlocked,
      globalSteps: this.globalSteps,
      state: this.getState(),
      traces,
    };
  }

  /**
   * Get execution traces for all roles
   */
  getTraces(): Map<string, CFSMExecutionTrace> {
    const traces = new Map<string, CFSMExecutionTrace>();
    for (const [role, sim] of this.simulators) {
      traces.set(role, sim.getTrace());
    }
    return traces;
  }

  /**
   * Reset all simulators
   */
  reset(): void {
    for (const sim of this.simulators.values()) {
      sim.reset();
    }
    this.globalSteps = 0;
    this.inFlightMessages = [];
    this.reachedMaxSteps = false;
    this.deadlocked = false;
    this.lastScheduledRole = null;
    for (const role of this.roleScheduleCount.keys()) {
      this.roleScheduleCount.set(role, 0);
    }
  }

  /**
   * Get simulator for specific role
   */
  getSimulator(role: string): CFSMSimulator | undefined {
    return this.simulators.get(role);
  }

  /**
   * Check if deadlocked
   */
  isDeadlocked(): boolean {
    return this.deadlocked;
  }

  /**
   * Check if all roles completed
   */
  isComplete(): boolean {
    return Array.from(this.simulators.values()).every(sim => sim.isComplete());
  }
}
