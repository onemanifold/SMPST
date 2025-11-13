/**
 * Multicast Projection Tests
 *
 * Tests that verify correct projection of multicast messages:
 * - Parser accepts multicast syntax (A -> B, C, D : Msg())
 * - AST projection creates Send with array of receivers for sender
 * - AST projection creates Receive for each receiver
 * - Tau-elimination for non-involved roles
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../parser/parser';
import { projectToLocalProtocols } from '../ast-projector';
import type { GlobalProtocolDeclaration, Send, Receive } from '../../ast/types';

describe('AST Projection - Multicast', () => {
  it('should parse and project simple multicast message', () => {
    const source = `
      protocol Broadcast(role Publisher, role Sub1, role Sub2, role Sub3) {
        Publisher -> Sub1, Sub2, Sub3 : Event();
      }
    `;

    const ast = parse(source);
    expect(ast.declarations).toHaveLength(1);

    const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
    expect(globalProtocol.type).toBe('GlobalProtocolDeclaration');
    expect(globalProtocol.roles).toHaveLength(4);

    // Project to local protocols
    const result = projectToLocalProtocols(globalProtocol);
    expect(result.errors).toHaveLength(0);
    expect(result.localProtocols.size).toBe(4);

    // Publisher should have Send with array of receivers
    const publisherLocal = result.localProtocols.get('Publisher')!;
    expect(publisherLocal).toBeDefined();
    expect(publisherLocal.body).toHaveLength(1);

    const publisherSend = publisherLocal.body[0] as Send;
    expect(publisherSend.type).toBe('Send');
    expect(publisherSend.message.label).toBe('Event');
    expect(Array.isArray(publisherSend.to)).toBe(true);
    expect(publisherSend.to).toEqual(['Sub1', 'Sub2', 'Sub3']);

    // Each subscriber should have Receive from Publisher
    for (const subName of ['Sub1', 'Sub2', 'Sub3']) {
      const subLocal = result.localProtocols.get(subName)!;
      expect(subLocal).toBeDefined();
      expect(subLocal.body).toHaveLength(1);

      const subReceive = subLocal.body[0] as Receive;
      expect(subReceive.type).toBe('Receive');
      expect(subReceive.message.label).toBe('Event');
      expect(subReceive.from).toBe('Publisher');
    }
  });

  it('should project multicast in two-buyer protocol', () => {
    const source = `
      protocol TwoBuyer(role Seller, role Buyer1, role Buyer2) {
        Seller -> Buyer1, Buyer2 : Quote(Int);
        Buyer1 -> Buyer2 : Share(Int);
        Buyer2 -> Seller : Decision(Bool);
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const result = projectToLocalProtocols(globalProtocol);

    expect(result.errors).toHaveLength(0);

    // Seller sends multicast
    const sellerLocal = result.localProtocols.get('Seller')!;
    expect(sellerLocal.body).toHaveLength(2);  // Send + Receive

    const sellerSend = sellerLocal.body[0] as Send;
    expect(sellerSend.type).toBe('Send');
    expect(sellerSend.message.label).toBe('Quote');
    expect(sellerSend.to).toEqual(['Buyer1', 'Buyer2']);

    // Buyer1 receives from Seller, then sends to Buyer2
    const buyer1Local = result.localProtocols.get('Buyer1')!;
    expect(buyer1Local.body).toHaveLength(2);

    const buyer1Receive = buyer1Local.body[0] as Receive;
    expect(buyer1Receive.type).toBe('Receive');
    expect(buyer1Receive.from).toBe('Seller');
    expect(buyer1Receive.message.label).toBe('Quote');

    // Buyer2 receives from both Seller and Buyer1, then sends to Seller
    const buyer2Local = result.localProtocols.get('Buyer2')!;
    expect(buyer2Local.body).toHaveLength(3);

    const buyer2FirstReceive = buyer2Local.body[0] as Receive;
    expect(buyer2FirstReceive.type).toBe('Receive');
    expect(buyer2FirstReceive.from).toBe('Seller');
    expect(buyer2FirstReceive.message.label).toBe('Quote');
  });

  it('should handle mixed unicast and multicast messages', () => {
    const source = `
      protocol Mixed(role A, role B, role C, role D) {
        A -> B : Unicast();
        B -> C, D : Multicast();
        C -> A : Reply();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const result = projectToLocalProtocols(globalProtocol);

    expect(result.errors).toHaveLength(0);

    // A: Send unicast, then Receive reply
    const aLocal = result.localProtocols.get('A')!;
    expect(aLocal.body).toHaveLength(2);

    const aSend = aLocal.body[0] as Send;
    expect(aSend.type).toBe('Send');
    expect(aSend.to).toBe('B');  // Unicast: single string

    // B: Receive unicast, then Send multicast
    const bLocal = result.localProtocols.get('B')!;
    expect(bLocal.body).toHaveLength(2);

    const bSend = bLocal.body[1] as Send;
    expect(bSend.type).toBe('Send');
    expect(Array.isArray(bSend.to)).toBe(true);
    expect(bSend.to).toEqual(['C', 'D']);  // Multicast: array

    // C: Tau-eliminated (not involved in first message), Receive multicast, Send reply
    const cLocal = result.localProtocols.get('C')!;
    expect(cLocal.body).toHaveLength(2);  // Tau-eliminated A->B

    const cReceive = cLocal.body[0] as Receive;
    expect(cReceive.type).toBe('Receive');
    expect(cReceive.from).toBe('B');

    // D: Tau-eliminated (first and third messages), Receive multicast
    const dLocal = result.localProtocols.get('D')!;
    expect(dLocal.body).toHaveLength(1);  // Only Receive from B

    const dReceive = dLocal.body[0] as Receive;
    expect(dReceive.type).toBe('Receive');
    expect(dReceive.from).toBe('B');
  });

  it('should reject multicast including sender (self-communication)', () => {
    // This should be caught by well-formedness checks
    // For now, we test that projection doesn't crash
    const source = `
      protocol SelfMulticast(role A, role B) {
        A -> A, B : Bad();
      }
    `;

    const ast = parse(source);
    const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
    const result = projectToLocalProtocols(globalProtocol);

    // Projection should succeed (well-formedness is separate)
    // A would have both Send and Receive
    const aLocal = result.localProtocols.get('A')!;
    expect(aLocal.body.length).toBeGreaterThan(0);

    // Should have Send (to [A, B]) and Receive (from A)
    const sends = aLocal.body.filter(i => i.type === 'Send');
    const receives = aLocal.body.filter(i => i.type === 'Receive');

    expect(sends).toHaveLength(1);
    expect(receives).toHaveLength(1);
  });
});
