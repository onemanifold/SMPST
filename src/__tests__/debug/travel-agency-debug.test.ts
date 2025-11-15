/**
 * Debug test for Travel Agency Protocol (Figure 4.2)
 *
 * Investigating why Travel Agency is reporting unsafe when it should be safe.
 * This is from "Less is More" paper Figure 4.2.
 */

import { describe, it } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { createInitialContext } from '../../core/safety/utils';
import { BasicSafety } from '../../core/safety/safety-checker';
import { ContextReducer } from '../../core/safety/context-reducer';

const travelAgencyProtocol = `
  global protocol TravelAgency(role c, role a, role s) {
    choice at c {
      query() from c to a;
      quote(Int) from a to c;
      choice at c {
        accept() from c to a;
        invoice(Int) from a to c;
        pay() from c to a;
        confirm() from a to s;
      } or {
        reject() from c to a;
      }
    } or {
      cancel() from c to a;
    }
  }
`;

describe('Travel Agency Debug', () => {
  it('should debug Travel Agency CFSM structure and violations', () => {
    console.log('\n=== Travel Agency Protocol Debug ===\n');
    console.log('Protocol source:');
    console.log(travelAgencyProtocol);
    console.log('\n');

    // Parse, build CFG, project to CFSMs
    const ast = parse(travelAgencyProtocol);
    const cfg = buildCFG(ast.declarations[0]);
    const projectionResult = projectAll(cfg);
    const cfsms = projectionResult.cfsms;

    console.log('=== CFSM Analysis ===\n');

    // Inspect each CFSM
    for (const [role, cfsm] of cfsms) {
      console.log(`\nRole: ${role}`);
      console.log(`  States: ${cfsm.states.length} - [${cfsm.states.join(', ')}]`);
      console.log(`  Initial: ${cfsm.initialState}`);
      console.log(`  Terminal: [${cfsm.terminalStates.join(', ')}]`);
      console.log(`  Transitions: ${cfsm.transitions.length}`);

      console.log('  Transition details:');
      for (const trans of cfsm.transitions) {
        const actionStr = trans.action.type === 'send'
          ? `send(${trans.action.to}, ${trans.action.message.label})`
          : trans.action.type === 'receive'
          ? `receive(${trans.action.from}, ${trans.action.message.label})`
          : 'tau';
        console.log(`    ${trans.from} -> ${trans.to}: ${actionStr}`);
      }
    }

    console.log('\n=== Initial Context ===\n');

    // Create context and show initial states
    const context = createInitialContext(cfsms, 'TravelAgency');
    for (const [role, instance] of context.cfsms) {
      const isTerminal = instance.machine.terminalStates.includes(instance.currentState);
      console.log(`  ${role}: ${instance.currentState} (terminal: ${isTerminal})`);
    }

    console.log('\n=== Safety Check ===\n');

    // Run safety check
    const checker = new BasicSafety();
    const result = checker.check(context);

    console.log(`Safe: ${result.safe}`);
    console.log(`Violations: ${result.violations.length}`);

    if (result.violations.length > 0) {
      console.log('\nViolation Details:');
      for (const violation of result.violations) {
        console.log(`\n  Type: ${violation.type}`);
        console.log(`  Message: ${violation.message}`);
        if (violation.details) {
          console.log(`  Details:`, JSON.stringify(violation.details, null, 2));
        }
      }
    }

    console.log('\n=== Enabled Communications ===\n');

    const reducer = new ContextReducer();
    const enabled = reducer.findEnabledCommunications(context);

    console.log(`Terminal: ${enabled.terminal}`);
    console.log(`Stuck: ${enabled.stuck}`);
    console.log(`Enabled communications: ${enabled.communications.length}`);

    if (enabled.communications.length > 0) {
      console.log('\nCommunications:');
      for (const comm of enabled.communications) {
        console.log(`  ${comm.sender} -> ${comm.receiver}: ${comm.message}`);
      }
    }

    console.log('\n=== End Debug ===\n');
  });
});
