import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { BisimulationCoordinator } from '../../core/simulation/bisimulation-coordinator';

describe('Bisimulation Debug', () => {
  it('should debug simple protocol execution', async () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: hello();
      }
    `;

    const ast = parse(source);
    const protocol = ast.declarations[0];
    const cfg = buildCFG(protocol);
    const { cfsms } = projectAll(cfg);

    console.log('\n=== CFSMs ===');
    for (const [role, cfsm] of cfsms) {
      console.log(`\n${role}:`);
      console.log('  States:', cfsm.states);
      console.log('  Initial:', cfsm.initial);
      console.log('  Transitions:', cfsm.transitions.map(t => ({
        from: t.from,
        to: t.to,
        action: t.action
      })));
    }

    const coordinator = new BisimulationCoordinator(cfg, cfsms, {
      choiceStrategy: 'first',
      maxSteps: 100,
    });

    console.log('\n=== Initial State ===');
    console.log('Coordinator complete:', coordinator.isComplete());
    console.log('Step count:', coordinator.getStepCount());

    const states0 = coordinator.getCFSMStates();
    for (const [role, state] of states0) {
      console.log(`${role}:`, state);
    }

    console.log('\n=== Stepping... ===');
    try {
      await coordinator.step();
      console.log('Step completed successfully');
    } catch (err: any) {
      console.error('Step failed:', err.message);
      console.error(err.stack);
    }

    console.log('\n=== After Step 1 ===');
    console.log('Coordinator complete:', coordinator.isComplete());
    console.log('Step count:', coordinator.getStepCount());

    const states1 = coordinator.getCFSMStates();
    for (const [role, state] of states1) {
      console.log(`${role}:`, state);
    }

    // Get CFG state
    console.log('\nCFG state:', coordinator.getCFGState());

    // Check debuggers directly
    const debuggerA = coordinator.getDebugger('A');
    const debuggerB = coordinator.getDebugger('B');
    console.log('\nDebugger A complete:', debuggerA?.isComplete());
    console.log('Debugger B complete:', debuggerB?.isComplete());

    expect(coordinator.isComplete()).toBe(true);
  });
});
