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

    // Run step by step to see what happens
    console.log('\n=== Step-by-step execution ===');
    for (let i = 0; i < 10; i++) {
      const stepResult = await simulator.step();
      const state = simulator.getState();
      console.log(`\nStep ${i + 1}:`);
      console.log('  Client:', state.roles.get('Client')?.currentState, '| completed:', state.roles.get('Client')?.completed, '| blocked:', state.roles.get('Client')?.blocked, '| pending msgs:', state.roles.get('Client')?.pendingMessages);
      console.log('  Server:', state.roles.get('Server')?.currentState, '| completed:', state.roles.get('Server')?.completed, '| blocked:', state.roles.get('Server')?.blocked, '| pending msgs:', state.roles.get('Server')?.pendingMessages);
      console.log('  Overall completed:', state.completed, '| deadlocked:', state.deadlocked);

      if (state.completed || state.deadlocked) {
        console.log('  Stopping:', state.completed ? 'completed' : 'deadlocked');
        break;
      }
    }

    const finalState = simulator.getState();
    console.log('\n=== Final state ===');
    console.log('  Client completed:', finalState.roles.get('Client')?.completed);
    console.log('  Server completed:', finalState.roles.get('Server')?.completed);
    console.log('  Overall completed:', finalState.completed);
    console.log('  Overall deadlocked:', finalState.deadlocked);

    console.log('\nClient state:');
    const clientState = finalState.roles.get('Client');
    console.log('  Current state:', clientState?.currentState);
    console.log('  Blocked:', clientState?.blocked);
    console.log('  Error:', clientState?.error);

    console.log('\nServer state:');
    const serverState = finalState.roles.get('Server');
    console.log('  Current state:', serverState?.currentState);
    console.log('  Blocked:', serverState?.blocked);
    console.log('  Error:', serverState?.error);
  });
});
