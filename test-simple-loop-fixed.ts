import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol SimpleLoop(role A, role B) {
    rec Loop {
      A -> B: Data();
      continue Loop;
    }
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);
const simulator = new CFGSimulator(cfg, { maxSteps: 5 });

console.log('=== Initial State ===');
console.log('currentNode:', simulator.getState().currentNode);
console.log('stepCount:', simulator.getState().stepCount);
console.log('');

for (let i = 0; i < 6; i++) {
  console.log(`=== Iteration ${i + 1} ===`);
  const step = simulator.step();
  console.log('success:', step.success);
  console.log('event:', step.event);
  console.log('currentNode:', simulator.getState().currentNode);
  console.log('stepCount:', simulator.getState().stepCount);
  console.log('reachedMaxSteps:', simulator.getState().reachedMaxSteps);
  console.log('completed:', simulator.getState().completed);
  console.log('');

  if (!step.success || simulator.getState().completed) {
    break;
  }
}
