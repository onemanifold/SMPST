import { parse } from './src/core/parser/parser';
import { buildCFG } from './src/core/cfg/builder';

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

console.log('=== NODES ===');
cfg.nodes.forEach(n => {
  const extra = n.type === 'recursive' ? ` (label=${(n as any).label})` : '';
  const branchInfo = n.type === 'branch' ? ` (at=${(n as any).at})` : '';
  const actionInfo = n.type === 'action' ? ` - ${JSON.stringify((n as any).action)}` : '';
  console.log(`${n.id}: ${n.type}${actionInfo}${extra}${branchInfo}`);
});

console.log('\n=== EDGES ===');
cfg.edges.forEach(e => {
  console.log(`${e.from} -> ${e.to} [${e.edgeType}${e.label ? ' "' + e.label + '"' : ''}]`);
});
