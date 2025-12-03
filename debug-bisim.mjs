import { parse } from './src/core/parser/parser.js';
import { buildCFG } from './src/core/cfg/builder.js';
import { projectAll } from './src/core/projection/projector.js';
import { BisimulationCoordinator } from './src/core/simulation/bisimulation-coordinator.js';

const source = `
  protocol Simple(role A, role B) {
    A -> B: hello();
  }
`;

const ast = parse(source);
const protocol = ast.declarations[0];
const cfg = buildCFG(protocol);
const { cfsms } = projectAll(cfg);

console.log('CFSMs:', Array.from(cfsms.keys()));

const coordinator = new BisimulationCoordinator(cfg, cfsms, {
  choiceStrategy: 'first',
  maxSteps: 100,
});

console.log('Initial state:');
console.log('  Coordinator complete:', coordinator.isComplete());
console.log('  Step count:', coordinator.getStepCount());

const states = coordinator.getCFSMStates();
console.log('  CFSM states:');
for (const [role, state] of states) {
  console.log(`    ${role}:`, state);
}

try {
  await coordinator.step();
  console.log('\nAfter step 1:');
  console.log('  Coordinator complete:', coordinator.isComplete());
  console.log('  Step count:', coordinator.getStepCount());

  const states2 = coordinator.getCFSMStates();
  console.log('  CFSM states:');
  for (const [role, state] of states2) {
    console.log(`    ${role}:`, state);
  }
} catch (err) {
  console.error('Error during step:', err.message);
  console.error(err.stack);
}
