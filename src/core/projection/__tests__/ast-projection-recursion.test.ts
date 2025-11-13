/**
 * AST-based Local Protocol Projection - Recursion Tests
 *
 * Tests projection of recursion and continue constructs.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { projectForRole } from '../ast-projector';
import { serializeLocalProtocol } from '../../serializer/local-serializer';

describe('AST Projection - Recursion', () => {
  it('should project simple recursion', () => {
    const source = `
      protocol SimpleRecursion(role Client, role Server) {
        rec Loop {
          Client -> Server: Request();
          Server -> Client: Response();
          continue Loop;
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localClient = projectForRole(globalProtocol, 'Client');

    expect(localClient.body.length).toBe(1);
    expect(localClient.body[0].type).toBe('Recursion');

    const rec = localClient.body[0];
    if (rec.type === 'Recursion') {
      expect(rec.label).toBe('Loop');
      expect(rec.body.length).toBe(3); // send, receive, continue

      const body = rec.body as any[];
      expect(body[0].type).toBe('Send');
      expect(body[1].type).toBe('Receive');
      expect(body[2].type).toBe('Continue');
      expect(body[2].label).toBe('Loop');
    }
  });

  it('should project recursion with choice', () => {
    const source = `
      protocol RecursionWithChoice(role Client, role Server) {
        rec Loop {
          choice at Client {
            Client -> Server: More();
            Server -> Client: Data();
            continue Loop;
          } or {
            Client -> Server: Done();
          }
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localClient = projectForRole(globalProtocol, 'Client');

    expect(localClient.body.length).toBe(1);
    expect(localClient.body[0].type).toBe('Recursion');

    const rec = localClient.body[0];
    if (rec.type === 'Recursion') {
      expect(rec.label).toBe('Loop');

      const body = rec.body as any[];
      expect(body.length).toBe(1);
      expect(body[0].type).toBe('LocalChoice');

      const choice = body[0];
      expect(choice.kind).toBe('select');
      expect(choice.branches.length).toBe(2);

      // First branch: More, Data, continue
      expect(choice.branches[0].body.length).toBe(3);
      expect(choice.branches[0].body[2].type).toBe('Continue');

      // Second branch: Done (no continue)
      expect(choice.branches[1].body.length).toBe(1);
      expect(choice.branches[1].body[0].type).toBe('Send');
    }
  });

  it('should project nested recursion', () => {
    const source = `
      protocol NestedRecursion(role A, role B) {
        rec Outer {
          A -> B: Start();
          rec Inner {
            A -> B: Ping();
            B -> A: Pong();
            choice at A {
              continue Inner;
            } or {
              A -> B: StopInner();
            }
          }
          choice at A {
            continue Outer;
          } or {
            A -> B: StopOuter();
          }
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');

    expect(localA.body.length).toBe(1);
    expect(localA.body[0].type).toBe('Recursion');

    const outer = localA.body[0];
    if (outer.type === 'Recursion') {
      expect(outer.label).toBe('Outer');

      const outerBody = outer.body as any[];
      expect(outerBody[0].type).toBe('Send'); // Start
      expect(outerBody[1].type).toBe('Recursion'); // Inner
      expect(outerBody[2].type).toBe('LocalChoice'); // Outer choice

      const inner = outerBody[1];
      expect(inner.label).toBe('Inner');
    }
  });

  it('should tau-eliminate recursion for non-involved role', () => {
    const source = `
      protocol ThreeRoleRecursion(role A, role B, role C) {
        rec Loop {
          A -> B: Message();
          continue Loop;
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localC = projectForRole(globalProtocol, 'C');

    // C is not involved in the recursion, so it should be tau-eliminated
    expect(localC.body.length).toBe(0);
  });

  it('should handle recursion with multiple continue points', () => {
    const source = `
      protocol MultipleContinue(role A, role B) {
        rec Loop {
          choice at A {
            A -> B: Option1();
            continue Loop;
          } or {
            A -> B: Option2();
            B -> A: Ack();
            continue Loop;
          } or {
            A -> B: Done();
          }
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');

    const rec = localA.body[0];
    if (rec.type === 'Recursion') {
      const choice = (rec.body as any[])[0];
      expect(choice.branches.length).toBe(3);

      // First branch: send, continue
      expect(choice.branches[0].body.length).toBe(2);
      expect(choice.branches[0].body[1].type).toBe('Continue');

      // Second branch: send, receive, continue
      expect(choice.branches[1].body.length).toBe(3);
      expect(choice.branches[1].body[2].type).toBe('Continue');

      // Third branch: send (no continue - exit)
      expect(choice.branches[2].body.length).toBe(1);
    }
  });

  it('should serialize recursion correctly', () => {
    const source = `
      protocol SimpleLoop(role A, role B) {
        rec Loop {
          A -> B: Ping();
          continue Loop;
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');
    const text = serializeLocalProtocol(localA);

    expect(text).toContain('rec Loop {');
    expect(text).toContain('Ping() to B;');
    expect(text).toContain('continue Loop;');
    expect(text).toContain('}');
  });

  it('should handle tail recursion optimization pattern', () => {
    const source = `
      protocol TailRecursion(role Client, role Server) {
        rec Loop {
          Client -> Server: Query();
          Server -> Client: Result();
          choice at Client {
            continue Loop;
          } or {
            Client -> Server: Stop();
          }
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localClient = projectForRole(globalProtocol, 'Client');

    const rec = localClient.body[0];
    if (rec.type === 'Recursion') {
      const body = rec.body as any[];
      expect(body.length).toBe(3); // send, receive, choice
      expect(body[0].type).toBe('Send');
      expect(body[1].type).toBe('Receive');
      expect(body[2].type).toBe('LocalChoice');

      const choice = body[2];
      expect(choice.branches[0].body[0].type).toBe('Continue');
      expect(choice.branches[1].body[0].type).toBe('Send');
    }
  });

  it('should project recursion preserving scope', () => {
    const source = `
      protocol RecursionScope(role A, role B) {
        A -> B: Init();
        rec Loop {
          A -> B: Work();
          continue Loop;
        }
        A -> B: Cleanup();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');

    expect(localA.body.length).toBe(3);
    expect(localA.body[0].type).toBe('Send'); // Init (before recursion)
    expect(localA.body[1].type).toBe('Recursion'); // Loop
    expect(localA.body[2].type).toBe('Send'); // Cleanup (after recursion)
  });
});
