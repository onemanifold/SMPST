/**
 * CFSM Projection - Formal Correctness Properties Tests
 *
 * Tests formal correctness properties based on Honda-Yoshida-Carbone 2008.
 * Verifies completeness, duality, reachability, and well-formedness.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { project, projectAll } from '../projector';
import type { SendAction, ReceiveAction } from '../types';
import {
  COMPLETION_CHECK,
  ROLE_CORRECTNESS,
  DUALITY_PROTOCOL,
  REACHABILITY_PROTOCOL,
  DETERMINISTIC_CHOICE,
  BASIC_PROTOCOL,
} from '../__fixtures__/protocols';
import { getReachableStates } from '../__test-utils__/helpers';

describe('CFSM Projection - Formal Correctness Properties', () => {
  it('[Completeness] should project every message exactly once per role', () => {
    const ast = parse(COMPLETION_CHECK);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // M1: should appear exactly once as send in A, exactly once as receive in B
    const aSends = result.cfsms.get('A')!.transitions.filter(
      t => t.action?.type === 'send' && (t.action as SendAction).label === 'M1'
    );
    const bRecvs = result.cfsms.get('B')!.transitions.filter(
      t => t.action?.type === 'receive' && (t.action as ReceiveAction).label === 'M1'
    );
    expect(aSends.length).toBe(1);
    expect(bRecvs.length).toBe(1);

    // M2: exactly once as send in B, exactly once as receive in C
    const bSends = result.cfsms.get('B')!.transitions.filter(
      t => t.action?.type === 'send' && (t.action as SendAction).label === 'M2'
    );
    const cRecvs = result.cfsms.get('C')!.transitions.filter(
      t => t.action?.type === 'receive' && (t.action as ReceiveAction).label === 'M2'
    );
    expect(bSends.length).toBe(1);
    expect(cRecvs.length).toBe(1);

    // M3: exactly once as send in C, exactly once as receive in A
    const cSends = result.cfsms.get('C')!.transitions.filter(
      t => t.action?.type === 'send' && (t.action as SendAction).label === 'M3'
    );
    const aRecvs = result.cfsms.get('A')!.transitions.filter(
      t => t.action?.type === 'receive' && (t.action as ReceiveAction).label === 'M3'
    );
    expect(cSends.length).toBe(1);
    expect(aRecvs.length).toBe(1);
  });

  it('[Correctness] should only include actions where role is involved', () => {
    const ast = parse(ROLE_CORRECTNESS);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // A's CFSM: should have M1 send, M2 should NOT appear
    const aCFSM = result.cfsms.get('A')!;
    const aSendActions = aCFSM.transitions
      .filter(t => t.action?.type === 'send')
      .map(t => (t.action as SendAction).label);
    const aRecvActions = aCFSM.transitions
      .filter(t => t.action?.type === 'receive')
      .map(t => (t.action as ReceiveAction).label);

    expect(aSendActions).toContain('M1');
    expect(aSendActions).not.toContain('M2');
    expect(aRecvActions).not.toContain('M2');

    // All send actions in A's CFSM are sent BY A (by definition of projection)
    // All receive actions in A's CFSM should have to === 'A' (implied by being in A's CFSM)
    // Verify role correctness: receiver is not the sender
    for (const t of aCFSM.transitions) {
      if (t.action?.type === 'send') {
        const sendTo = (t.action as SendAction).to;
        if (typeof sendTo === 'string') {
          expect(sendTo).not.toBe('A'); // Can't send to yourself
        }
      }
      if (t.action?.type === 'receive') {
        const recvFrom = (t.action as ReceiveAction).from;
        expect(recvFrom).not.toBe('A'); // Can't receive from yourself
      }
    }
  });

  it('[Composability] should have matching send/receive pairs (duality)', () => {
    const ast = parse(DUALITY_PROTOCOL);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    // Check all send actions have matching receives
    for (const [role, cfsm] of result.cfsms) {
      for (const t of cfsm.transitions) {
        if (t.action?.type === 'send') {
          const sendAction = t.action as SendAction;
          const receiverCFSM = result.cfsms.get(sendAction.to)!;

          // Find matching receive in receiver's CFSM
          const matchingRecv = receiverCFSM.transitions.find(
            rt => rt.action?.type === 'receive' &&
                  (rt.action as ReceiveAction).from === role &&
                  (rt.action as ReceiveAction).label === sendAction.label
          );

          expect(matchingRecv).toBeDefined();
          expect((matchingRecv!.action as ReceiveAction).from).toBe(role);
          expect((matchingRecv!.action as ReceiveAction).label).toBe(sendAction.label);
        }
      }
    }
  });

  it('[Well-Formedness] should have no orphaned states', () => {
    const ast = parse(REACHABILITY_PROTOCOL);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    for (const cfsm of result.cfsms.values()) {
      // Find all reachable states from initial state
      const reachable = getReachableStates(cfsm);

      // All states should be reachable from initial
      for (const state of cfsm.states) {
        expect(reachable.has(state.id)).toBe(true);
      }
    }
  });

  it('[Well-Formedness] should have deterministic external choice (distinct labels)', () => {
    const ast = parse(DETERMINISTIC_CHOICE);
    const cfg = buildCFG(ast.declarations[0]);
    const serverCFSM = project(cfg, 'Server');

    // Server has external choice - check labels are distinct
    const statesWithMultipleIncoming = new Map<string, string[]>();
    for (const t of serverCFSM.transitions) {
      if (t.action?.type === 'receive') {
        if (!statesWithMultipleIncoming.has(t.to)) {
          statesWithMultipleIncoming.set(t.to, []);
        }
        statesWithMultipleIncoming.get(t.to)!.push((t.action as ReceiveAction).label);
      }
    }

    // For each state with multiple incoming, labels should be distinct
    for (const [state, labels] of statesWithMultipleIncoming) {
      if (labels.length > 1) {
        const uniqueLabels = new Set(labels);
        expect(uniqueLabels.size).toBe(labels.length);
      }
    }
  });

  it('[Well-Formedness] should have initial and terminal states', () => {
    const ast = parse(BASIC_PROTOCOL);
    const cfg = buildCFG(ast.declarations[0]);
    const result = projectAll(cfg);

    for (const cfsm of result.cfsms.values()) {
      // Must have initial state
      expect(cfsm.initialState).toBeDefined();
      expect(cfsm.states.some(s => s.id === cfsm.initialState)).toBe(true);

      // Must have at least one terminal state
      expect(cfsm.terminalStates.length).toBeGreaterThan(0);
      for (const termId of cfsm.terminalStates) {
        expect(cfsm.states.some(s => s.id === termId)).toBe(true);
      }
    }
  });
});
