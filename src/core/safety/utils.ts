/**
 * Safety utilities - Helper functions for working with typing contexts
 */

import type { TypingContext, CFSMInstance } from './types';
import type { CFSM, CFSMTransition } from '../projection/types';

/**
 * Apply all enabled tau transitions eagerly for all roles
 *
 * Tau transitions represent internal actions (e.g., after a choice is resolved).
 * They must be applied immediately to reach the next stable state.
 *
 * This implements tau-closure (τ*) from weak transition semantics.
 *
 * @param context - Context to apply tau transitions to
 * @returns New context with all tau transitions applied
 */
export function applyTauTransitions(context: TypingContext): TypingContext {
  let current = context;
  let changed = true;

  // Keep applying tau transitions until none are enabled
  while (changed) {
    changed = false;
    const newCFSMs = new Map(current.cfsms);

    for (const [role, instance] of current.cfsms) {
      const tauTrans = getEnabledTauTransition(instance.machine, instance.currentState);
      if (tauTrans) {
        newCFSMs.set(role, {
          machine: instance.machine,
          currentState: tauTrans.to,
        });
        changed = true;
      }
    }

    if (changed) {
      current = {
        session: current.session,
        cfsms: newCFSMs,
      };
    }
  }

  return current;
}

/**
 * Get enabled tau transition from a state (if any)
 *
 * Tau transitions are internal actions that must be applied eagerly.
 * At most one tau transition should be enabled from a given state.
 *
 * @param cfsm - CFSM to check
 * @param state - Current state
 * @returns Tau transition if enabled, undefined otherwise
 */
function getEnabledTauTransition(cfsm: CFSM, state: string): CFSMTransition | undefined {
  return cfsm.transitions.find(
    (t) => t.from === state && t.action.type === 'tau'
  );
}

/**
 * Create initial typing context from CFSMs
 *
 * Sets all CFSMs to their initial states, then applies tau-closure
 * to reach the stable initial state (consistent with weak semantics).
 *
 * @param cfsms - Map of role names to CFSMs
 * @param sessionName - Optional session name (defaults to 'session')
 * @returns Initial typing context with all roles at stable initial states
 */
export function createInitialContext(
  cfsms: Map<string, CFSM>,
  sessionName: string = 'session'
): TypingContext {
  const instances = new Map<string, CFSMInstance>();

  for (const [role, machine] of cfsms) {
    instances.set(role, {
      machine,
      currentState: machine.initialState,
    });
  }

  let context: TypingContext = {
    session: sessionName,
    cfsms: instances,
  };

  // Apply tau-closure to reach stable initial state
  // This is consistent with weak semantics where the observable initial state
  // is after all internal transitions from the syntactic initial state
  context = applyTauTransitions(context);

  return context;
}

/**
 * Create context from array of CFSMs
 *
 * Convenience wrapper for createInitialContext.
 *
 * @param cfsms - Array of CFSMs
 * @param sessionName - Optional session name
 * @returns Initial typing context
 */
export function createInitialContextFromArray(
  cfsms: CFSM[],
  sessionName: string = 'session'
): TypingContext {
  const cfsmMap = new Map<string, CFSM>();
  for (const cfsm of cfsms) {
    cfsmMap.set(cfsm.role, cfsm);
  }
  return createInitialContext(cfsmMap, sessionName);
}

/**
 * Clone a typing context
 *
 * Creates a shallow copy of the context.
 * CFSMs are not cloned (they are immutable).
 *
 * @param context - Context to clone
 * @returns Cloned context
 */
export function cloneContext(context: TypingContext): TypingContext {
  return {
    session: context.session,
    cfsms: new Map(context.cfsms),
  };
}

/**
 * Get current state for a role
 *
 * @param context - Typing context
 * @param role - Role name
 * @returns Current state ID, or undefined if role not found
 */
export function getCurrentState(
  context: TypingContext,
  role: string
): string | undefined {
  return context.cfsms.get(role)?.currentState;
}

/**
 * Set current state for a role
 *
 * Returns a new context with the role's state updated.
 * Does not mutate the original context.
 *
 * @param context - Typing context
 * @param role - Role name
 * @param state - New state ID
 * @returns New context with updated state
 * @throws Error if role not found in context
 */
export function setCurrentState(
  context: TypingContext,
  role: string,
  state: string
): TypingContext {
  const instance = context.cfsms.get(role);
  if (!instance) {
    throw new Error(`Role ${role} not found in context`);
  }

  const newCFSMs = new Map(context.cfsms);
  newCFSMs.set(role, {
    machine: instance.machine,
    currentState: state,
  });

  return {
    session: context.session,
    cfsms: newCFSMs,
  };
}

/**
 * Get all role names in a context
 *
 * @param context - Typing context
 * @returns Array of role names
 */
export function getRoles(context: TypingContext): string[] {
  return Array.from(context.cfsms.keys());
}

/**
 * Format context as a readable string
 *
 * @param context - Typing context
 * @returns Human-readable string representation
 */
export function formatContext(context: TypingContext): string {
  const parts: string[] = [];
  for (const [role, instance] of context.cfsms) {
    parts.push(`${role}:${instance.currentState}`);
  }
  return `Γ(${parts.join(', ')})`;
}

/**
 * Check if two contexts are equal
 *
 * Contexts are equal if they have the same roles at the same states.
 * Does not compare CFSM structures (assumes same protocol).
 *
 * @param ctx1 - First context
 * @param ctx2 - Second context
 * @returns True if contexts are equal
 */
export function contextsEqual(ctx1: TypingContext, ctx2: TypingContext): boolean {
  if (ctx1.cfsms.size !== ctx2.cfsms.size) {
    return false;
  }

  for (const [role, instance1] of ctx1.cfsms) {
    const instance2 = ctx2.cfsms.get(role);
    if (!instance2 || instance1.currentState !== instance2.currentState) {
      return false;
    }
  }

  return true;
}
