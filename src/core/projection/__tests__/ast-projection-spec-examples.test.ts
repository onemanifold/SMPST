/**
 * AST-based Local Protocol Projection - Specification Examples
 *
 * Tests projection against examples from the Scribble specification:
 * - JBoss Scribble Protocol Guide
 * - "The Scribble Protocol Language" by Yoshida et al.
 * - Honda, Yoshida, Carbone MPST papers
 *
 * These tests validate formal correctness against authoritative sources.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { projectForRole, projectToLocalProtocols } from '../ast-projector';
import { serializeLocalProtocol } from '../../serializer/local-serializer';

describe('AST Projection - Scribble Specification Examples', () => {
  describe('JBoss Protocol Guide Examples', () => {
    it('should project BuyerSeller example correctly', () => {
      // Example 3.1 from JBoss Scribble Protocol Guide
      const source = `
        protocol BuyerSeller(role Buyer, role Seller) {
          Buyer -> Seller: Order();
          choice at Seller {
            Seller -> Buyer: Invoice();
          } or {
            Seller -> Buyer: Rejected();
          }
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      // Project for Buyer
      const localBuyer = projectForRole(globalProtocol, 'Buyer');
      expect(localBuyer.body.length).toBe(2);
      expect(localBuyer.body[0].type).toBe('Send'); // Order

      const choice = localBuyer.body[1];
      expect(choice.type).toBe('LocalChoice');
      if (choice.type === 'LocalChoice') {
        expect(choice.kind).toBe('offer'); // External choice for Buyer
        expect(choice.branches.length).toBe(2);
      }

      // Project for Seller
      const localSeller = projectForRole(globalProtocol, 'Seller');
      expect(localSeller.body.length).toBe(2);
      expect(localSeller.body[0].type).toBe('Receive'); // Order

      const sellerChoice = localSeller.body[1];
      if (sellerChoice.type === 'LocalChoice') {
        expect(sellerChoice.kind).toBe('select'); // Internal choice for Seller
      }
    });

    it('should project CreditCheck example correctly', () => {
      // Example 3.2 from JBoss Scribble Protocol Guide
      const source = `
        protocol CreditCheck(role Client, role CreditAgency) {
          Client -> CreditAgency: CheckCredit();
          choice at CreditAgency {
            CreditAgency -> Client: CreditOk();
          } or {
            CreditAgency -> Client: NoCredit();
          }
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      const localClient = projectForRole(globalProtocol, 'Client');

      // Client: send CheckCredit, then offer (external choice)
      expect(localClient.body.length).toBe(2);
      expect(localClient.body[0].type).toBe('Send');
      expect(localClient.body[1].type).toBe('LocalChoice');

      const choice = localClient.body[1];
      if (choice.type === 'LocalChoice') {
        expect(choice.kind).toBe('offer');
        expect(choice.at).toBe('CreditAgency');
      }
    });
  });

  describe('Academic Paper Examples', () => {
    it('should project Travel Agency example (Figure 2)', () => {
      // From "The Scribble Protocol Language" paper, Figure 2
      const source = `
        protocol BookJourney(role Customer, role Agency, role Service) {
          rec Loop {
            choice at Customer {
              Customer -> Agency: query();
              Agency -> Customer: price();
              Agency -> Service: info();
              continue Loop;
            } or {
              choice at Customer {
                Customer -> Agency: ACCEPT();
                Agency -> Service: ACCEPT();
                Customer -> Service: Address();
                Service -> Customer: Date();
              } or {
                Customer -> Agency: REJECT();
                Agency -> Service: REJECT();
              }
            }
          }
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      // Project for Customer (Figure 3a in the paper)
      const localCustomer = projectForRole(globalProtocol, 'Customer');

      expect(localCustomer.body.length).toBe(1);
      expect(localCustomer.body[0].type).toBe('Recursion');

      const rec = localCustomer.body[0];
      if (rec.type === 'Recursion') {
        expect(rec.label).toBe('Loop');

        const outerChoice = (rec.body as any[])[0];
        expect(outerChoice.type).toBe('LocalChoice');
        expect(outerChoice.kind).toBe('select'); // Customer selects

        // Verify structure matches Figure 3a
        const branches = outerChoice.branches;
        expect(branches.length).toBe(2);

        // First branch: query loop
        const queryBranch = branches[0].body;
        expect(queryBranch[0].type).toBe('Send'); // query to Agency
        expect(queryBranch[1].type).toBe('Receive'); // price from Agency
        // Note: info is tau-eliminated (not involving Customer)
        expect(queryBranch[2].type).toBe('Continue');

        // Second branch: accept/reject choice
        const innerBranch = branches[1].body;
        expect(innerBranch[0].type).toBe('LocalChoice');
      }

      // Project for Agency
      const localAgency = projectForRole(globalProtocol, 'Agency');
      expect(localAgency.body[0].type).toBe('Recursion');

      // Project for Service
      const localService = projectForRole(globalProtocol, 'Service');
      expect(localService.body[0].type).toBe('Recursion');
    });

    it('should handle three-role protocol with tau-elimination', () => {
      // Example demonstrating tau-elimination rule from Honda et al.
      const source = `
        protocol ThreeRole(role A, role B, role C) {
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

      // A: !M1, ?M3 (M2 is tau-eliminated)
      const localA = projectForRole(globalProtocol, 'A');
      expect(localA.body.length).toBe(2);
      if (localA.body[0].type === 'Send') {
        expect(localA.body[0].message.label).toBe('M1');
      }
      if (localA.body[1].type === 'Receive') {
        expect(localA.body[1].message.label).toBe('M3');
      }

      // B: ?M1, !M2 (M3 is tau-eliminated)
      const localB = projectForRole(globalProtocol, 'B');
      expect(localB.body.length).toBe(2);
      expect(localB.body[0].type).toBe('Receive');
      expect(localB.body[1].type).toBe('Send');

      // C: ?M2, !M3 (M1 is tau-eliminated)
      const localC = projectForRole(globalProtocol, 'C');
      expect(localC.body.length).toBe(2);
      expect(localC.body[0].type).toBe('Receive');
      expect(localC.body[1].type).toBe('Send');
    });
  });

  describe('Formal Projection Rule Validation', () => {
    it('should satisfy projection completeness property', () => {
      // Completeness: Every message appears exactly once as send in sender's
      // projection and exactly once as receive in receiver's projection
      const source = `
        protocol Completeness(role A, role B, role C) {
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

      const result = projectToLocalProtocols(globalProtocol);

      // Count occurrences of each message
      const m1Sends = countMessageType(result.localProtocols.get('A')!, 'Send', 'M1');
      const m1Recvs = countMessageType(result.localProtocols.get('B')!, 'Receive', 'M1');

      expect(m1Sends).toBe(1); // Exactly one send
      expect(m1Recvs).toBe(1); // Exactly one receive

      const m2Sends = countMessageType(result.localProtocols.get('B')!, 'Send', 'M2');
      const m2Recvs = countMessageType(result.localProtocols.get('C')!, 'Receive', 'M2');

      expect(m2Sends).toBe(1);
      expect(m2Recvs).toBe(1);

      const m3Sends = countMessageType(result.localProtocols.get('C')!, 'Send', 'M3');
      const m3Recvs = countMessageType(result.localProtocols.get('A')!, 'Receive', 'M3');

      expect(m3Sends).toBe(1);
      expect(m3Recvs).toBe(1);
    });

    it('should satisfy role correctness property', () => {
      // Role correctness: Only actions where role is involved appear in projection
      const source = `
        protocol RoleCorrectness(role A, role B, role C) {
          A -> B: M1();
          B -> C: M2();
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      const localA = projectForRole(globalProtocol, 'A');

      // A should only have actions involving A
      for (const interaction of localA.body) {
        if (interaction.type === 'Send') {
          // Sender is implicitly A (correct)
          expect(interaction.to).not.toBe('A'); // Can't send to self
        }
        if (interaction.type === 'Receive') {
          expect(interaction.from).not.toBe('A'); // Can't receive from self
        }
      }

      // M2 should not appear in A's projection (tau-eliminated)
      const m2Count = countMessageType(localA, 'Send', 'M2') +
                      countMessageType(localA, 'Receive', 'M2');
      expect(m2Count).toBe(0);
    });

    it('should satisfy composability (duality) property', () => {
      // Duality: For every send in sender's projection, there's a matching
      // receive in receiver's projection with same label and type
      const source = `
        protocol Duality(role A, role B) {
          A -> B: Request(Int);
          B -> A: Response(String);
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      const localA = projectForRole(globalProtocol, 'A');
      const localB = projectForRole(globalProtocol, 'B');

      // A sends Request -> B receives Request
      const aSends = localA.body[0];
      const bRecvs = localB.body[0];

      if (aSends.type === 'Send' && bRecvs.type === 'Receive') {
        expect(aSends.message.label).toBe(bRecvs.message.label);
        expect(aSends.to).toBe('B');
        expect(bRecvs.from).toBe('A');
      }

      // B sends Response -> A receives Response
      const bSends = localB.body[1];
      const aRecvs = localA.body[1];

      if (bSends.type === 'Send' && aRecvs.type === 'Receive') {
        expect(bSends.message.label).toBe(aRecvs.message.label);
        expect(bSends.to).toBe('A');
        expect(aRecvs.from).toBe('B');
      }
    });

    it('should preserve recursion structure', () => {
      // Recursion: (rec X.G) ↓ r = rec X.(G↓r)
      const source = `
        protocol RecursionPreservation(role A, role B) {
          rec X {
            A -> B: Ping();
            B -> A: Pong();
            continue X;
          }
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      const localA = projectForRole(globalProtocol, 'A');
      const localB = projectForRole(globalProtocol, 'B');

      // Both should have recursion with label X
      expect(localA.body[0].type).toBe('Recursion');
      expect(localB.body[0].type).toBe('Recursion');

      if (localA.body[0].type === 'Recursion') {
        expect(localA.body[0].label).toBe('X');
      }

      if (localB.body[0].type === 'Recursion') {
        expect(localB.body[0].label).toBe('X');
      }
    });
  });

  describe('Serialization Round-Trip', () => {
    it('should round-trip through serialization', () => {
      const source = `
        protocol RoundTrip(role A, role B) {
          A -> B: Hello();
          B -> A: World();
        }
      `;

      const ast = parse(source);
      const globalProtocol = ast.declarations[0];

      if (globalProtocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol');
      }

      const localA = projectForRole(globalProtocol, 'A');
      const serialized = serializeLocalProtocol(localA);

      // Verify essential structure is preserved
      expect(serialized).toContain('local protocol');
      expect(serialized).toContain('RoundTrip_A');
      expect(serialized).toContain('at A');
      expect(serialized).toContain('Hello() to B');
      expect(serialized).toContain('World() from B');
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function countMessageType(
  protocol: any,
  actionType: 'Send' | 'Receive',
  label: string
): number {
  let count = 0;

  function traverse(interactions: any[]): void {
    for (const interaction of interactions) {
      if (interaction.type === actionType) {
        if (interaction.message.label === label) {
          count++;
        }
      } else if (interaction.type === 'LocalChoice') {
        for (const branch of interaction.branches) {
          traverse(branch.body);
        }
      } else if (interaction.type === 'Recursion') {
        traverse(interaction.body);
      } else if (interaction.type === 'LocalParallel') {
        for (const branch of interaction.branches) {
          traverse(branch.body);
        }
      }
    }
  }

  traverse(protocol.body);
  return count;
}
