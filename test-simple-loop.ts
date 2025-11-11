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

console.log('=== Simple Loop Test (maxSteps=5) ===');
for (let i = 1; i <= 6; i++) {
  console.log(`\nStep ${i}:`);
  const result = simulator.step();
  console.log('  success:', result.success);
  console.log('  error:', result.error?.message);
  if (result.event?.type === 'message') {
    console.log('  message:', result.event.from, '->', result.event.to, ':', result.event.label);
  }
  const state = simulator.getState();
  console.log('  stepCount:', state.stepCount);
  console.log('  reachedMaxSteps:', state.reachedMaxSteps);
  console.log('  completed:', state.completed);

  if (!result.success || state.completed) break;
}
