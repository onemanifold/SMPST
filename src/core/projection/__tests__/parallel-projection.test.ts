/**
 * CFSM Projection Tests - Parallel Composition
 *
 * Tests projection of parallel constructs (par/and blocks).
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';
import {
  hasSendAction,
  hasReceiveAction,
} from '../__test-utils__/helpers';
import {
  PARALLEL_SINGLE_BRANCH,
  PARALLEL_MULTIPLE_BRANCHES,
  THREE_WAY_PARALLEL,
  PARALLEL_WITH_SEQUENCES,
  NESTED_PARALLEL,
  PARALLEL_UNINVOLVED_ROLE,
} from '../__fixtures__/protocols';

describe('CFSM Projection - Parallel Composition', () => {
  it('should project role in single parallel branch as sequential', () => {
    const ast = parse(PARALLEL_SINGLE_BRANCH);
    const cfg = buildCFG(ast.declarations[0]);

    // A only in first branch
    const aCFSM = project(cfg, 'A');
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(false);
  });

  it('should handle role in multiple parallel branches', () => {
    const ast = parse(PARALLEL_MULTIPLE_BRANCHES);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A appears in both branches
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
  });

  it('should handle three-way parallel', () => {
    const ast = parse(THREE_WAY_PARALLEL);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A in all three branches
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
  });

  it('should handle parallel with sequences in branches', () => {
    const ast = parse(PARALLEL_WITH_SEQUENCES);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Both branches have sequences involving A
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M4')).toBe(true);
  });

  it('should handle nested parallel', () => {
    const ast = parse(NESTED_PARALLEL);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // Nested parallel - A in all branches
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasSendAction(aCFSM, 'M2')).toBe(true);
    expect(hasSendAction(aCFSM, 'M3')).toBe(true);
  });

  it('should handle role not involved in any parallel branch', () => {
    const ast = parse(PARALLEL_UNINVOLVED_ROLE);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // A not in parallel, only in continuation
    expect(hasSendAction(aCFSM, 'M1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'M2')).toBe(true);
  });
});
