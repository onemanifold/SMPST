/**
 * Test multiple protocol definitions and cross-references
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { GlobalProtocolDeclaration } from '../../core/ast/types';

describe('Multi-Protocol Test', () => {
  it('should parse multiple protocol definitions', () => {
    const protocols = `
      protocol Sub(role Worker) {
        Worker -> Worker: Process();
      }

      protocol Main(role Manager, role Worker) {
        Manager calls Sub(Worker);
        Manager -> Worker: Done();
      }
    `;

    const ast = parse(protocols);
    expect(ast.declarations).toHaveLength(2);

    expect(ast.declarations[0].type).toBe('GlobalProtocolDeclaration');
    expect(ast.declarations[1].type).toBe('GlobalProtocolDeclaration');

    const sub = ast.declarations[0] as GlobalProtocolDeclaration;
    const main = ast.declarations[1] as GlobalProtocolDeclaration;

    expect(sub.name).toBe('Sub');
    expect(main.name).toBe('Main');
  });

  it('should handle nested protocol calls', () => {
    const protocols = `
      protocol SubSub(role W) {
        W -> W: DeepWork();
      }

      protocol Sub(role W) {
        W calls SubSub(W);
        W -> W: Work();
      }

      protocol Main(role M, role W) {
        M calls Sub(W);
        M -> W: Done();
      }
    `;

    const ast = parse(protocols);
    expect(ast.declarations).toHaveLength(3);

    // Check Main protocol has a call
    const main = ast.declarations[2] as GlobalProtocolDeclaration;
    expect(main.body[0].type).toBe('ProtocolCall');
  });

  it('should handle protocol calls in parallel branches', () => {
    const protocols = `
      protocol Task(role W) {
        W -> W: Process();
      }

      protocol Main(role Manager, role W1, role W2) {
        par {
          Manager calls Task(W1);
        } and {
          Manager calls Task(W2);
        }
      }
    `;

    const ast = parse(protocols);
    expect(ast.declarations).toHaveLength(2);

    const main = ast.declarations[1] as GlobalProtocolDeclaration;
    expect(main.body[0].type).toBe('Parallel');
  });

  it('should handle protocol calls in updatable recursion', () => {
    const protocols = `
      protocol SubTask(role W) {
        W -> W: SubWork();
      }

      protocol Main(role Manager, role Worker) {
        rec Loop {
          Manager -> Worker: Start();
          choice at Manager {
            continue Loop with {
              Manager calls SubTask(Worker);
            };
          } or {
            Manager -> Worker: Stop();
          }
        }
      }
    `;

    const ast = parse(protocols);
    expect(ast.declarations).toHaveLength(2);

    const main = ast.declarations[1] as GlobalProtocolDeclaration;
    const cfg = buildCFG(main);

    expect(cfg.nodes.length).toBeGreaterThan(0);
  });
});
