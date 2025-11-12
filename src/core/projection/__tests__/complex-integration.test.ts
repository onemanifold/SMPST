/**
 * CFSM Projection - Complex Integration Tests
 *
 * Tests complex combinations of protocol constructs:
 * - Choice within parallel
 * - Recursion within parallel
 * - Parallel within choice
 * - All constructs combined
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';
import {
  CHOICE_IN_PARALLEL,
  RECURSION_IN_PARALLEL,
  PARALLEL_IN_CHOICE,
  ALL_CONSTRUCTS,
} from '../__fixtures__/protocols';
import { hasSendAction, hasReceiveAction } from '../__test-utils__/helpers';

describe('CFSM Projection - Complex Integration', () => {
  it('should handle choice within parallel', () => {
    const ast = parse(CHOICE_IN_PARALLEL);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A in both branches, one with choice
    expect(hasSendAction(aCFSM, 'X')).toBe(true);
    expect(hasSendAction(aCFSM, 'Y')).toBe(true);
    expect(hasSendAction(aCFSM, 'Z')).toBe(true);
  });

  it('should handle recursion within parallel', () => {
    const ast = parse(RECURSION_IN_PARALLEL);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A in both branches, one with recursion
    expect(hasSendAction(aCFSM, 'Data')).toBe(true);
    expect(hasSendAction(aCFSM, 'Other')).toBe(true);
  });

  it('should handle parallel within choice', () => {
    const ast = parse(PARALLEL_IN_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Choice between parallel and sequential
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
  });

  it('should handle all constructs combined', () => {
    const ast = parse(ALL_CONSTRUCTS);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Should project all messages involving A
    expect(hasSendAction(aCFSM, 'P1')).toBe(true);
    expect(hasSendAction(aCFSM, 'P2')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Continue')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Stop')).toBe(true);
    expect(hasSendAction(aCFSM, 'Quit')).toBe(true);
  });
});
