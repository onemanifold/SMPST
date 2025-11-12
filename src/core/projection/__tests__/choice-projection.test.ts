/**
 * CFSM Projection Tests - Choice (Internal ⊕)
 *
 * Tests the projection algorithm for choice constructs.
 * Uses fixtures from __fixtures__/protocols.ts for reusable test protocols.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';
import {
  INTERNAL_CHOICE,
  EXTERNAL_CHOICE,
  NESTED_CHOICE,
  THREE_WAY_CHOICE,
  CHOICE_WITH_CONTINUATION,
  EMPTY_BRANCH_CHOICE,
} from '../__fixtures__/protocols';
import {
  hasSendAction,
  hasReceiveAction,
  findTransitionsWithAction,
} from '../__test-utils__/helpers';

describe('CFSM Projection - Choice (Internal ⊕)', () => {
  it('should project internal choice for decider role', () => {
    const ast = parse(INTERNAL_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);
    const clientCFSM = project(cfg, 'Client');

    // Client makes choice - should have two send transitions from choice point
    expect(hasSendAction(clientCFSM, 'Login')).toBe(true);
    expect(hasSendAction(clientCFSM, 'Register')).toBe(true);

    const sendTransitions = findTransitionsWithAction(clientCFSM, 'send');
    expect(sendTransitions.length).toBe(2);
  });

  it('should project external choice for non-decider role', () => {
    const ast = parse(EXTERNAL_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);
    const serverCFSM = project(cfg, 'Server');

    // Server reacts to choice - should have two receive transitions
    expect(hasReceiveAction(serverCFSM, 'Login')).toBe(true);
    expect(hasReceiveAction(serverCFSM, 'Register')).toBe(true);

    const recvTransitions = findTransitionsWithAction(serverCFSM, 'receive');
    expect(recvTransitions.length).toBe(2);
  });

  it('should handle nested choices', () => {
    const ast = parse(NESTED_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);

    const aCFSM = project(cfg, 'A');
    const bCFSM = project(cfg, 'B');

    // A makes outer choice
    expect(hasSendAction(aCFSM, 'Opt1')).toBe(true);
    expect(hasSendAction(aCFSM, 'Opt2')).toBe(true);

    // B receives Opt1, then makes inner choice
    expect(hasReceiveAction(bCFSM, 'Opt1')).toBe(true);
    expect(hasSendAction(bCFSM, 'Opt1A')).toBe(true);
    expect(hasSendAction(bCFSM, 'Opt1B')).toBe(true);

    // B also receives Opt2 from other branch
    expect(hasReceiveAction(bCFSM, 'Opt2')).toBe(true);
  });

  it('should handle three-way choice', () => {
    const ast = parse(THREE_WAY_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);
    const clientCFSM = project(cfg, 'Client');

    // Three branches
    expect(hasSendAction(clientCFSM, 'Option1')).toBe(true);
    expect(hasSendAction(clientCFSM, 'Option2')).toBe(true);
    expect(hasSendAction(clientCFSM, 'Option3')).toBe(true);
  });

  it('should handle choice with continuation', () => {
    const ast = parse(CHOICE_WITH_CONTINUATION);
    const cfg = buildCFG(ast.declarations[0]);

    const aCFSM = project(cfg, 'A');

    // Choice branches
    expect(hasSendAction(aCFSM, 'Yes')).toBe(true);
    expect(hasSendAction(aCFSM, 'No')).toBe(true);

    // Continuation after both branches
    expect(hasReceiveAction(aCFSM, 'Ack1')).toBe(true);
    expect(hasReceiveAction(aCFSM, 'Ack2')).toBe(true);
    expect(hasSendAction(aCFSM, 'Final')).toBe(true);
  });

  it('should handle choice where one branch is empty', () => {
    const ast = parse(EMPTY_BRANCH_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);
    const aCFSM = project(cfg, 'A');

    // One branch has action, other is empty
    expect(hasSendAction(aCFSM, 'Something')).toBe(true);
  });
});
