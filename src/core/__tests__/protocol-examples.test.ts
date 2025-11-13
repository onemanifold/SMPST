/**
 * Protocol Examples Test
 *
 * Demonstrates real-world protocol examples with simulation.
 * These tests show how to use SMPST for practical protocols.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { projectAll } from '../projection/projector';
import { DistributedSimulator } from '../simulation/distributed-simulator';
import type { GlobalProtocolDeclaration } from '../parser/ast';

describe('Protocol Examples with Simulation', () => {
  describe('E-Commerce: Buyer-Seller-Shipper', () => {
    const protocol = `
      protocol ECommerce(role Buyer, role Seller, role Shipper) {
        Buyer -> Seller: Order(String);
        Seller -> Shipper: ShipRequest(String);
        Shipper -> Buyer: DeliveryConfirmation(Int);
      }
    `;

    it('should execute three-party e-commerce workflow', () => {
      // Parse protocol
      const ast = parse(protocol);
      const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;

      expect(globalProtocol.name).toBe('ECommerce');
      const roleNames = globalProtocol.roles.map(r => r.name);
      expect(roleNames).toEqual(['Buyer', 'Seller', 'Shipper']);

      // Build CFG and project
      const cfg = buildCFG(globalProtocol);
      const projection = projectAll(cfg);

      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(3);

      // Simulate
      const sim = new DistributedSimulator(projection.cfsms, {
        schedulingStrategy: 'round-robin',
        recordTrace: true,
      });

      const result = sim.run();

      // Verify success
      expect(result.success).toBe(true);
      expect(result.state.allCompleted).toBe(true);
      expect(result.state.deadlocked).toBe(false);

      // Verify message flow
      const buyerTrace = result.traces!.get('Buyer')!;
      const sellerTrace = result.traces!.get('Seller')!;
      const shipperTrace = result.traces!.get('Shipper')!;

      // Buyer: sends Order, receives DeliveryConfirmation
      const buyerSend = buyerTrace.events.find(e => e.type === 'send');
      const buyerReceive = buyerTrace.events.find(e => e.type === 'receive');
      expect(buyerSend).toBeDefined();
      expect(buyerReceive).toBeDefined();
      if (buyerSend && buyerSend.type === 'send') {
        expect(buyerSend.label).toBe('Order');
        expect(buyerSend.to).toBe('Seller');
      }
      if (buyerReceive && buyerReceive.type === 'receive') {
        expect(buyerReceive.label).toBe('DeliveryConfirmation');
        expect(buyerReceive.from).toBe('Shipper');
      }

      // Seller: receives Order, sends ShipRequest
      const sellerReceive = sellerTrace.events.find(e => e.type === 'receive');
      const sellerSend = sellerTrace.events.find(e => e.type === 'send');
      expect(sellerReceive).toBeDefined();
      expect(sellerSend).toBeDefined();
      if (sellerReceive && sellerReceive.type === 'receive') {
        expect(sellerReceive.label).toBe('Order');
        expect(sellerReceive.from).toBe('Buyer');
      }
      if (sellerSend && sellerSend.type === 'send') {
        expect(sellerSend.label).toBe('ShipRequest');
        expect(sellerSend.to).toBe('Shipper');
      }

      // Shipper: receives ShipRequest, sends DeliveryConfirmation
      const shipperReceive = shipperTrace.events.find(e => e.type === 'receive');
      const shipperSend = shipperTrace.events.find(e => e.type === 'send');
      expect(shipperReceive).toBeDefined();
      expect(shipperSend).toBeDefined();
      if (shipperReceive && shipperReceive.type === 'receive') {
        expect(shipperReceive.label).toBe('ShipRequest');
        expect(shipperReceive.from).toBe('Seller');
      }
      if (shipperSend && shipperSend.type === 'send') {
        expect(shipperSend.label).toBe('DeliveryConfirmation');
        expect(shipperSend.to).toBe('Buyer');
      }

      console.log('\n📦 E-Commerce Protocol Executed Successfully!');
      console.log(`   Buyer → Seller: Order`);
      console.log(`   Seller → Shipper: ShipRequest`);
      console.log(`   Shipper → Buyer: DeliveryConfirmation`);
      console.log(`   Total steps: ${result.globalSteps}`);
    });
  });

  describe('Banking: Transaction with Choice', () => {
    const protocol = `
      protocol BankingTransaction(role Client, role Bank) {
        Client -> Bank: TransferRequest(Int);
        choice at Bank {
          Bank -> Client: TransferSuccess(String);
        } or {
          Bank -> Client: TransferFailure(String);
        }
      }
    `;

    it('should handle banking transaction with success/failure branches', () => {
      // Parse and project
      const ast = parse(protocol);
      const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(globalProtocol);
      const projection = projectAll(cfg);

      expect(projection.cfsms.size).toBe(2);

      // Simulate multiple times
      const outcomes = { success: 0, failure: 0 };

      for (let i = 0; i < 10; i++) {
        const sim = new DistributedSimulator(projection.cfsms, {
          schedulingStrategy: 'round-robin',
          recordTrace: true,
        });

        const result = sim.run();
        expect(result.success).toBe(true);

        // Check which branch was taken
        const bankTrace = result.traces!.get('Bank')!;
        const sendEvent = bankTrace.events.find(e => e.type === 'send');

        if (sendEvent && sendEvent.type === 'send') {
          if (sendEvent.label === 'TransferSuccess') {
            outcomes.success++;
          } else if (sendEvent.label === 'TransferFailure') {
            outcomes.failure++;
          }
        }
      }

      // At least one execution should complete
      expect(outcomes.success + outcomes.failure).toBe(10);

      console.log('\n💰 Banking Transaction Protocol Simulated!');
      console.log(`   Success outcomes: ${outcomes.success}`);
      console.log(`   Failure outcomes: ${outcomes.failure}`);
    });
  });

  describe('Authentication with Conditional Access', () => {
    const protocol = `
      protocol Authentication(role User, role Server) {
        User -> Server: LoginRequest(String);
        choice at Server {
          Server -> User: AuthToken(String);
          User -> Server: DataRequest(String);
          Server -> User: DataResponse(String);
        } or {
          Server -> User: AuthError(String);
        }
      }
    `;

    it('should handle authentication with conditional data access', () => {
      // Parse and project
      const ast = parse(protocol);
      const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
      const cfg = buildCFG(globalProtocol);
      const projection = projectAll(cfg);

      expect(projection.cfsms.size).toBe(2);

      // Simulate
      const sim = new DistributedSimulator(projection.cfsms, {
        schedulingStrategy: 'round-robin',
        recordTrace: true,
      });

      const result = sim.run();

      expect(result.success).toBe(true);
      expect(result.state.allCompleted).toBe(true);

      // Check authentication result
      const serverTrace = result.traces!.get('Server')!;
      const authResponse = serverTrace.events.find(
        e => e.type === 'send' && (e.label === 'AuthToken' || e.label === 'AuthError')
      );

      expect(authResponse).toBeDefined();

      if (authResponse && authResponse.type === 'send') {
        if (authResponse.label === 'AuthToken') {
          // Success path: should have 4 messages total (Login, Token, DataReq, DataResp)
          const userSends = result.traces!.get('User')!.events.filter(e => e.type === 'send');
          expect(userSends.length).toBeGreaterThanOrEqual(2); // LoginRequest + DataRequest

          console.log('\n🔐 Authentication Successful!');
          console.log('   User → Server: LoginRequest');
          console.log('   Server → User: AuthToken');
          console.log('   User → Server: DataRequest');
          console.log('   Server → User: DataResponse');
        } else {
          // Failure path: should have 2 messages (Login, Error)
          console.log('\n🔐 Authentication Failed!');
          console.log('   User → Server: LoginRequest');
          console.log('   Server → User: AuthError');
        }

        console.log(`   Total steps: ${result.globalSteps}`);
      }
    });
  });

  describe('Request-Response Pattern', () => {
    const protocol = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request(String);
        Server -> Client: Response(Int);
      }
    `;

    it('should execute simple request-response', () => {
      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const projection = projectAll(cfg);
      const sim = new DistributedSimulator(projection.cfsms, { recordTrace: true });
      const result = sim.run();

      expect(result.success).toBe(true);

      const clientTrace = result.traces!.get('Client')!;
      const serverTrace = result.traces!.get('Server')!;

      // Client: send request, receive response
      const clientSend = clientTrace.events.find(e => e.type === 'send');
      const clientRecv = clientTrace.events.find(e => e.type === 'receive');
      expect(clientSend).toBeDefined();
      expect(clientRecv).toBeDefined();

      // Server: receive request, send response
      const serverRecv = serverTrace.events.find(e => e.type === 'receive');
      const serverSend = serverTrace.events.find(e => e.type === 'send');
      expect(serverRecv).toBeDefined();
      expect(serverSend).toBeDefined();

      console.log('\n📨 Request-Response Complete!');
      console.log(`   Client ↔ Server: ${result.globalSteps} steps`);
    });
  });
});
