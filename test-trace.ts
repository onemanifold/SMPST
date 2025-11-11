import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';
import { CFGSimulator } from './src/core/simulation/cfg-simulator';

const source = `
  protocol TraceTest(role A, role B) {
    A -> B: Request();
    B -> A: Response();
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);
const simulator = new CFGSimulator(cfg, { recordTrace: true });

simulator.step();
simulator.step();

const trace = simulator.getTrace();
console.log('Events count:', trace.events.length);
console.log('Events:', JSON.stringify(trace.events, null, 2));
