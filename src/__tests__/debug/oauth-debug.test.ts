/**
 * Debug test to investigate OAuth protocol projection
 */

import { describe, it } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { createInitialContext } from '../../core/safety/utils';
import { ContextReducer } from '../../core/safety/context-reducer';
import { BasicSafety } from '../../core/safety/safety-checker';

describe('OAuth Debug', () => {
  it('should debug OAuth protocol projection and execution', () => {
    const oauthProtocol = `
      global protocol OAuth(role s, role c, role a) {
        choice at s {
          login() from s to c;
          passwd(Str) from c to a;
          auth(Bool) from a to s;
        } or {
          cancel() from s to c;
          quit() from c to a;
        }
      }
    `;

    console.log('\n=== OAuth Protocol Debug ===\n');

    // 1. Parse
    console.log('1. Parsing...');
    const ast = parse(oauthProtocol);
    console.log('✓ Parsed successfully');
    console.log('Declarations:', ast.declarations.length);

    // 2. Build CFG
    console.log('\n2. Building CFG...');
    const cfg = buildCFG(ast.declarations[0]);
    console.log('✓ CFG built');
    console.log('CFG nodes:', cfg.nodes.length);
    console.log('CFG edges:', cfg.edges.length);

    // 3. Project to CFSMs
    console.log('\n3. Projecting to CFSMs...');
    const projectionResult = projectAll(cfg);
    console.log('✓ Projection complete');
    console.log('Errors:', projectionResult.errors.length);
    if (projectionResult.errors.length > 0) {
      projectionResult.errors.forEach(e => console.log('  -', e.message));
    }

    const cfsms = projectionResult.cfsms;
    console.log('CFSMs created:', cfsms.size);

    // 4. Inspect each CFSM
    console.log('\n4. Inspecting CFSMs:');
    for (const [role, cfsm] of cfsms) {
      console.log(`\n  Role: ${role}`);
      console.log(`  States: ${cfsm.states.length}`);
      console.log(`  Transitions: ${cfsm.transitions.length}`);
      console.log(`  Initial: ${cfsm.initialState}`);
      console.log(`  Terminal: ${cfsm.terminalStates.join(', ')}`);

      console.log(`  State details:`);
      cfsm.states.forEach(s => {
        console.log(`    - ${s.id}: terminal=${s.terminal}`);
      });

      console.log(`  Transition details:`);
      cfsm.transitions.forEach(t => {
        console.log(`    - ${t.from} -> ${t.to}: ${t.action.type}`, t.action);
      });
    }

    // 5. Create initial context
    console.log('\n5. Creating initial context...');
    const context = createInitialContext(cfsms, 'OAuth');
    console.log('✓ Context created');
    console.log('Context roles:', Array.from(context.cfsms.keys()).join(', '));
    console.log('Context states:');
    for (const [role, instance] of context.cfsms) {
      console.log(`  ${role}: ${instance.currentState}`);
    }

    // 6. Find enabled communications
    console.log('\n6. Finding enabled communications...');
    const reducer = new ContextReducer();
    const enabled = reducer.findEnabledCommunications(context);
    console.log('Stuck:', enabled.stuck);
    console.log('Terminal:', enabled.terminal);
    console.log('Communications:', enabled.communications.length);

    if (enabled.communications.length > 0) {
      enabled.communications.forEach((comm, i) => {
        console.log(`  ${i}: ${comm.sender} -> ${comm.receiver}: ${comm.message}`);
        console.log(`      Sender transition: ${comm.senderTransition}`);
        console.log(`      Receiver transition: ${comm.receiverTransition}`);
      });
    } else {
      console.log('  ⚠️ No enabled communications found!');
    }

    // 7. Check terminal status
    console.log('\n7. Checking terminal status...');
    const isTerminal = reducer.isTerminal(context);
    console.log('Is terminal:', isTerminal);

    // 8. Run safety check
    console.log('\n8. Running safety check...');
    const checker = new BasicSafety();
    const result = checker.check(context);
    console.log('Safe:', result.safe);
    console.log('Violations:', result.violations.length);
    if (result.violations.length > 0) {
      result.violations.forEach(v => {
        console.log(`  - ${v.type}: ${v.message}`);
      });
    }
    console.log('States explored:', result.diagnostics?.statesExplored);

    console.log('\n=== Debug Complete ===\n');
  });
});
