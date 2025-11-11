import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol Par(role A, role B, role C) {
    par {
      A -> B: M1();
    } and {
      C -> B: M2();
    }
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);
const simulator = new CFGSimulator(cfg);

console.log('=== After Construction ===');
const state0 = simulator.getState();
console.log('currentNode:', state0.currentNode);
console.log('inParallel:', state0.inParallel);
console.log('activeBranches:', state0.activeBranches);

console.log('\n=== Step 1 ===');
const step1 = simulator.step();
console.log('success:', step1.success);
console.log('event:', step1.event?.type);
if (step1.event?.type === 'message') {
  console.log('  ', step1.event.from, '->', step1.event.to, ':', step1.event.label);
}
console.log('currentNode:', simulator.getState().currentNode);
console.log('inParallel:', simulator.getState().inParallel);

console.log('\n=== Step 2 ===');
const step2 = simulator.step();
console.log('success:', step2.success);
console.log('event:', step2.event?.type);
if (step2.event?.type === 'message') {
  console.log('  ', step2.event.from, '->', step2.event.to, ':', step2.event.label);
}
console.log('currentNode:', simulator.getState().currentNode);
console.log('inParallel:', simulator.getState().inParallel);
console.log('isComplete:', simulator.isComplete());
