/**
 * Test nested recursion to verify if it's supported
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Nested Recursion Test', () => {
  it('should parse nested recursion', () => {
    const protocol = `
      protocol NestedRec(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            A -> B: Work();
            choice at B {
              continue Inner;
            } or {
              B -> A: InnerDone();
            }
          }
          choice at A {
            continue Outer;
          } or {
            A -> B: OuterDone();
          }
        }
      }
    `;

    const ast = parse(protocol);
    expect(ast.declarations).toHaveLength(1);

    const proto = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(proto.body[0].type).toBe('Recursion');
  });

  it('should build CFG for nested recursion', () => {
    const protocol = `
      protocol NestedRec(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            A -> B: Work();
            choice at B {
              continue Inner;
            } or {
              B -> A: InnerDone();
            }
          }
          B -> A: OuterDone();
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    // Should have recursive nodes for both Outer and Inner
    const recNodes = cfg.nodes.filter(n => n.type === 'recursive');
    expect(recNodes.length).toBeGreaterThanOrEqual(2);
  });
});
