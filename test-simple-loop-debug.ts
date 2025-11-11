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

console.log('=== CFG STRUCTURE ===');
cfg.edges.forEach(e => {
  console.log(`${e.from} -> ${e.to} [${e.edgeType}]`);
});
console.log('');

const simulator = new CFGSimulator(cfg, { maxSteps: 5 });

console.log('=== After Construction ===');
const state = simulator.getState();
console.log('currentNode:', state.currentNode);
const node = cfg.nodes.find(n => n.id === state.currentNode);
console.log('currentNode type:', node?.type);
if (node?.type === 'action') {
  console.log('action:', (node as any).action);
}
console.log('');

// Check outgoing edges from current node
const outgoing = cfg.edges.filter(e => e.from === state.currentNode);
console.log('Outgoing edges from currentNode:');
outgoing.forEach(e => {
  console.log(`  ${e.from} -> ${e.to} [${e.edgeType}]`);
});
console.log('');

console.log('=== First Step ===');
try {
  const result = simulator.step();
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (err: any) {
  console.log('ERROR:', err.message);
  console.log(err.stack);
}
