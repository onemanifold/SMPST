/**
 * AST-based Local Protocol Projection - Choice Tests
 *
 * Tests projection of choice (internal and external) constructs.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { projectForRole } from '../ast-projector';
import { serializeLocalProtocol } from '../../serializer/local-serializer';

describe('AST Projection - Choice', () => {
  it('should project internal choice for selector role', () => {
    const source = `
      protocol InternalChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
        } or {
          Client -> Server: Register();
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
    expect(localClient.body[0].type).toBe('LocalChoice');

    const choice = localClient.body[0];
    if (choice.type === 'LocalChoice') {
      // Client makes the choice (internal/select)
      expect(choice.kind).toBe('select');
      expect(choice.branches.length).toBe(2);

      // Each branch should have a send
      expect(choice.branches[0].body[0].type).toBe('Send');
      expect(choice.branches[1].body[0].type).toBe('Send');
    }
  });

  it('should project external choice for participant role', () => {
    const source = `
      protocol ExternalChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Login();
        } or {
          Client -> Server: Register();
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localServer = projectForRole(globalProtocol, 'Server');

    expect(localServer.body.length).toBe(1);
    expect(localServer.body[0].type).toBe('LocalChoice');

    const choice = localServer.body[0];
    if (choice.type === 'LocalChoice') {
      // Server receives the choice (external/offer)
      expect(choice.kind).toBe('offer');
      expect(choice.at).toBe('Client');
      expect(choice.branches.length).toBe(2);

      // Each branch should have a receive
      expect(choice.branches[0].body[0].type).toBe('Receive');
      expect(choice.branches[1].body[0].type).toBe('Receive');
    }
  });

  it('should project nested choice correctly', () => {
    const source = `
      protocol NestedChoice(role A, role B) {
        choice at A {
          A -> B: Opt1();
          choice at B {
            B -> A: Opt1A();
          } or {
            B -> A: Opt1B();
          }
        } or {
          A -> B: Opt2();
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
    expect(localA.body[0].type).toBe('LocalChoice');

    const outerChoice = localA.body[0];
    if (outerChoice.type === 'LocalChoice') {
      expect(outerChoice.kind).toBe('select');
      expect(outerChoice.branches.length).toBe(2);

      // First branch should have send + nested choice
      const firstBranch = outerChoice.branches[0];
      expect(firstBranch.body.length).toBe(2);
      expect(firstBranch.body[0].type).toBe('Send');
      expect(firstBranch.body[1].type).toBe('LocalChoice');

      // Nested choice should be external (offer) for A
      const nestedChoice = firstBranch.body[1];
      if (nestedChoice.type === 'LocalChoice') {
        expect(nestedChoice.kind).toBe('offer');
      }
    }
  });

  it('should project three-way choice', () => {
    const source = `
      protocol ThreeWayChoice(role Client, role Server) {
        choice at Client {
          Client -> Server: Option1();
        } or {
          Client -> Server: Option2();
        } or {
          Client -> Server: Option3();
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localClient = projectForRole(globalProtocol, 'Client');

    const choice = localClient.body[0];
    if (choice.type === 'LocalChoice') {
      expect(choice.branches.length).toBe(3);
      expect(choice.kind).toBe('select');
    }
  });

  it('should tau-eliminate choice for non-involved role', () => {
    const source = `
      protocol ThreeRoleChoice(role A, role B, role C) {
        choice at A {
          A -> B: Yes();
        } or {
          A -> B: No();
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localC = projectForRole(globalProtocol, 'C');

    // C is not involved in any branch, so choice should be tau-eliminated
    expect(localC.body.length).toBe(0);
  });

  it('should handle choice with continuation after branches', () => {
    const source = `
      protocol ChoiceWithContinuation(role A, role B) {
        choice at A {
          A -> B: Yes();
        } or {
          A -> B: No();
        }
        B -> A: Ack();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');

    expect(localA.body.length).toBe(2);
    expect(localA.body[0].type).toBe('LocalChoice');
    expect(localA.body[1].type).toBe('Receive'); // Continuation after choice
  });

  it('should serialize choice correctly', () => {
    const source = `
      protocol SimpleChoice(role A, role B) {
        choice at A {
          A -> B: Login();
        } or {
          A -> B: Register();
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

    expect(text).toContain('choice at');
    expect(text).toContain('Login() to B;');
    expect(text).toContain('Register() to B;');
    expect(text).toContain('} or {');
  });

  it('should handle asymmetric choice branches', () => {
    const source = `
      protocol AsymmetricChoice(role A, role B, role C) {
        choice at A {
          A -> B: Path1();
          B -> A: Ack1();
        } or {
          A -> C: Path2();
          C -> A: Ack2();
        }
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');

    const choice = localA.body[0];
    if (choice.type === 'LocalChoice') {
      expect(choice.kind).toBe('select');
      expect(choice.branches.length).toBe(2);

      // First branch: send to B, receive from B
      expect(choice.branches[0].body.length).toBe(2);
      expect(choice.branches[0].body[0].type).toBe('Send');
      expect(choice.branches[0].body[1].type).toBe('Receive');

      // Second branch: send to C, receive from C
      expect(choice.branches[1].body.length).toBe(2);
      expect(choice.branches[1].body[0].type).toBe('Send');
      expect(choice.branches[1].body[1].type).toBe('Receive');
    }
  });
});
