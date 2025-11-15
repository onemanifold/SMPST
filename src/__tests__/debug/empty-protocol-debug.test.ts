/**
 * Debug test for empty protocol terminal state issue
 */

import { describe, it } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { createInitialContext } from '../../core/safety/utils';
import { ContextReducer } from '../../core/safety/context-reducer';

describe('Empty Protocol Debug', () => {
  it('should debug empty protocol CFSM structure', () => {
    const empty = `
      global protocol Empty(role A, role B) {
        // No interactions - roles immediately terminate
      }
    `;

    console.log('\n=== Empty Protocol Debug ===\n');

    // 1. Parse
    console.log('1. Parsing...');
    const ast = parse(empty);
    console.log('✓ Parsed successfully');

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

    const cfsms = projectionResult.cfsms;
    console.log('CFSMs created:', cfsms.size);

    // 4. Inspect each CFSM
    console.log('\n4. Inspecting CFSMs:');
    for (const [role, cfsm] of cfsms) {
      console.log(`\n  Role: ${role}`);
      console.log(`  States: ${cfsm.states.length}`);
      console.log(`  Initial: ${cfsm.initialState}`);
      console.log(`  Terminal: ${cfsm.terminalStates.join(', ')}`);
      console.log(`  Transitions: ${cfsm.transitions.length}`);

      console.log(`  State details:`);
      cfsm.states.forEach(s => {
        const isInitial = s.id === cfsm.initialState;
        const isTerminal = cfsm.terminalStates.includes(s.id);
        console.log(`    - ${s.id}: initial=${isInitial}, terminal=${isTerminal}, label=${s.label}`);
      });

      console.log(`  Transition details:`);
      cfsm.transitions.forEach(t => {
        console.log(`    - ${t.from} -> ${t.to}: ${t.action.type}`);
      });
    }

    // 5. Create initial context
    console.log('\n5. Creating initial context...');
    const context = createInitialContext(cfsms, 'Empty');
    console.log('✓ Context created');
    console.log('Context states:');
    for (const [role, instance] of context.cfsms) {
      const isAtTerminal = instance.machine.terminalStates.includes(instance.currentState);
      console.log(`  ${role}: ${instance.currentState} (terminal: ${isAtTerminal})`);
    }

    // 6. Check terminal status
    console.log('\n6. Checking terminal status...');
    const reducer = new ContextReducer();
    const isTerminal = reducer.isTerminal(context);
    console.log('Is terminal:', isTerminal);

    // 7. Find enabled communications
    console.log('\n7. Finding enabled communications...');
    const enabled = reducer.findEnabledCommunications(context);
    console.log('Stuck:', enabled.stuck);
    console.log('Terminal:', enabled.terminal);
    console.log('Communications:', enabled.communications.length);

    console.log('\n=== Debug Complete ===\n');
  });
});
