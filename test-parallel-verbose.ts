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
console.log('inParallel:', simulator.getState().inParallel);
console.log('');

for (let i = 1; i <= 5; i++) {
  console.log(`=== Step ${i} ===`);
  const result = simulator.step();
  console.log('success:', result.success);
  console.log('error:', result.error);
  if (result.event?.type === 'message') {
    console.log('message:', result.event.from, '->', result.event.to, ':', result.event.label);
  } else if (result.event) {
    console.log('event:', result.event.type);
  }
  const state = simulator.getState();
  console.log('inParallel:', state.inParallel);
  console.log('completed:', state.completed);
  console.log('');

  if (!result.success || state.completed) break;
}
