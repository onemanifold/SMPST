import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol InfiniteLoop(role A, role B) {
    rec Loop {
      A -> B: Ping();
      continue Loop;
    }
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);
const simulator = new CFGSimulator(cfg, { maxSteps: 10 });

console.log('Before run:');
console.log('  completed:', simulator.getState().completed);
console.log('  reachedMaxSteps:', simulator.getState().reachedMaxSteps);
console.log('  stepCount:', simulator.getState().stepCount);
console.log('');

const result = simulator.run();

console.log('After run:');
console.log('  result.success:', result.success);
console.log('  result.steps:', result.steps);
console.log('  completed:', simulator.getState().completed);
console.log('  reachedMaxSteps:', simulator.getState().reachedMaxSteps);
console.log('  stepCount:', simulator.getState().stepCount);
