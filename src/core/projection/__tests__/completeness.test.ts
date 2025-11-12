/**
 * Completeness Tests
 *
 * Tests that verify completeness properties of projection:
 * - All protocol interactions are preserved
 * - Message duality (send/receive pairs)
 * - Terminal state reachability
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { projectAll } from '../projector';
import { COMPLETE_PROTOCOL, REACHABLE_PROTOCOL } from '../__fixtures__/protocols';
import { hasSendAction, hasReceiveAction } from '../__test-utils__/helpers';

describe('CFSM Projection - Completeness', () => {
  it('should preserve all protocol interactions across all CFSMs', () => {
    const ast = parse(COMPLETE_PROTOCOL);
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
    const ast = parse(REACHABLE_PROTOCOL);
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
