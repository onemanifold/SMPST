/**
 * Debug test for Three Buyer Protocol
 *
 * Investigating why Three Buyer is reporting unsafe when it should be safe.
 * This is a classic MPST example from the literature.
 */

import { describe, it } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { createInitialContext } from '../../core/safety/utils';
import { BasicSafety } from '../../core/safety/safety-checker';
import { ContextReducer } from '../../core/safety/context-reducer';

const threeBuyerProtocol = `
  global protocol ThreeBuyer(role S, role B1, role B2, role B3) {
    title(Str) from S to B1;
    title(Str) from B1 to B2;
    title(Str) from B1 to B3;
    ready() from B1 to S;
    price(Int) from S to B1;
    price(Int) from B1 to B2;
    price(Int) from B1 to B3;
    ready() from B1 to S;
    share(Int) from B2 to B1;
    share(Int) from B3 to B1;
    choice at B1 {
      ok() from B1 to S;
      ok() from B1 to B2;
      ok() from B1 to B3;
      addr(Str) from B2 to S;
    } or {
      quit() from B1 to S;
      quit() from B1 to B2;
      quit() from B1 to B3;
    }
  }
`;

describe('Three Buyer Debug', () => {
  it('should debug Three Buyer CFSM structure and violations', () => {
    console.log('\n=== Three Buyer Protocol Debug ===\n');
    console.log('Protocol source:');
    console.log(threeBuyerProtocol);
    console.log('\n');

    // Parse, build CFG, project to CFSMs
    const ast = parse(threeBuyerProtocol);
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
    const context = createInitialContext(cfsms, 'ThreeBuyer');
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

    console.log('\n=== Execution Trace ===\n');

    // Try to execute protocol to completion
    try {
      const trace = reducer.executeToCompletion(context, 100);
      console.log(`Execution completed in ${trace.length - 1} steps`);

      console.log('\nTrace:');
      for (let i = 0; i < trace.length; i++) {
        console.log(`\nStep ${i}:`);
        for (const [role, instance] of trace[i].cfsms) {
          console.log(`  ${role}: ${instance.currentState}`);
        }

        if (i < trace.length - 1) {
          const comms = reducer.findEnabledCommunications(trace[i]);
          if (comms.communications.length > 0) {
            const comm = comms.communications[0];
            console.log(`  -> ${comm.sender} -> ${comm.receiver}: ${comm.message}`);
          }
        }
      }
    } catch (error) {
      console.log('Execution failed:', (error as Error).message);
    }

    console.log('\n=== End Debug ===\n');
  });
});
