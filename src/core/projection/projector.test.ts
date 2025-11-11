/**
 * CFSM Projection Tests
 *
 * Tests the projection algorithm that extracts role-specific CFSMs from a global CFG.
 * Following TDD: write tests first, then implement.
 *
 * KEY PRINCIPLE: Actions live on TRANSITIONS, not states!
 * Tests verify that CFSMTransition objects have the correct action field.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { project, projectAll } from './projector';
import type { CFSM, SendAction, ReceiveAction } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find a transition with a specific action type
 */
function findTransitionWithAction(
  cfsm: CFSM,
  actionType: 'send' | 'receive' | 'tau' | 'choice'
): ReturnType<typeof cfsm.transitions.find> {
  return cfsm.transitions.find(t => t.action && t.action.type === actionType);
}

/**
 * Find all transitions with a specific action type
 */
function findTransitionsWithAction(
  cfsm: CFSM,
  actionType: 'send' | 'receive' | 'tau' | 'choice'
) {
  return cfsm.transitions.filter(t => t.action && t.action.type === actionType);
}

/**
 * Check if transition has send action with specific label
 */
function hasSendAction(cfsm: CFSM, label: string): boolean {
  return cfsm.transitions.some(
    t => t.action && t.action.type === 'send' && t.action.label === label
  );
}

/**
 * Check if transition has receive action with specific label
 */
function hasReceiveAction(cfsm: CFSM, label: string): boolean {
  return cfsm.transitions.some(
    t => t.action && t.action.type === 'receive' && t.action.label === label
  );
}

// ============================================================================
// Basic Message Projection Tests
// ============================================================================

describe('CFSM Projection - Basic Message Passing', () => {
  it('should project simple send action for sender role', () => {
    const source = `
      protocol SimpleSend(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // Verify CFSM structure
    expect(cfsm.role).toBe('A');
    expect(cfsm.states.length).toBeGreaterThan(0);
    expect(cfsm.initialState).toBeDefined();
    expect(cfsm.terminalStates.length).toBeGreaterThan(0);

    // KEY TEST: Action should be on transition, not state
    const sendTransitions = findTransitionsWithAction(cfsm, 'send');
    expect(sendTransitions.length).toBe(1);

    const sendTransition = sendTransitions[0];
    expect(sendTransition.action).toBeDefined();
    expect(sendTransition.action!.type).toBe('send');

    const sendAction = sendTransition.action as SendAction;
    expect(sendAction.to).toBe('B');
    expect(sendAction.label).toBe('Message');
  });

  it('should project simple receive action for receiver role', () => {
    const source = `
      protocol SimpleReceive(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'B');

    // Verify CFSM structure
    expect(cfsm.role).toBe('B');
    expect(cfsm.states.length).toBeGreaterThan(0);

    // KEY TEST: Action should be on transition
    const recvTransitions = findTransitionsWithAction(cfsm, 'receive');
    expect(recvTransitions.length).toBe(1);

    const recvTransition = recvTransitions[0];
    expect(recvTransition.action).toBeDefined();
    expect(recvTransition.action!.type).toBe('receive');

    const recvAction = recvTransition.action as ReceiveAction;
    expect(recvAction.from).toBe('A');
    expect(recvAction.label).toBe('Message');
  });

  it('should project sequence of messages', () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Test Client projection
    const clientCFSM = project(cfg, 'Client');
    expect(clientCFSM.role).toBe('Client');

    // Client sends Request
    expect(hasSendAction(clientCFSM, 'Request')).toBe(true);
    // Client receives Response
    expect(hasReceiveAction(clientCFSM, 'Response')).toBe(true);

    // Test Server projection
    const serverCFSM = project(cfg, 'Server');
    expect(serverCFSM.role).toBe('Server');

    // Server receives Request
    expect(hasReceiveAction(serverCFSM, 'Request')).toBe(true);
    // Server sends Response
    expect(hasSendAction(serverCFSM, 'Response')).toBe(true);
  });

  it('should handle three-role protocol with role exclusion', () => {
    const source = `
      protocol ThreeRoles(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Test A's projection
    const aCFSM = project(cfg, 'A');
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);     // A sends M1
    expect(hasReceiveAction(aCFSM, 'M3')).toBe(true);  // A receives M3
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(false); // A NOT involved in M2

    // Test B's projection
    const bCFSM = project(cfg, 'B');
    expect(hasReceiveAction(bCFSM, 'M1')).toBe(true);  // B receives M1
    expect(hasSendAction(bCFSM, 'M2')).toBe(true);     // B sends M2
    expect(hasReceiveAction(bCFSM, 'M3')).toBe(false); // B NOT involved in M3

    // Test C's projection
    const cCFSM = project(cfg, 'C');
    expect(hasReceiveAction(cCFSM, 'M2')).toBe(true);  // C receives M2
    expect(hasSendAction(cCFSM, 'M3')).toBe(true);     // C sends M3
    expect(hasReceiveAction(cCFSM, 'M1')).toBe(false); // C NOT involved in M1
  });
});

// ============================================================================
// Completeness Tests
// ============================================================================

describe('CFSM Projection - Completeness', () => {
  it('should preserve all protocol interactions across all CFSMs', () => {
    const source = `
      protocol Complete(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(3);
    expect(result.roles).toEqual(['A', 'B', 'C']);
    expect(result.errors.length).toBe(0);

    // Verify duality: each send has matching receive
    const aCFSM = result.cfsms.get('A')!;
    const bCFSM = result.cfsms.get('B')!;
    const cCFSM = result.cfsms.get('C')!;

    // M1: A sends, B receives
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(bCFSM, 'M1')).toBe(true);

    // M2: B sends, C receives
    expect(hasSendAction(bCFSM, 'M2')).toBe(true);
    expect(hasReceiveAction(cCFSM, 'M2')).toBe(true);

    // M3: C sends, A receives
    expect(hasSendAction(cCFSM, 'M3')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M3')).toBe(true);
  });

  it('should maintain terminal state reachability', () => {
    const source = `
      protocol Reachable(role A, role B) {
        A -> B: Start();
        B -> A: Done();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // Every CFSM should have reachable terminal states
    for (const cfsm of result.cfsms.values()) {
      expect(cfsm.terminalStates.length).toBeGreaterThan(0);
      expect(cfsm.initialState).toBeDefined();

      // Initial state should have outgoing transitions
      const initialTransitions = cfsm.transitions.filter(
        t => t.from === cfsm.initialState
      );
      expect(initialTransitions.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('CFSM Projection - Edge Cases', () => {
  it('should handle empty protocol', () => {
    const source = `
      protocol Empty(role A, role B) {
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const cfsm = project(cfg, 'A');

    // Should have initial and terminal states
    expect(cfsm.states.length).toBeGreaterThan(0);
    expect(cfsm.initialState).toBeDefined();
    expect(cfsm.terminalStates.length).toBeGreaterThan(0);

    // Should have at least one transition (initial to terminal)
    expect(cfsm.transitions.length).toBeGreaterThan(0);
  });

  it('should throw error for non-existent role', () => {
    const source = `
      protocol TwoRoles(role A, role B) {
        A -> B: Message();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);

    // Projecting for non-existent role should throw
    expect(() => project(cfg, 'C')).toThrow();
  });

  it('should project all roles at once', () => {
    const source = `
      protocol Multi(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;
    const ast = parse(source);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(3);
    expect(result.roles).toEqual(['A', 'B', 'C']);
    expect(result.errors.length).toBe(0);

    // Each role should have valid CFSM
    for (const [role, cfsm] of result.cfsms) {
      expect(cfsm.role).toBe(role);
      expect(cfsm.states.length).toBeGreaterThan(0);
      expect(cfsm.transitions.length).toBeGreaterThan(0);
    }
  });
});
