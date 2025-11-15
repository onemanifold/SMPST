/**
 * SafetyChecker - Implementation of Definition 4.1 from "Less is More"
 *
 * Checks if a typing context Γ satisfies the safety property.
 *
 * DEFINITION 4.1 (Safety Property):
 * A typing context Γ is safe if:
 * 1. [S-⊕&] For each enabled send p→q:m, there exists an enabled receive q←p:m
 * 2. [S-μ]  Recursion variables are properly unfolded
 * 3. [S-→]  Safety is preserved by reduction (checked on all reachable states)
 *
 * ALGORITHM:
 * ```
 * safe(Γ) = sendReceiveCompatible(Γ) ∧ ∀Γ' ∈ reachable(Γ). sendReceiveCompatible(Γ')
 * ```
 *
 * where sendReceiveCompatible checks [S-⊕&] for a single context.
 *
 * DECIDABILITY: This is decidable because CFSMs have finite states,
 * so reachable(Γ) is a finite set.
 *
 * COMPLEXITY: O(|States| × |Transitions|) where States is the product
 * of all CFSM states. Exponential in number of roles but polynomial
 * in CFSM size.
 *
 * @reference Scalas, A., & Yoshida, N. (2019). Less is More: Multiparty
 *            Session Types Revisited. POPL 2019, Definition 4.1.
 */

import type {
  TypingContext,
  SafetyProperty,
  SafetyCheckResult,
  SafetyViolation,
  Communication,
} from './types';

import type {
  CFSM,
  CFSMTransition,
  SendAction,
  ReceiveAction,
} from '../projection/types';

/**
 * BasicSafety - Implements Definition 4.1
 *
 * This is the fundamental safety property that guarantees type safety
 * (well-typed processes never go wrong).
 *
 * Accepts OAuth and other protocols rejected by classic MPST!
 */
export class BasicSafety implements SafetyProperty {
  readonly name = 'BasicSafety';
  readonly description = 'Ensures send/receive compatibility (Definition 4.1)';

  /**
   * Check if typing context is safe
   *
   * Implements Definition 4.1:
   * 1. Check send/receive compatibility for current context
   * 2. Compute all reachable contexts
   * 3. Check send/receive compatibility for each reachable context
   *
   * @param context - Typing context to check
   * @returns Check result with violations if unsafe
   */
  check(context: TypingContext): SafetyCheckResult {
    const startTime = Date.now();
    const violations: SafetyViolation[] = [];

    // Rule [S-⊕&]: Check send/receive compatibility for initial context
    const initialCheck = this.checkSendReceiveCompatibility(context);
    violations.push(...initialCheck);

    // If initial context is unsafe, no need to check reachable states
    if (violations.length > 0) {
      return {
        safe: false,
        violations,
        diagnostics: {
          checkTime: Date.now() - startTime,
          statesExplored: 1,
        },
      };
    }

    // Rule [S-→]: Check all reachable contexts
    const reachable = this.computeReachable(context);
    let statesExplored = 0;

    for (const reachableContext of reachable) {
      statesExplored++;
      const reachableViolations = this.checkSendReceiveCompatibility(reachableContext);

      if (reachableViolations.length > 0) {
        violations.push(...reachableViolations);
        // Early exit on first violation
        break;
      }
    }

    return {
      safe: violations.length === 0,
      violations,
      diagnostics: {
        checkTime: Date.now() - startTime,
        statesExplored,
      },
    };
  }

  /**
   * Rule [S-⊕&]: Check send/receive compatibility
   *
   * For each role p at state q:
   * - For each enabled send p→r:m from q
   * - Check that r has an enabled receive r←p:m at its current state
   *
   * This is the CORE of the safety check!
   *
   * @param context - Context to check
   * @returns Array of violations (empty if compatible)
   */
  private checkSendReceiveCompatibility(
    context: TypingContext
  ): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    // For each role's CFSM at current state
    for (const [roleP, instance] of context.cfsms) {
      const { machine: cfsmP, currentState: stateP } = instance;

      // Get all enabled send transitions from current state
      const enabledSends = this.getEnabledSends(cfsmP, stateP);

      // Check each send has matching receive
      for (const sendTrans of enabledSends) {
        const sendAction = sendTrans.action as SendAction;

        // Handle multicast sends (send to multiple receivers)
        const receivers = Array.isArray(sendAction.to)
          ? sendAction.to
          : [sendAction.to];

        for (const roleQ of receivers) {
          const msgLabel = sendAction.message.label;

          // Get q's CFSM and current state
          const instanceQ = context.cfsms.get(roleQ);
          if (!instanceQ) {
            violations.push({
              type: 'send-receive-mismatch',
              roles: [roleP, roleQ],
              message: `Role ${roleP} sends to non-existent role ${roleQ}`,
              context,
              details: {
                sender: roleP,
                receiver: roleQ,
                messageLabel: msgLabel,
              },
            });
            continue;
          }

          const { machine: cfsmQ, currentState: stateQ } = instanceQ;

          // Find matching receive transition at q's current state
          const matchingReceive = this.findMatchingReceive(
            cfsmQ,
            stateQ,
            roleP,
            msgLabel
          );

          if (!matchingReceive) {
            violations.push({
              type: 'send-receive-mismatch',
              roles: [roleP, roleQ],
              message: `${roleP} can send '${msgLabel}' to ${roleQ}, but ${roleQ} cannot receive it at state ${stateQ}`,
              context,
              details: {
                sender: roleP,
                receiver: roleQ,
                messageLabel: msgLabel,
                expected: `Receive transition for '${msgLabel}' from ${roleP} at state ${stateQ}`,
                actual: `No such transition found`,
              },
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Compute all reachable contexts from initial context
   *
   * Uses BFS to explore the state space of the protocol.
   * A context Γ' is reachable from Γ if there exists a sequence
   * of communications that transitions Γ to Γ'.
   *
   * TERMINATION: Guaranteed to terminate because:
   * 1. CFSMs have finite states
   * 2. Product state space is finite (product of all CFSM states)
   * 3. We track visited contexts to avoid cycles
   *
   * @param initial - Initial typing context
   * @returns Set of all reachable contexts (including initial)
   */
  private computeReachable(initial: TypingContext): Set<TypingContext> {
    const visited = new Set<TypingContext>();
    const queue: TypingContext[] = [initial];

    // Use stringified version for faster comparison
    const visitedKeys = new Set<string>();
    visitedKeys.add(this.contextKey(initial));

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current);

      // Find all possible communications from current context
      const communications = this.findEnabledCommunications(current);

      // For each communication, compute successor context
      for (const comm of communications) {
        const successor = this.reduce(current, comm);
        const successorKey = this.contextKey(successor);

        // If not visited, add to queue
        if (!visitedKeys.has(successorKey)) {
          visitedKeys.add(successorKey);
          queue.push(successor);
        }
      }
    }

    return visited;
  }

  /**
   * Find all enabled communications in a context
   *
   * A communication is enabled if:
   * - Role p has an enabled send p→q:m
   * - Role q has an enabled receive q←p:m
   *
   * @param context - Current context
   * @returns Array of enabled communications
   */
  private findEnabledCommunications(context: TypingContext): Communication[] {
    const communications: Communication[] = [];

    // For each role that can send
    for (const [roleP, instanceP] of context.cfsms) {
      const { machine: cfsmP, currentState: stateP } = instanceP;
      const enabledSends = this.getEnabledSends(cfsmP, stateP);

      // For each send, check if receiver can receive
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

    return communications;
  }

  /**
   * Reduce context by executing a communication
   *
   * Advances both sender and receiver CFSMs to their successor states.
   *
   * @param context - Current context
   * @param comm - Communication to execute
   * @returns New context after communication
   */
  private reduce(context: TypingContext, comm: Communication): TypingContext {
    const newCFSMs = new Map(context.cfsms);

    // Advance sender's CFSM
    const senderInstance = context.cfsms.get(comm.sender)!;
    const senderTrans = senderInstance.machine.transitions.find(
      (t) => t.id === comm.senderTransition
    )!;
    newCFSMs.set(comm.sender, {
      machine: senderInstance.machine,
      currentState: senderTrans.to,
    });

    // Advance receiver's CFSM
    const receiverInstance = context.cfsms.get(comm.receiver)!;
    const receiverTrans = receiverInstance.machine.transitions.find(
      (t) => t.id === comm.receiverTransition
    )!;
    newCFSMs.set(comm.receiver, {
      machine: receiverInstance.machine,
      currentState: receiverTrans.to,
    });

    return {
      session: context.session,
      cfsms: newCFSMs,
    };
  }

  /**
   * Get all enabled send transitions from a state
   *
   * @param cfsm - CFSM to check
   * @param state - Current state
   * @returns Array of send transitions from state
   */
  private getEnabledSends(cfsm: CFSM, state: string): CFSMTransition[] {
    return cfsm.transitions.filter(
      (t) => t.from === state && t.action.type === 'send'
    );
  }

  /**
   * Find a matching receive transition
   *
   * @param cfsm - Receiver's CFSM
   * @param state - Current state
   * @param sender - Expected sender role
   * @param msgLabel - Expected message label
   * @returns Matching receive transition, or undefined if none found
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
   * Generate a unique key for a context (for cycle detection)
   *
   * @param context - Context to key
   * @returns String key representing context
   */
  private contextKey(context: TypingContext): string {
    const parts: string[] = [];
    for (const [role, instance] of context.cfsms) {
      parts.push(`${role}:${instance.currentState}`);
    }
    return parts.sort().join(',');
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
}
