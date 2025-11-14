/**
 * CFSM Projection - Edge Cases Tests
 *
 * Tests edge cases and error conditions in the projection algorithm.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project, projectAll } from '../projector';
import {
  EMPTY_PROTOCOL,
  UNUSED_ROLE,
  SINGLE_ROLE,
  LONG_SEQUENCE,
  MANY_ROLES,
} from '../__fixtures__/protocols';
import { findTransitionsWithAction } from '../__test-utils__/helpers';

describe('CFSM Projection - Edge Cases', () => {
  it('should handle empty protocol', () => {
    const ast = parse(EMPTY_PROTOCOL);
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
    expect(() => project(cfg, 'C')).toThrow(/Role "C" not found/);
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

  it('should handle single-role protocol', () => {
    const ast = parse(SINGLE_ROLE);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(1);
    expect(result.cfsms.has('A')).toBe(true);
  });

  it('should handle role that never participates', () => {
    const ast = parse(UNUSED_ROLE);
    const cfg = buildCFG(ast.declarations[0]);
    const cCFSM = project(cfg, 'C');

    // C has no actions (send/receive), just initial -> terminal via tau
    const actionTransitions = cCFSM.transitions.filter(
      t => t.action && t.action.type !== 'tau'
    );
    expect(actionTransitions.length).toBe(0);
  });

  it('should handle long sequence (stress test)', () => {
    const ast = parse(LONG_SEQUENCE);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A should have 5 sends and 5 receives
    const sends = findTransitionsWithAction(aCFSM, 'send');
    const recvs = findTransitionsWithAction(aCFSM, 'receive');
    expect(sends.length).toBe(5);
    expect(recvs.length).toBe(5);
  });

  it('should handle many roles', () => {
    const ast = parse(MANY_ROLES);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    expect(result.cfsms.size).toBe(5);
    expect(result.errors.length).toBe(0);
  });
});
