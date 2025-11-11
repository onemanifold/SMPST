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

console.log('\n=== CFG DUMP ===\n');
console.log('Nodes:');
cfg.nodes.forEach(n => {
  console.log(`  ${n.id}: type=${n.type}`);
  if (n.type === 'action') {
    console.log(`    action:`, JSON.stringify(n.action, null, 2));
  }
});

console.log('\nEdges:');
cfg.edges.forEach(e => {
  console.log(`  ${e.from} -> ${e.to} (type: ${e.edgeType || 'epsilon'})`);
});

console.log('\n=== SIMULATOR TEST ===\n');
const simulator = new CFGSimulator(cfg);
console.log('Initial state:', simulator.getState());

console.log('\nCalling step()...');
const result = simulator.step();
console.log('Result:', {
  success: result.success,
  error: result.error,
  event: result.event,
  currentNode: result.state.currentNode,
});
