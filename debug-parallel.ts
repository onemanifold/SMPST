import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';

const source = `
  protocol Par(role A, role B, role C) {
    par {
      A -> B: M1();
    } and {
      C -> B: M2();
    }
  }
`;

const ast = parse(source);
const cfg = buildCFG(ast.declarations[0]);

console.log('=== NODES ===');
cfg.nodes.forEach(n => {
  const extra = n.type === 'fork' || n.type === 'join' ? ` (parallel_id=${(n as any).parallel_id})` : '';
  const actionInfo = n.type === 'action' ? ` - ${JSON.stringify((n as any).action)}` : '';
  console.log(`${n.id}: ${n.type}${actionInfo}${extra}`);
});

console.log('\n=== EDGES ===');
cfg.edges.forEach(e => {
  console.log(`${e.from} -> ${e.to} [${e.edgeType}${e.label ? ' "' + e.label + '"' : ''}]`);
});
