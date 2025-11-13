/**
 * Debug script for simulator completion issue
 */

import { describe, it } from 'vitest';
import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { projectAll } from './src/core/projection/projector';
import { Simulator } from './src/core/runtime/simulator';

describe('Debug Simulator', () => {
  it('should debug request-response protocol', async () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;

    console.log('=== Parsing and building CFG ===');
    const module = parse(source);
    const protocol = module.declarations[0];
    const cfg = buildCFG(protocol);
    console.log('CFG nodes:', cfg.nodes.length);
    console.log('CFG edges:', cfg.edges.length);

    console.log('\n=== Projecting to CFSMs ===');
    const { cfsms, errors } = projectAll(cfg);
    console.log('Projection errors:', errors);
    console.log('CFSM roles:', Array.from(cfsms.keys()));

    for (const [role, cfsm] of cfsms.entries()) {
      console.log(`\n${role} CFSM:`);
      console.log('  Initial:', cfsm.initialState);
      console.log('  Terminal:', cfsm.terminalStates);
      console.log('  States:', cfsm.states);
      console.log('  Transitions:', cfsm.transitions.length);
      cfsm.transitions.forEach((t, i) => {
        const actionStr = t.action ? `[${t.action.type} ${t.action.label || ''}]` : '[epsilon]';
        console.log(`    T${i}: ${t.from} -> ${t.to} ${actionStr}`);
      });
    }

    console.log('\n=== Running simulation ===');
    const simulator = new Simulator({ roles: cfsms });

    console.log('Initial state:');
    const initialState = simulator.getState();
    console.log('  Client completed:', initialState.roles.get('Client')?.completed);
    console.log('  Server completed:', initialState.roles.get('Server')?.completed);
    console.log('  Overall completed:', initialState.completed);
    console.log('  Overall deadlocked:', initialState.deadlocked);

    const result = await simulator.run();

    console.log('\n=== Final result ===');
    console.log('Result success:', result.success);
    console.log('Result completed:', result.completed);
    console.log('Result deadlocked:', result.deadlocked);
    console.log('Result error:', result.error);

    console.log('\nFinal state:');
    console.log('  Client completed:', result.state.roles.get('Client')?.completed);
    console.log('  Server completed:', result.state.roles.get('Server')?.completed);
    console.log('  Overall completed:', result.state.completed);
    console.log('  Overall deadlocked:', result.state.deadlocked);
    console.log('  Step count:', result.state.step);

    console.log('\nClient state:');
    const clientState = result.state.roles.get('Client');
    console.log('  Current state:', clientState?.currentState);
    console.log('  Blocked:', clientState?.blocked);
    console.log('  Error:', clientState?.error);

    console.log('\nServer state:');
    const serverState = result.state.roles.get('Server');
    console.log('  Current state:', serverState?.currentState);
    console.log('  Blocked:', serverState?.blocked);
    console.log('  Error:', serverState?.error);
  });
});
