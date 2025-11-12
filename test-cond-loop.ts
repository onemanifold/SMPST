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

console.log('=== After Construction ===');
const state0 = simulator.getState();
console.log('currentNode:', state0.currentNode);
console.log('atChoice:', state0.atChoice);
console.log('availableChoices:', state0.availableChoices);
console.log('recursionStack:', state0.recursionStack);

console.log('\n=== Step 1 ===');
const step1 = simulator.step();
console.log('success:', step1.success);
console.log('error:', step1.error);
if (step1.event?.type === 'message') {
  console.log('message:', step1.event.from, '->', step1.event.to, ':', step1.event.label);
}

const state1 = simulator.getState();
console.log('currentNode:', state1.currentNode);
console.log('atChoice:', state1.atChoice);
