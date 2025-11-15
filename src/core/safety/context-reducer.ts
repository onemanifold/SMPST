/**
 * ContextReducer - Implements reduction semantics for typing contexts
 *
 * Used to prove Theorem 4.6 (Subject Reduction):
 * If Γ⊢P with Γ safe, and P→P', then ∃Γ' safe with Γ→*Γ' and Γ'⊢P'
 *
 * The reducer advances the typing context by executing enabled communications.
 * This is the operational semantics of the session type system.
 *
 * REDUCTION RULE:
 * ```
 * p at state q --send(r,m)--> q'
 * r at state s --receive(p,m)--> s'
 * ────────────────────────────────────
 * Γ → Γ' where Γ'(p)=q', Γ'(r)=s'
 * ```
 *
 * @reference Scalas, A., & Yoshida, N. (2019). Less is More: Multiparty
 *            Session Types Revisited. POPL 2019, Section 4.2.
 */

import type {
  TypingContext,
  CFSMInstance,
  Communication,
  EnabledCommunications,
} from './types';

import type {
  CFSM,
  CFSMTransition,
  SendAction,
  ReceiveAction,
} from '../projection/types';

import { applyTauTransitions } from './utils';

/**
 * ContextReducer - Advances typing contexts through protocol execution
 *
 * Implements the reduction semantics Γ → Γ' from the paper.
 * Used to verify Subject Reduction (Theorem 4.6).
 */
export class ContextReducer {
  /**
   * Reduce context by one communication step
   *
   * Finds an enabled communication and executes it, advancing
   * both the sender and receiver to their successor states.
   *
   * NON-DETERMINISTIC: If multiple communications are enabled,
   * this picks one arbitrarily. For complete exploration, use
   * `findAllSuccessors()` instead.
   *
   * @param context - Current typing context
   * @returns New context after one reduction step
   * @throws Error if context is terminal or stuck
   */
  reduce(context: TypingContext): TypingContext {
    const enabled = this.findEnabledCommunications(context);

    if (enabled.terminal) {
      throw new Error('Cannot reduce terminal context (all roles at terminal states)');
    }

    if (enabled.stuck) {
      throw new Error('Cannot reduce stuck context (no enabled communications)');
    }

    // Pick first enabled communication (arbitrary choice)
    const comm = enabled.communications[0];
    return this.reduceBy(context, comm);
  }

  /**
   * Reduce context by a specific communication
   *
   * @param context - Current context
   * @param comm - Communication to execute
   * @returns New context after executing communication
   */
  reduceBy(context: TypingContext, comm: Communication): TypingContext {
    const newCFSMs = new Map(context.cfsms);

    // Advance sender's CFSM
    const senderInstance = context.cfsms.get(comm.sender)!;
    const senderTrans = this.findTransition(
      senderInstance.machine,
      comm.senderTransition
    );
    newCFSMs.set(comm.sender, {
      machine: senderInstance.machine,
      currentState: senderTrans.to,
    });

    // Advance receiver's CFSM
    const receiverInstance = context.cfsms.get(comm.receiver)!;
    const receiverTrans = this.findTransition(
      receiverInstance.machine,
      comm.receiverTransition
    );
    newCFSMs.set(comm.receiver, {
      machine: receiverInstance.machine,
      currentState: receiverTrans.to,
    });

    let newContext = {
      session: context.session,
      cfsms: newCFSMs,
    };

    // Apply tau transitions eagerly for all roles
    // Uses shared function from utils to ensure consistent tau handling
    newContext = applyTauTransitions(newContext);

    return newContext;
  }

  /**
   * Find all successor contexts (non-deterministic reduction)
   *
   * Returns all possible contexts reachable in one step.
   * Used for complete state space exploration.
   *
   * @param context - Current context
   * @returns Array of successor contexts (one per enabled communication)
   */
  findAllSuccessors(context: TypingContext): TypingContext[] {
    const enabled = this.findEnabledCommunications(context);
    return enabled.communications.map((comm) => this.reduceBy(context, comm));
  }

  /**
   * Find all enabled communications in a context
   *
   * A communication is enabled if:
   * - Role p has an enabled send p→q:m
   * - Role q has an enabled receive q←p:m
   *
   * @param context - Current context
   * @returns Enabled communications with terminal/stuck flags
   */
  findEnabledCommunications(context: TypingContext): EnabledCommunications {
    const communications: Communication[] = [];

    // Check if terminal (all roles at terminal states)
    const terminal = this.isTerminal(context);
    if (terminal) {
      return { communications: [], terminal: true, stuck: false };
    }

    // Find all matching send/receive pairs
    for (const [roleP, instanceP] of context.cfsms) {
      const { machine: cfsmP, currentState: stateP } = instanceP;
      const enabledSends = this.getEnabledSends(cfsmP, stateP);

      for (const sendTrans of enabledSends) {
        const sendAction = sendTrans.action as SendAction;
        const receivers = Array.isArray(sendAction.to)
          ? sendAction.to
          : [sendAction.to];

        for (const roleQ of receivers) {
          const instanceQ = context.cfsms.get(roleQ);
          if (!instanceQ) continue;

          const { machine: cfsmQ, currentState: stateQ } = instanceQ;
          const msgLabel = sendAction.message.label;

          const receiveTrans = this.findMatchingReceive(
            cfsmQ,
            stateQ,
            roleP,
            msgLabel
          );

          if (receiveTrans) {
            communications.push({
              sender: roleP,
              receiver: roleQ,
              message: msgLabel,
              payloadType: sendAction.message.payload?.payloadType,
              senderTransition: sendTrans.id,
              receiverTransition: receiveTrans.id,
            });
          }
        }
      }
    }

    // Context is stuck if not terminal but no enabled communications
    const stuck = !terminal && communications.length === 0;

    return { communications, terminal, stuck };
  }

  /**
   * Check if context is terminal (all roles at terminal states)
   *
   * @param context - Context to check
   * @returns True if all roles at terminal states
   */
  isTerminal(context: TypingContext): boolean {
    for (const [_role, instance] of context.cfsms) {
      if (!instance.machine.terminalStates.includes(instance.currentState)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Execute protocol to completion
   *
   * Repeatedly reduces until terminal or stuck.
   * Returns trace of all contexts visited.
   *
   * @param initial - Initial context
   * @param maxSteps - Maximum steps to prevent infinite loops (default 1000)
   * @returns Trace of contexts from initial to final
   * @throws Error if maxSteps exceeded
   */
  executeToCompletion(
    initial: TypingContext,
    maxSteps: number = 1000
  ): TypingContext[] {
    const trace: TypingContext[] = [initial];
    let current = initial;
    let steps = 0;

    while (!this.isTerminal(current)) {
      if (steps >= maxSteps) {
        throw new Error(`Execution exceeded maximum steps (${maxSteps})`);
      }

      const enabled = this.findEnabledCommunications(current);
      if (enabled.stuck) {
        throw new Error('Protocol stuck (no enabled communications)');
      }

      current = this.reduce(current);
      trace.push(current);
      steps++;
    }

    return trace;
  }

  /**
   * Get all enabled send transitions from a state
   */
  private getEnabledSends(cfsm: CFSM, state: string): CFSMTransition[] {
    return cfsm.transitions.filter(
      (t) => t.from === state && t.action.type === 'send'
    );
  }

  /**
   * Find a matching receive transition
   */
  private findMatchingReceive(
    cfsm: CFSM,
    state: string,
    sender: string,
    msgLabel: string
  ): CFSMTransition | undefined {
    return cfsm.transitions.find((t) => {
      if (t.from !== state || t.action.type !== 'receive') {
        return false;
      }

      const receiveAction = t.action as ReceiveAction;
      return (
        receiveAction.from === sender &&
        receiveAction.message.label === msgLabel
      );
    });
  }

  /**
   * Find transition by ID
   */
  private findTransition(cfsm: CFSM, transId: string): CFSMTransition {
    const trans = cfsm.transitions.find((t) => t.id === transId);
    if (!trans) {
      throw new Error(`Transition ${transId} not found in CFSM for role ${cfsm.role}`);
    }
    return trans;
  }
}
