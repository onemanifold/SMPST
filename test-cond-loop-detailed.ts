import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol ConditionalLoop(role Producer, role Consumer) {
    rec Stream {
      choice at Producer {
        Producer -> Consumer: Data();
        continue Stream;
      } or {
        Producer -> Consumer: End();
      }
    }
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);
const simulator = new CFGSimulator(cfg);

console.log('=== Iteration 1: Choose branch 0 (Data + continue) ===');
console.log('Before choose - atChoice:', simulator.getState().atChoice);
simulator.choose(0);
console.log('After choose - selectedChoice:', (simulator as any).selectedChoice);

const step1 = simulator.step();
console.log('\nAfter step:');
console.log('  success:', step1.success);
if (step1.event?.type === 'message') {
  console.log('  message:', step1.event.from, '->', step1.event.to, ':', step1.event.label);
}
console.log('  currentNode:', simulator.getState().currentNode);
console.log('  atChoice:', simulator.getState().atChoice);
console.log('  completed:', simulator.getState().completed);

console.log('\n=== Iteration 2: Choose branch 0 again ===');
simulator.choose(0);
const step2 = simulator.step();
console.log('After step:');
console.log('  success:', step2.success);
if (step2.event?.type === 'message') {
  console.log('  message:', step2.event.from, '->', step2.event.to, ':', step2.event.label);
}
console.log('  currentNode:', simulator.getState().currentNode);
console.log('  atChoice:', simulator.getState().atChoice);

console.log('\n=== Exit: Choose branch 1 (End, no continue) ===');
simulator.choose(1);
const step3 = simulator.step();
console.log('After step:');
console.log('  success:', step3.success);
if (step3.event?.type === 'message') {
  console.log('  message:', step3.event.from, '->', step3.event.to, ':', step3.event.label);
}
console.log('  currentNode:', simulator.getState().currentNode);
console.log('  atChoice:', simulator.getState().atChoice);
console.log('  completed:', simulator.getState().completed);
