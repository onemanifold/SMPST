import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';

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

console.log('=== NODES ===');
cfg.nodes.forEach(n => {
  const extra = n.type === 'recursive' ? ` (label=${(n as any).label})` : '';
  const actionInfo = n.type === 'action' ? ` - ${JSON.stringify((n as any).action)}` : '';
  console.log(`${n.id}: ${n.type}${actionInfo}${extra}`);
});

console.log('\n=== EDGES ===');
cfg.edges.forEach(e => {
  console.log(`${e.from} -> ${e.to} [${e.edgeType}${e.label ? ' "' + e.label + '"' : ''}]`);
});
