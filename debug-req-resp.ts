import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol RequestResponse(role Client, role Server) {
    Client -> Server: Request();
    Server -> Client: Response();
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);

console.log('=== CFG Structure ===');
console.log('Nodes:', cfg.nodes.map(n => `${n.id}:${n.type}`).join(', '));
console.log('Edges:', cfg.edges.map(e => `${e.from}->${e.to}`).join(', '));

console.log('\n=== Simulation ===');
const simulator = new CFGSimulator(cfg);

console.log('After construction:');
console.log('  currentNode:', simulator.getState().currentNode);
console.log('  isComplete:', simulator.isComplete());

console.log('\nStep 1:');
const step1 = simulator.step();
console.log('  success:', step1.success);
if (step1.event?.type === 'message') {
  console.log('  message:', step1.event.from, '->', step1.event.to, ':', step1.event.label);
}
console.log('  currentNode:', simulator.getState().currentNode);
console.log('  isComplete:', simulator.isComplete());

console.log('\nStep 2:');
const step2 = simulator.step();
console.log('  success:', step2.success);
if (step2.event?.type === 'message') {
  console.log('  message:', step2.event.from, '->', step2.event.to, ':', step2.event.label);
}
console.log('  currentNode:', simulator.getState().currentNode);
console.log('  isComplete:', simulator.isComplete());
