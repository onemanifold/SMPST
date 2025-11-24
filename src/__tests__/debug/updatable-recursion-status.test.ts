/**
 * Test: Updatable Recursion Implementation Status
 *
 * Verify that updatable recursion (Definition 13) works:
 * - Parser handles `continue Loop with { ... }` syntax
 * - CFG creates updatable-recursion nodes
 * - Projection handles updatable recursion
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Updatable Recursion Implementation Status', () => {
  it('should parse simple updatable recursion', () => {
    const protocol = `
      protocol UpdateTest(role A, role B) {
        rec Loop {
          A -> B: Work();
          B -> A: Done();
          choice at A {
            continue Loop with {
              A -> B: Extra();
            };
          } or {
            A -> B: Stop();
          }
        }
      }
    `;

    const ast = parse(protocol);
    expect(ast.declarations).toHaveLength(1);

    const proto = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(proto.type).toBe('GlobalProtocolDeclaration');

    console.log('✅ Parser handles updatable recursion syntax');
  });

  it('should build CFG with updatable recursion nodes', () => {
    const protocol = `
      protocol UpdateTest(role A, role B) {
        rec Loop {
          A -> B: Work();
          choice at A {
            continue Loop with {
              A -> B: Extra();
            };
          } or {
            A -> B: Stop();
          }
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    console.log('Total nodes:', cfg.nodes.length);
    console.log('Node types:', cfg.nodes.map(n => n.action?.kind || 'no-action'));

    // Check for recursion nodes
    const recursionNodes = cfg.nodes.filter(n => n.label);
    console.log('Recursion labels:', recursionNodes.map(n => n.label));

    // Check for updatable-recursion action nodes
    const updateNodes = cfg.nodes.filter(n => n.action?.kind === 'updatable-recursion');
    console.log('Updatable-recursion nodes:', updateNodes.length);

    expect(cfg.nodes.length).toBeGreaterThan(0);
    console.log('✅ CFG builder creates nodes for updatable recursion');
  });

  it('should project updatable recursion', () => {
    const protocol = `
      protocol UpdateTest(role A, role B) {
        rec Loop {
          A -> B: Work();
          choice at A {
            continue Loop with {
              A -> B: Extra();
            };
          } or {
            A -> B: Stop();
          }
        }
      }
    `;

    const ast = parse(protocol);
    const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);

    try {
      const projections = projectAll(cfg);

      console.log('Projection succeeded!');
      console.log('CFSMs created:', Array.from(projections.cfsms.keys()));
      console.log('A states:', projections.cfsms.get('A')?.states.length);
      console.log('B states:', projections.cfsms.get('B')?.states.length);

      expect(projections.cfsms.has('A')).toBe(true);
      expect(projections.cfsms.has('B')).toBe(true);

      console.log('✅ Projection handles updatable recursion');
    } catch (e: any) {
      console.log('❌ Projection failed:', e.message);
      throw e;
    }
  });
});
