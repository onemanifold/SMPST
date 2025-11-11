import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol Simple(role A, role B) {
    A -> B: Hello();
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);

console.log('=== CFG Structure ===');
console.log('Nodes:', cfg.nodes.map(n => `${n.id}:${n.type}`).join(', '));
console.log('Edges:', cfg.edges.map(e => `${e.from}->${e.to}`).join(', '));

console.log('\n=== Simulation ===');
const simulator = new CFGSimulator(cfg);

let step = 0;
while (!simulator.isComplete() && step < 10) {
  step++;
  console.log(`\n--- Step ${step} ---`);
  const state = simulator.getState();
  console.log('Before: currentNode =', state.currentNode, ', completed =', state.completed);

  const result = simulator.step();
  console.log('Result: success =', result.success);
  if (result.error) {
    console.log('Error:', result.error);
  }
  if (result.event) {
    console.log('Event:', result.event.type);
    if (result.event.type === 'message') {
      console.log('  ', result.event.from, '->', result.event.to, ':', result.event.label);
    }
  } else {
    console.log('Event: none');
  }

  const afterState = simulator.getState();
  console.log('After: currentNode =', afterState.currentNode, ', completed =', afterState.completed);

  if (!result.success) break;
}

console.log('\n=== Final State ===');
console.log('isComplete:', simulator.isComplete());
console.log('stepCount:', simulator.getState().stepCount);
