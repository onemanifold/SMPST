/**
 * Basic Message Passing Tests
 *
 * Tests fundamental send/receive projection for simple protocols.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project } from '../projector';
import type { SendAction, ReceiveAction } from '../types';
import {
  SIMPLE_SEND,
  SIMPLE_RECEIVE,
  REQUEST_RESPONSE,
  THREE_ROLE_CHAIN,
} from '../__fixtures__/protocols';
import {
  findTransitionsWithAction,
  hasSendAction,
  hasReceiveAction,
} from '../__test-utils__/helpers';

describe('CFSM Projection - Basic Message Passing', () => {
  it('should project simple send action for sender role', () => {
    const ast = parse(SIMPLE_SEND);
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
    const ast = parse(SIMPLE_RECEIVE);
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
    const ast = parse(REQUEST_RESPONSE);
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
    const ast = parse(THREE_ROLE_CHAIN);
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
