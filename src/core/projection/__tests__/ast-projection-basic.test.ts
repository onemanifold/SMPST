/**
 * AST-based Local Protocol Projection - Basic Message Passing Tests
 *
 * Tests fundamental projection rules for simple message passing protocols.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { projectToLocalProtocols, projectForRole } from '../ast-projector';
import { serializeLocalProtocol } from '../../serializer/local-serializer';

describe('AST Projection - Basic Message Passing', () => {
  it('should project simple send for sender role', () => {
    const source = `
      protocol SimpleSend(role A, role B) {
        A -> B: Message();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');

    expect(localA.name).toBe('SimpleSend_A');
    expect(localA.role).toBe('A');
    expect(localA.body.length).toBe(1);
    expect(localA.body[0].type).toBe('Send');

    const send = localA.body[0];
    if (send.type === 'Send') {
      expect(send.to).toBe('B');
      expect(send.message.label).toBe('Message');
    }
  });

  it('should project simple receive for receiver role', () => {
    const source = `
      protocol SimpleReceive(role A, role B) {
        A -> B: Message();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localB = projectForRole(globalProtocol, 'B');

    expect(localB.name).toBe('SimpleReceive_B');
    expect(localB.role).toBe('B');
    expect(localB.body.length).toBe(1);
    expect(localB.body[0].type).toBe('Receive');

    const receive = localB.body[0];
    if (receive.type === 'Receive') {
      expect(receive.from).toBe('A');
      expect(receive.message.label).toBe('Message');
    }
  });

  it('should tau-eliminate for non-involved role', () => {
    const source = `
      protocol TwoParty(role A, role B, role C) {
        A -> B: Message();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localC = projectForRole(globalProtocol, 'C');

    // C is not involved, so body should be empty (tau-eliminated)
    expect(localC.body.length).toBe(0);
  });

  it('should project request-response pattern correctly', () => {
    const source = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    // Project for Client
    const localClient = projectForRole(globalProtocol, 'Client');
    expect(localClient.body.length).toBe(2);
    expect(localClient.body[0].type).toBe('Send');
    expect(localClient.body[1].type).toBe('Receive');

    // Project for Server
    const localServer = projectForRole(globalProtocol, 'Server');
    expect(localServer.body.length).toBe(2);
    expect(localServer.body[0].type).toBe('Receive');
    expect(localServer.body[1].type).toBe('Send');
  });

  it('should project three-role chain with tau-elimination', () => {
    const source = `
      protocol ThreeRoleChain(role A, role B, role C) {
        A -> B: M1();
        B -> C: M2();
        C -> A: M3();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    // A: sends M1, receives M3 (M2 is tau-eliminated)
    const localA = projectForRole(globalProtocol, 'A');
    expect(localA.body.length).toBe(2);
    expect(localA.body[0].type).toBe('Send');
    expect(localA.body[1].type).toBe('Receive');

    // B: receives M1, sends M2 (M3 is tau-eliminated)
    const localB = projectForRole(globalProtocol, 'B');
    expect(localB.body.length).toBe(2);
    expect(localB.body[0].type).toBe('Receive');
    expect(localB.body[1].type).toBe('Send');

    // C: receives M2, sends M3 (M1 is tau-eliminated)
    const localC = projectForRole(globalProtocol, 'C');
    expect(localC.body.length).toBe(2);
    expect(localC.body[0].type).toBe('Receive');
    expect(localC.body[1].type).toBe('Send');
  });

  it('should project all roles at once', () => {
    const source = `
      protocol TwoParty(role Client, role Server) {
        Client -> Server: Request();
        Server -> Client: Response();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const result = projectToLocalProtocols(globalProtocol);

    expect(result.errors.length).toBe(0);
    expect(result.localProtocols.size).toBe(2);
    expect(result.localProtocols.has('Client')).toBe(true);
    expect(result.localProtocols.has('Server')).toBe(true);
  });

  it('should handle payload types in messages', () => {
    const source = `
      protocol WithPayload(role A, role B) {
        A -> B: Data(Int);
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');
    const send = localA.body[0];

    if (send.type === 'Send') {
      expect(send.message.payload).toBeDefined();
      expect(send.message.payload?.payloadType.type).toBe('SimpleType');
    }
  });

  it('should serialize projected local protocol to text', () => {
    const source = `
      protocol Simple(role A, role B) {
        A -> B: Hello();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    const localA = projectForRole(globalProtocol, 'A');
    const text = serializeLocalProtocol(localA);

    expect(text).toContain('local protocol Simple_A at A');
    expect(text).toContain('Hello() to B;');
  });

  it('should handle invalid role projection with error', () => {
    const source = `
      protocol Test(role A, role B) {
        A -> B: Message();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0];

    if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
      throw new Error('Expected global protocol');
    }

    expect(() => {
      projectForRole(globalProtocol, 'NonExistent');
    }).toThrow('Role "NonExistent" not found');
  });
});
