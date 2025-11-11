import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol Choice(role A, role B) {
    choice at A {
      A -> B: Opt1();
    } or {
      A -> B: Opt2();
    }
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);

console.log('=== CFG Structure ===');
console.log('Nodes:', cfg.nodes.map(n => `${n.id}:${n.type}`).join(', '));
console.log('Edges:', cfg.edges.map(e => `${e.from}->${e.to}${e.label ? `[${e.label}]` : ''}`).join(', '));

console.log('\n=== Simulation ===');
const simulator = new CFGSimulator(cfg);

console.log('Initial state:');
const state0 = simulator.getState();
console.log('  currentNode:', state0.currentNode);
console.log('  atChoice:', state0.atChoice);
console.log('  availableChoices:', state0.availableChoices);

console.log('\nCalling step()...');
const step1 = simulator.step();
console.log('Result:');
console.log('  success:', step1.success);
console.log('  error:', step1.error);
console.log('  event:', step1.event);

const state1 = simulator.getState();
console.log('After step:');
console.log('  currentNode:', state1.currentNode);
console.log('  atChoice:', state1.atChoice);
console.log('  availableChoices:', state1.availableChoices);
console.log('  completed:', state1.completed);
