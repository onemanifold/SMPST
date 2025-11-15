/**
 * Debug test for Orphan Receive
 */

import { describe, it } from 'vitest';
import { createInitialContext } from '../../core/safety/utils';
import { BasicSafety } from '../../core/safety/safety-checker';
import { ContextReducer } from '../../core/safety/context-reducer';
import type { CFSM } from '../../core/projection/types';

function createCFSM(role: string, transitions: any[]): CFSM {
  const states = new Set<string>();
  transitions.forEach(t => {
    states.add(t.from);
    states.add(t.to);
  });

  return {
    role,
    states: Array.from(states).map(id => ({ id })),
    initialState: 'q0',
    terminalStates: ['qf'],
    transitions: transitions.map((t, i) => ({
      id: `t${i}`,
      from: t.from,
      to: t.to,
      action: t.action,
    })),
  };
}

describe('Orphan Receive Debug', () => {
  it('should debug orphan receive scenario', () => {
    console.log('\n=== Orphan Receive Debug ===\n');

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

    console.log('CFSM A:');
    console.log(`  Initial: ${cfsmA.initialState}`);
    console.log(`  Terminal: ${cfsmA.terminalStates.join(', ')}`);
    console.log('  Transitions:');
    for (const t of cfsmA.transitions) {
      console.log(`    ${t.from} -> ${t.to}: ${t.action.type}`);
    }

    console.log('\nCFSM B:');
    console.log(`  Initial: ${cfsmB.initialState}`);
    console.log(`  Terminal: ${cfsmB.terminalStates.join(', ')}`);
    console.log('  Transitions:');
    for (const t of cfsmB.transitions) {
      const action = t.action.type === 'receive'
        ? `receive(${t.action.from}, ${t.action.message.label})`
        : t.action.type;
      console.log(`    ${t.from} -> ${t.to}: ${action}`);
    }

    const context = createInitialContext(
      new Map([
        ['A', cfsmA],
        ['B', cfsmB],
      ]),
      'orphan'
    );

    console.log('\n=== Initial Context (after tau-closure) ===\n');
    for (const [role, instance] of context.cfsms) {
      const isTerminal = instance.machine.terminalStates.includes(instance.currentState);
      console.log(`  ${role}: ${instance.currentState} (terminal: ${isTerminal})`);
    }

    const checker = new BasicSafety();
    const result = checker.check(context);

    console.log('\n=== Safety Check ===\n');
    console.log(`Safe: ${result.safe}`);
    console.log(`Violations: ${result.violations.length}`);

    if (result.violations.length > 0) {
      console.log('\nViolations:');
      for (const v of result.violations) {
        console.log(`  ${v.type}: ${v.message}`);
      }
    }

    const reducer = new ContextReducer();
    const enabled = reducer.findEnabledCommunications(context);

    console.log('\n=== Enabled Communications ===\n');
    console.log(`Terminal: ${enabled.terminal}`);
    console.log(`Stuck: ${enabled.stuck}`);
    console.log(`Enabled: ${enabled.communications.length}`);

    console.log('\n=== Analysis ===\n');
    console.log('A is at terminal state qf (after tau-closure)');
    console.log('B is at q0 with enabled receive from A');
    console.log('But A has no sends (it\'s terminal)');
    console.log('');
    console.log('Definition 4.1: For each enabled SEND, there must be a matching receive');
    console.log('Here: No enabled sends, so property is vacuously satisfied');
    console.log('Result: Safe (but stuck!)');
    console.log('');
    console.log('This is a LIVENESS issue, not a SAFETY issue.');
    console.log('The test expectation may be incorrect.');

    console.log('\n=== End Debug ===\n');
  });
});
