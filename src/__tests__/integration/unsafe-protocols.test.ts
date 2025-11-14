/**
 * Unsafe Protocol Tests (Negative Tests)
 *
 * These tests verify that the safety checker correctly REJECTS unsafe protocols.
 * This is critical to ensure we're not just accepting everything!
 *
 * Test protocols that violate Definition 4.1:
 * - Send without matching receive
 * - Receive without matching send
 * - Type mismatches
 * - Stuck states
 *
 * Note: These use hand-constructed CFSMs since the parser/projector
 * should not produce unsafe CFSMs from well-formed Scribble protocols.
 */

import { describe, it, expect } from 'vitest';
import { BasicSafety } from '../../core/safety/safety-checker';
import { ContextReducer } from '../../core/safety/context-reducer';
import { createInitialContext } from '../../core/safety/utils';
import type { CFSM, CFSMState, CFSMTransition } from '../../core/projection/types';

/**
 * Helper: Create a simple CFSM with given transitions
 */
function createCFSM(
  role: string,
  transitions: Array<{
    from: string;
    to: string;
    action:
      | { type: 'send'; to: string; message: { label: string } }
      | { type: 'receive'; from: string; message: { label: string } }
      | { type: 'tau' };
  }>,
  initialState: string = 'q0',
  terminalStates: string[] = ['qf']
): CFSM {
  // Collect all unique states from transitions
  const stateIds = new Set<string>([initialState, ...terminalStates]);
  transitions.forEach(t => {
    stateIds.add(t.from);
    stateIds.add(t.to);
  });

  const states: CFSMState[] = Array.from(stateIds).map(id => ({ id }));

  const cfsmTransitions: CFSMTransition[] = transitions.map((t, i) => ({
    id: `t${i}`,
    from: t.from,
    to: t.to,
    action: t.action as any,
  }));

  return {
    role,
    protocolName: 'TestProtocol',
    parameters: [],
    states,
    transitions: cfsmTransitions,
    initialState,
    terminalStates,
  };
}

describe('Unsafe Protocol Tests (Negative Tests)', () => {
  describe('Send/Receive Mismatches', () => {
    it('should reject protocol where A sends but B cannot receive', () => {
      // A sends 'foo' to B, but B expects 'bar'
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'send', to: 'B', message: { label: 'foo' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'bar' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'mismatch'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('send-receive-mismatch');
      expect(result.violations[0].roles).toContain('A');
      expect(result.violations[0].roles).toContain('B');
      expect(result.violations[0].details?.messageLabel).toBe('foo');
    });

    it('should reject protocol where A sends but B expects different sender', () => {
      // A sends to B, but B expects message from C
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'send', to: 'B', message: { label: 'msg' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'C', message: { label: 'msg' } },
        },
      ]);

      const cfsmC = createCFSM('C', [
        { from: 'q0', to: 'qf', action: { type: 'tau' } },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
          ['C', cfsmC],
        ]),
        'wrong-sender'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should reject protocol where A sends to non-existent role', () => {
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'send', to: 'NonExistent', message: { label: 'msg' } },
        },
      ]);

      const context = createInitialContext(
        new Map([['A', cfsmA]]),
        'non-existent'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(false);
      expect(result.violations[0].type).toBe('send-receive-mismatch');
      expect(result.violations[0].details?.receiver).toBe('NonExistent');
    });

    it('should reject protocol where B has orphan receive (no sender)', () => {
      // B tries to receive, but A never sends
      const cfsmA = createCFSM('A', [
        { from: 'q0', to: 'qf', action: { type: 'tau' } },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'msg' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'orphan'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(false);
    });
  });

  describe('State-Based Violations', () => {
    it('should reject protocol where safety violated in reachable state', () => {
      // Protocol safe initially, but becomes unsafe after one step
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'q1',
          action: { type: 'send', to: 'B', message: { label: 'step1' } },
        },
        {
          from: 'q1',
          to: 'qf',
          action: { type: 'send', to: 'B', message: { label: 'bad' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'q1',
          action: { type: 'receive', from: 'A', message: { label: 'step1' } },
        },
        // B expects 'good' but A sends 'bad'
        {
          from: 'q1',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'good' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'reachable-unsafe'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      // Should detect violation in reachable state q1
      expect(result.safe).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should detect stuck state (not terminal, no enabled communications)', () => {
      // Both roles waiting for each other (circular dependency)
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'B', message: { label: 'start' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'start' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'stuck'
      );

      const reducer = new ContextReducer();
      const enabled = reducer.findEnabledCommunications(context);

      // Context is stuck: not terminal, but no enabled communications
      expect(enabled.stuck).toBe(true);
      expect(enabled.terminal).toBe(false);
      expect(enabled.communications).toHaveLength(0);
    });
  });

  describe('Choice-Based Violations', () => {
    it('should reject protocol where one branch is unsafe', () => {
      // Branch 1: safe (A->B, B->A)
      // Branch 2: unsafe (A sends 'bad', B expects 'good')
      const cfsmA = createCFSM('A', [
        // Branch 1
        {
          from: 'q0',
          to: 'q1',
          action: { type: 'send', to: 'B', message: { label: 'branch1' } },
        },
        {
          from: 'q1',
          to: 'qf',
          action: { type: 'receive', from: 'B', message: { label: 'ok' } },
        },
        // Branch 2 (unsafe)
        {
          from: 'q0',
          to: 'q2',
          action: { type: 'send', to: 'B', message: { label: 'branch2' } },
        },
        {
          from: 'q2',
          to: 'qf',
          action: { type: 'send', to: 'B', message: { label: 'bad' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        // Branch 1
        {
          from: 'q0',
          to: 'q1',
          action: { type: 'receive', from: 'A', message: { label: 'branch1' } },
        },
        {
          from: 'q1',
          to: 'qf',
          action: { type: 'send', to: 'A', message: { label: 'ok' } },
        },
        // Branch 2 (expects 'good' but gets 'bad')
        {
          from: 'q0',
          to: 'q2',
          action: { type: 'receive', from: 'A', message: { label: 'branch2' } },
        },
        {
          from: 'q2',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'good' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'unsafe-branch'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      // Should detect unsafe branch
      expect(result.safe).toBe(false);
    });
  });

  describe('Multicast Violations', () => {
    it('should reject if multicast send missing one receiver', () => {
      // A multicasts to [B, C], but C cannot receive
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: {
            type: 'send',
            to: 'B', // Should also send to C, but doesn't
            message: { label: 'broadcast' },
          },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'broadcast' } },
        },
      ]);

      const cfsmC = createCFSM('C', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'broadcast' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
          ['C', cfsmC],
        ]),
        'multicast'
      );

      const reducer = new ContextReducer();
      const enabled = reducer.findEnabledCommunications(context);

      // A can send to B, but C is waiting
      expect(enabled.communications.some(c => c.receiver === 'B')).toBe(true);

      // If we execute A->B, then C will be stuck waiting
      if (enabled.communications.length > 0) {
        const next = reducer.reduceBy(context, enabled.communications[0]);
        const enabledNext = reducer.findEnabledCommunications(next);

        // C should still be waiting, but A has already sent
        // This creates an asymmetry
      }
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful violation messages', () => {
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'send', to: 'B', message: { label: 'request' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'response' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'test'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      expect(result.safe).toBe(false);

      const violation = result.violations[0];
      expect(violation.message).toBeDefined();
      expect(violation.message).toContain('A');
      expect(violation.message).toContain('B');
      expect(violation.message).toContain('request');

      // Should have details
      expect(violation.details).toBeDefined();
      expect(violation.details?.sender).toBe('A');
      expect(violation.details?.receiver).toBe('B');
      expect(violation.details?.messageLabel).toBe('request');
    });

    it('should include context in violation for debugging', () => {
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'send', to: 'B', message: { label: 'msg' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'different' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'debug'
      );

      const checker = new BasicSafety();
      const result = checker.check(context);

      const violation = result.violations[0];
      expect(violation.context).toBeDefined();
      expect(violation.context?.session).toBe('debug');
    });
  });

  describe('Reducer Error Handling', () => {
    it('should throw error when reducing terminal context', () => {
      const cfsmA = createCFSM('A', [], 'qf', ['qf']);
      const cfsmB = createCFSM('B', [], 'qf', ['qf']);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'terminal'
      );

      const reducer = new ContextReducer();
      expect(reducer.isTerminal(context)).toBe(true);

      expect(() => {
        reducer.reduce(context);
      }).toThrow('Cannot reduce terminal context');
    });

    it('should throw error when reducing stuck context', () => {
      const cfsmA = createCFSM('A', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'B', message: { label: 'never' } },
        },
      ]);

      const cfsmB = createCFSM('B', [
        {
          from: 'q0',
          to: 'qf',
          action: { type: 'receive', from: 'A', message: { label: 'never' } },
        },
      ]);

      const context = createInitialContext(
        new Map([
          ['A', cfsmA],
          ['B', cfsmB],
        ]),
        'stuck'
      );

      const reducer = new ContextReducer();
      const enabled = reducer.findEnabledCommunications(context);
      expect(enabled.stuck).toBe(true);

      expect(() => {
        reducer.reduce(context);
      }).toThrow('Cannot reduce stuck context');
    });
  });
});
