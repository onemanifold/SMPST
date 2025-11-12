/**
 * CFSM Projection Tests - Recursion
 *
 * Tests projection of recursive constructs (rec/continue statements).
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';
import {
  findTransitionsWithAction,
  hasSendAction,
  hasReceiveAction,
  hasCycle,
} from '../__test-utils__/helpers';
import {
  INFINITE_LOOP,
  CONDITIONAL_LOOP,
  NESTED_RECURSION,
  RECURSION_WITH_CONTINUATION,
  MULTI_CONTINUE,
} from '../__fixtures__/protocols';

describe('CFSM Projection - Recursion', () => {
  it('should project simple infinite loop', () => {
    const ast = parse(INFINITE_LOOP);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Should have send action
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);

    // Should have back-edge (cycle)
    const sendTransitions = findTransitionsWithAction(aCFSM, 'send');
    expect(sendTransitions.length).toBeGreaterThan(0);

    expect(hasCycle(aCFSM)).toBe(true);
  });

  it('should project conditional recursion (choice-based loop)', () => {
    const ast = parse(CONDITIONAL_LOOP);
    const cfg = buildCFG(ast.declarations[0]);
    const serverCFSM = project(cfg, 'Server');

    // Server makes choice: Data (loops) or End (exits)
    expect(hasSendAction(serverCFSM, 'Data')).toBe(true);
    expect(hasSendAction(serverCFSM, 'End')).toBe(true);
  });

  it('should project nested recursion', () => {
    const ast = parse(NESTED_RECURSION);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Should have both messages
    expect(hasSendAction(aCFSM, 'Start')).toBe(true);
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);
  });

  it('should project recursion with continuation after loop', () => {
    const ast = parse(RECURSION_WITH_CONTINUATION);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Loop messages
    expect(hasSendAction(aCFSM, 'More')).toBe(true);
    expect(hasSendAction(aCFSM, 'Done')).toBe(true);

    // Continuation after loop
    expect(hasReceiveAction(aCFSM, 'Final')).toBe(true);
  });

  it('should handle multiple continue points in same recursion', () => {
    const ast = parse(MULTI_CONTINUE);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // All three options
    expect(hasSendAction(aCFSM, 'Option1')).toBe(true);
    expect(hasSendAction(aCFSM, 'Option2')).toBe(true);
    expect(hasSendAction(aCFSM, 'Exit')).toBe(true);
  });
});
