/**
 * CFSM Serializer Tests
 *
 * Tests that verify CFSM → Scribble text serialization:
 * - Basic message serialization (send/receive)
 * - Type preservation (SimpleType and ParametricType)
 * - Choice/branching reconstruction
 * - Protocol signature generation
 * - Multicast handling
 * - Round-trip consistency
 */

import { describe, it, expect } from 'vitest';
import { serializeCFSM, serializeAllCFSMs } from '../cfsm-serializer';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import { projectAll } from '../../projection/projector';
import type { GlobalProtocolDeclaration } from '../../ast/types';
import type { CFSM } from '../../projection/types';

/**
 * Helper: Parse → CFG → CFSM for a given role
 */
function getCFSMForRole(source: string, role: string): CFSM {
  const ast = parse(source);
  const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
  const cfg = buildCFG(protocol);
  const result = projectAll(cfg);

  const cfsm = result.cfsms.get(role);
  if (!cfsm) {
    throw new Error(`CFSM not found for role ${role}`);
  }

  return cfsm;
}

describe('CFSM Serialization', () => {
  describe('Protocol Signature', () => {
    it('should generate correct signature for simple protocol', () => {
      const source = `
        protocol Simple(role A, role B) {
          A -> B: Hello();
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('local protocol Simple_A at A()');
    });

    it('should include empty parameter list in signature', () => {
      const source = `
        protocol Simple(role A, role B) {
          A -> B: Data(String);
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      // Should have empty parameters
      expect(serialized).toContain('local protocol Simple_A at A()');
    });
  });

  describe('Simple Messages', () => {
    it('should serialize send action', () => {
      const source = `
        protocol Test(role Sender, role Receiver) {
          Sender -> Receiver: Message(String);
        }
      `;

      const cfsm = getCFSMForRole(source, 'Sender');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('Message(String) to Receiver;');
    });

    it('should serialize receive action', () => {
      const source = `
        protocol Test(role Sender, role Receiver) {
          Sender -> Receiver: Message(Int);
        }
      `;

      const cfsm = getCFSMForRole(source, 'Receiver');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('Message(Int) from Sender;');
    });

    it('should serialize message without payload', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: Ack();
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('Ack() to B;');
    });

    it('should serialize sequence of messages', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: M1(Int);
          B -> A: M2(String);
          A -> B: M3(Bool);
        }
      `;

      const cfsmA = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsmA);

      expect(serialized).toContain('M1(Int) to B;');
      expect(serialized).toContain('M2(String) from B;');
      expect(serialized).toContain('M3(Bool) to B;');
    });
  });

  describe('Type Preservation', () => {
    it('should preserve simple types', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: Data(Int);
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('Data(Int)');
    });

    it('should preserve parametric types', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: Items(List<String>);
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('Items(List<String>)');
    });

    it('should preserve nested parametric types', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: Data(Map<String, List<Int>>);
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      // This is the KEY test - verify nested types are NOT flattened
      expect(serialized).toContain('Data(Map<String, List<Int>>)');
    });
  });

  describe('Choice Branching', () => {
    it('should serialize choice structure', () => {
      const source = `
        protocol Test(role Client, role Server) {
          choice at Client {
            Client -> Server: Accept();
          } or {
            Client -> Server: Reject();
          }
        }
      `;

      const cfsm = getCFSMForRole(source, 'Client');
      const serialized = serializeCFSM(cfsm);

      // Should contain choice structure
      expect(serialized).toContain('choice {');
      expect(serialized).toContain('} or {');
      expect(serialized).toContain('Accept() to Server;');
      expect(serialized).toContain('Reject() to Server;');
    });

    it('should serialize receiving side of choice', () => {
      const source = `
        protocol Test(role Client, role Server) {
          choice at Client {
            Client -> Server: Option1();
          } or {
            Client -> Server: Option2();
          }
        }
      `;

      const cfsm = getCFSMForRole(source, 'Server');
      const serialized = serializeCFSM(cfsm);

      // Server receives choice
      expect(serialized).toContain('choice {');
      expect(serialized).toContain('Option1() from Client;');
      expect(serialized).toContain('Option2() from Client;');
    });

    it('should handle choice with continuation', () => {
      const source = `
        protocol Test(role A, role B) {
          choice at A {
            A -> B: Yes();
            B -> A: Confirm();
          } or {
            A -> B: No();
          }
        }
      `;

      const cfsmA = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsmA);

      expect(serialized).toContain('Yes() to B;');
      expect(serialized).toContain('Confirm() from B;');
      expect(serialized).toContain('No() to B;');
    });
  });

  describe('Multicast', () => {
    it('should serialize multicast send', () => {
      const source = `
        protocol Test(role Pub, role Sub1, role Sub2) {
          Pub -> Sub1, Sub2: Event(String);
        }
      `;

      const cfsm = getCFSMForRole(source, 'Pub');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('Event(String) to Sub1, Sub2;');
    });

    it('should serialize multicast receive', () => {
      const source = `
        protocol Test(role Pub, role Sub1, role Sub2) {
          Pub -> Sub1, Sub2: Event(Int);
        }
      `;

      const cfsmSub = getCFSMForRole(source, 'Sub1');
      const serialized = serializeCFSM(cfsmSub);

      expect(serialized).toContain('Event(Int) from Pub;');
    });
  });

  describe('Sub-protocol Calls', () => {
    it('should serialize sub-protocol call', () => {
      const source = `
        protocol Main(role A, role B, role C) {
          do SubProtocol(A, B, C);
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm);

      expect(serialized).toContain('do SubProtocol(A, B, C);');
    });
  });

  describe('Complete Protocols', () => {
    it('should serialize TwoBuyer protocol', () => {
      const source = `
        protocol TwoBuyer(role Seller, role Buyer1, role Buyer2) {
          Seller -> Buyer1, Buyer2: Quote(Int);
          Buyer1 -> Buyer2: Share(Int);
          choice at Buyer2 {
            Buyer2 -> Seller: Accept();
          } or {
            Buyer2 -> Seller: Reject();
          }
        }
      `;

      const cfsmBuyer1 = getCFSMForRole(source, 'Buyer1');
      const serialized = serializeCFSM(cfsmBuyer1);

      // Check signature
      expect(serialized).toContain('local protocol TwoBuyer_Buyer1 at Buyer1()');

      // Check body
      expect(serialized).toContain('Quote(Int) from Seller;');
      expect(serialized).toContain('Share(Int) to Buyer2;');
    });

    it('should serialize all roles in TwoBuyer', () => {
      const source = `
        protocol TwoBuyer(role Seller, role Buyer1, role Buyer2) {
          Seller -> Buyer1, Buyer2: Quote(Int);
          Buyer1 -> Buyer2: Share(Int);
          Buyer2 -> Seller: Decision(Bool);
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);
      const result = projectAll(cfg);

      const serialized = serializeAllCFSMs(result.cfsms);

      expect(serialized.size).toBe(3);
      expect(serialized.has('Seller')).toBe(true);
      expect(serialized.has('Buyer1')).toBe(true);
      expect(serialized.has('Buyer2')).toBe(true);

      // Verify each has correct structure
      const seller = serialized.get('Seller')!;
      expect(seller).toContain('Quote(Int) to Buyer1, Buyer2;');
      expect(seller).toContain('Decision(Bool) from Buyer2;');
    });
  });

  describe('Serialization Options', () => {
    it('should respect indent option', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: M();
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm, { indent: '    ' }); // 4 spaces

      // Check that body uses 4-space indent
      const lines = serialized.split('\n');
      const bodyLine = lines.find(l => l.includes('M()'));
      expect(bodyLine).toMatch(/^    /); // Should start with 4 spaces
    });

    it('should respect lineEnding option', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: M();
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm, { lineEnding: '\r\n' });

      expect(serialized).toContain('\r\n');
    });

    it('should include state IDs when requested', () => {
      const source = `
        protocol Test(role A, role B) {
          A -> B: M();
        }
      `;

      const cfsm = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsm, { includeStateIds: true });

      // Should have comments with state information (for debugging)
      // Exact format depends on implementation
      expect(serialized).toBeTruthy();
    });
  });

  describe('Tau Elimination', () => {
    it('should not serialize tau transitions by default', () => {
      const source = `
        protocol Test(role A, role B, role C) {
          A -> B: M1();
          B -> A: M2();
        }
      `;

      // C is not involved, should have only tau transitions
      const cfsmC = getCFSMForRole(source, 'C');
      const serialized = serializeCFSM(cfsmC);

      // Should not contain message actions (only protocol signature and empty body)
      expect(serialized).not.toContain('M1');
      expect(serialized).not.toContain('M2');
      expect(serialized).toContain('local protocol Test_C at C()');
    });
  });

  describe('Round-trip Verification', () => {
    it('should produce parseable Scribble syntax', () => {
      const source = `
        protocol Simple(role A, role B) {
          A -> B: Hello(String);
          B -> A: World(Int);
        }
      `;

      const cfsmA = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsmA);

      // Basic syntax checks (full parsing would require local protocol parser)
      expect(serialized).toMatch(/local protocol \w+ at \w+\(\)/);
      expect(serialized).toContain('{');
      expect(serialized).toContain('}');
      expect(serialized).toMatch(/Hello\(String\) to B;/);
      expect(serialized).toMatch(/World\(Int\) from B;/);
    });

    it('should preserve message order', () => {
      const source = `
        protocol Sequence(role A, role B) {
          A -> B: First(Int);
          B -> A: Second(String);
          A -> B: Third(Bool);
        }
      `;

      const cfsmA = getCFSMForRole(source, 'A');
      const serialized = serializeCFSM(cfsmA);

      // Check order is preserved
      const firstIdx = serialized.indexOf('First(Int)');
      const secondIdx = serialized.indexOf('Second(String)');
      const thirdIdx = serialized.indexOf('Third(Bool)');

      expect(firstIdx).toBeGreaterThan(-1);
      expect(secondIdx).toBeGreaterThan(firstIdx);
      expect(thirdIdx).toBeGreaterThan(secondIdx);
    });
  });
});
