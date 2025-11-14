/**
 * Safety utilities - Helper functions for working with typing contexts
 */

import type { TypingContext, CFSMInstance } from './types';
import type { CFSM } from '../projection/types';

/**
 * Create initial typing context from CFSMs
 *
 * Sets all CFSMs to their initial states.
 *
 * @param cfsms - Map of role names to CFSMs
 * @param sessionName - Optional session name (defaults to 'session')
 * @returns Initial typing context with all roles at initial states
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

  return {
    session: sessionName,
    cfsms: instances,
  };
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
