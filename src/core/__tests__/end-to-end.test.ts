/**
 * End-to-End Integration Tests
 *
 * Tests the complete pipeline: Parse → Project → Simulate
 *
 * This validates that the entire system works together:
 * 1. Parser: Protocol file → AST
 * 2. CFG Builder: AST → CFG
 * 3. Projector: CFG → CFSMs (pure LTS)
 * 4. Simulator: CFSMs → Execution traces
 *
 * This is the primary use case for SMPST: writing a protocol and
 * verifying it executes correctly through simulation.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/parser';
import { buildCFG } from '../cfg/builder';
import { projectAll } from '../projection/projector';
import { DistributedSimulator } from '../simulation/distributed-simulator';
import type { GlobalProtocolDeclaration } from '../parser/ast';

describe('End-to-End Integration: Parse → Project → Simulate', () => {
  describe('Simple Request-Response Protocol', () => {
    const protocol = `
      protocol RequestResponse(role Client, role Server) {
        Client -> Server: Request(String);
        Server -> Client: Response(Int);
      }
    `;

    it('should parse, project, and simulate successfully', async () => {
      // ============================================================================
      // STEP 1: Parse protocol source code
      // ============================================================================
      const ast = parse(protocol);

      // Verify AST structure
      expect(ast.declarations).toHaveLength(1);
      expect(ast.declarations[0].type).toBe('GlobalProtocolDeclaration');

      const globalProtocol = ast.declarations[0] as GlobalProtocolDeclaration;
      expect(globalProtocol.name).toBe('RequestResponse');
      const roleNames = globalProtocol.roles.map(r => r.name);
      expect(roleNames).toEqual(['Client', 'Server']);

      // ============================================================================
      // STEP 2: Build CFG (Control Flow Graph)
      // ============================================================================
      const cfg = buildCFG(globalProtocol);

      // Verify CFG structure
      expect(cfg.roles).toEqual(['Client', 'Server']);
      expect(cfg.nodes.length).toBeGreaterThan(0);

      // ============================================================================
      // STEP 3: Project to CFSMs (one per role)
      // ============================================================================
      const projection = projectAll(cfg);

      // Verify projection succeeded
      expect(projection.errors).toHaveLength(0);
      expect(projection.cfsms.size).toBe(2);
      expect(projection.cfsms.has('Client')).toBe(true);
      expect(projection.cfsms.has('Server')).toBe(true);

      // Verify Client CFSM (pure LTS structure)
      const clientCFSM = projection.cfsms.get('Client')!;
      expect(clientCFSM.role).toBe('Client');
      expect(clientCFSM.states.length).toBeGreaterThan(0);
      expect(clientCFSM.transitions.length).toBeGreaterThanOrEqual(2); // Send + Receive (may include tau)
      expect(clientCFSM.initialState).toBeDefined();
      expect(clientCFSM.terminalStates.length).toBeGreaterThan(0);

      // Verify Server CFSM (pure LTS structure)
      const serverCFSM = projection.cfsms.get('Server')!;
      expect(serverCFSM.role).toBe('Server');
      expect(serverCFSM.states.length).toBeGreaterThan(0);
      expect(serverCFSM.transitions.length).toBeGreaterThanOrEqual(2); // Receive + Send (may include tau)
      expect(serverCFSM.initialState).toBeDefined();
      expect(serverCFSM.terminalStates.length).toBeGreaterThan(0);

      // Verify Client sends Request
      const clientSend = clientCFSM.transitions.find(t => t.action.type === 'send');
      expect(clientSend).toBeDefined();
      expect(clientSend!.action.type).toBe('send');
      if (clientSend!.action.type === 'send') {
        expect(clientSend!.action.to).toBe('Server');
        expect(clientSend!.action.label).toBe('Request');
      }

      // Verify Server receives Request
      const serverReceive = serverCFSM.transitions.find(t => t.action.type === 'receive');
      expect(serverReceive).toBeDefined();
      expect(serverReceive!.action.type).toBe('receive');
      if (serverReceive!.action.type === 'receive') {
        expect(serverReceive!.action.from).toBe('Client');
        expect(serverReceive!.action.label).toBe('Request');
      }

      // ============================================================================
      // STEP 4: Simulate distributed execution
      // ============================================================================
      const simulator = new DistributedSimulator(projection.cfsms, {
        schedulingStrategy: 'round-robin',
        recordTrace: true,
        maxSteps: 100,
      });

      // Run simulation to completion
      const result = await simulator.run();

      // ============================================================================
      // STEP 5: Verify simulation results
      // ============================================================================
      expect(result.success).toBe(true);
      // Global steps may include tau transitions
      expect(result.globalSteps).toBeGreaterThanOrEqual(2);

      // Verify both roles completed
      const state = result.state;
      expect(state.allCompleted).toBe(true);
      expect(state.deadlocked).toBe(false);

      // Verify execution traces
      expect(result.traces).toBeDefined();
      expect(result.traces!.size).toBe(2);

      // Verify Client trace
      const clientTrace = result.traces!.get('Client');
      expect(clientTrace).toBeDefined();
      expect(clientTrace!.role).toBe('Client');
      expect(clientTrace!.completed).toBe(true);
      // May include tau/choice transitions
      expect(clientTrace!.events.length).toBeGreaterThanOrEqual(2);

      // Find send and receive events
      const clientSendEvent = clientTrace!.events.find(e => e.type === 'send');
      expect(clientSendEvent).toBeDefined();
      if (clientSendEvent && clientSendEvent.type === 'send') {
        expect(clientSendEvent.to).toBe('Server');
        expect(clientSendEvent.label).toBe('Request');
      }

      const clientReceiveEvent = clientTrace!.events.find(e => e.type === 'receive');
      expect(clientReceiveEvent).toBeDefined();
      if (clientReceiveEvent && clientReceiveEvent.type === 'receive') {
        expect(clientReceiveEvent.from).toBe('Server');
        expect(clientReceiveEvent.label).toBe('Response');
      }

      // Verify Server trace
      const serverTrace = result.traces!.get('Server');
      expect(serverTrace).toBeDefined();
      expect(serverTrace!.role).toBe('Server');
      expect(serverTrace!.completed).toBe(true);
      // May include tau/choice transitions
      expect(serverTrace!.events.length).toBeGreaterThanOrEqual(2);

      // Find send and receive events
      const serverReceiveEvent = serverTrace!.events.find(e => e.type === 'receive');
      expect(serverReceiveEvent).toBeDefined();
      if (serverReceiveEvent && serverReceiveEvent.type === 'receive') {
        expect(serverReceiveEvent.from).toBe('Client');
        expect(serverReceiveEvent.label).toBe('Request');
      }

      const serverSendEvent = serverTrace!.events.find(e => e.type === 'send');
      expect(serverSendEvent).toBeDefined();
      if (serverSendEvent && serverSendEvent.type === 'send') {
        expect(serverSendEvent.to).toBe('Client');
        expect(serverSendEvent.label).toBe('Response');
      }

      // ✅ SUCCESS: Complete pipeline works!
      // Parse → CFG → Project → Simulate → Verify
    });

    it('should produce identical results on multiple runs (deterministic)', async () => {
      // Parse and project once
      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const projection = projectAll(cfg);

      // Run simulation multiple times
      const runs = 3;
      const results = [];

      for (let i = 0; i < runs; i++) {
        const sim = new DistributedSimulator(projection.cfsms, {
          schedulingStrategy: 'round-robin', // Deterministic scheduler
          recordTrace: true,
        });
        results.push(await sim.run());
      }

      // Verify all runs succeeded
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify identical step counts
      const stepCounts = results.map(r => r.globalSteps);
      expect(new Set(stepCounts).size).toBe(1); // All the same

      // Verify identical trace lengths
      const traceLengths = results.map(r => r.traces!.get('Client')!.events.length);
      expect(new Set(traceLengths).size).toBe(1); // All the same
    });
  });

  describe('Three-Party Protocol (Buyer-Seller-Shipper)', () => {
    const protocol = `
      protocol Purchase(role Buyer, role Seller, role Shipper) {
        Buyer -> Seller: Order(String);
        Seller -> Shipper: Ship(String);
        Shipper -> Buyer: Confirmation(Int);
      }
    `;

    it('should handle three-party coordination', async () => {
      // Parse → Project → Simulate
      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const projection = projectAll(cfg);

      // Verify three roles projected
      expect(projection.cfsms.size).toBe(3);
      expect(projection.cfsms.has('Buyer')).toBe(true);
      expect(projection.cfsms.has('Seller')).toBe(true);
      expect(projection.cfsms.has('Shipper')).toBe(true);

      // Simulate
      const sim = new DistributedSimulator(projection.cfsms, {
        schedulingStrategy: 'round-robin',
        recordTrace: true,
      });
      const result = await sim.run();

      // Verify success
      expect(result.success).toBe(true);
      expect(result.state.allCompleted).toBe(true);
      expect(result.state.deadlocked).toBe(false);

      // Verify all three roles have traces
      expect(result.traces!.size).toBe(3);
      expect(result.traces!.has('Buyer')).toBe(true);
      expect(result.traces!.has('Seller')).toBe(true);
      expect(result.traces!.has('Shipper')).toBe(true);

      // Verify message sequence
      const buyerTrace = result.traces!.get('Buyer')!;
      const sellerTrace = result.traces!.get('Seller')!;
      const shipperTrace = result.traces!.get('Shipper')!;

      // Buyer: Send Order, Receive Confirmation
      // Note: May include tau/choice transitions
      expect(buyerTrace.events.length).toBeGreaterThanOrEqual(2);

      // Find send and receive events (ignoring tau/choice)
      const buyerSend = buyerTrace.events.find(e => e.type === 'send');
      const buyerReceive = buyerTrace.events.find(e => e.type === 'receive');
      expect(buyerSend).toBeDefined();
      expect(buyerReceive).toBeDefined();

      // Seller: Receive Order, Send Ship
      // Note: May include tau/choice transitions
      expect(sellerTrace.events.length).toBeGreaterThanOrEqual(2);
      const sellerReceive = sellerTrace.events.find(e => e.type === 'receive');
      const sellerSend = sellerTrace.events.find(e => e.type === 'send');
      expect(sellerReceive).toBeDefined();
      expect(sellerSend).toBeDefined();

      // Shipper: Receive Ship, Send Confirmation
      // Note: May include tau/choice transitions
      expect(shipperTrace.events.length).toBeGreaterThanOrEqual(2);
      const shipperReceive = shipperTrace.events.find(e => e.type === 'receive');
      const shipperSend = shipperTrace.events.find(e => e.type === 'send');
      expect(shipperReceive).toBeDefined();
      expect(shipperSend).toBeDefined();
    });
  });

  describe('Protocol with Choice', () => {
    const protocol = `
      protocol LoginProtocol(role Client, role Server) {
        Client -> Server: Login(String);
        choice at Server {
          Server -> Client: Success();
        } or {
          Server -> Client: Failure();
        }
      }
    `;

    it('should handle choice (non-deterministic branching)', async () => {
      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const projection = projectAll(cfg);

      expect(projection.cfsms.size).toBe(2);

      // Server CFSM should have branching structure
      const serverCFSM = projection.cfsms.get('Server')!;

      // Choice may be represented as branching from a state (multiple outgoing transitions)
      // or explicit choice actions. Check for branching structure.
      const statesWithBranching = new Set<string>();
      const transitionsByFrom = new Map<string, number>();

      for (const t of serverCFSM.transitions) {
        const count = transitionsByFrom.get(t.from) || 0;
        transitionsByFrom.set(t.from, count + 1);
        if (count + 1 > 1) {
          statesWithBranching.add(t.from);
        }
      }

      // Verify Server has branching (choice between Success and Failure)
      expect(statesWithBranching.size).toBeGreaterThan(0);

      // Simulate multiple times to test different branches
      const successCount = { success: 0, failure: 0 };

      for (let i = 0; i < 10; i++) {
        const sim = new DistributedSimulator(projection.cfsms, {
          schedulingStrategy: 'round-robin',
          recordTrace: true,
        });
        const result = await sim.run();

        expect(result.success).toBe(true);

        // Check which branch was taken
        const serverTrace = result.traces!.get('Server')!;
        const sendEvent = serverTrace.events.find(e => e.type === 'send');
        if (sendEvent && sendEvent.type === 'send') {
          if (sendEvent.label === 'Success') {
            successCount.success++;
          } else if (sendEvent.label === 'Failure') {
            successCount.failure++;
          }
        }
      }

      // At least one simulation should complete (choice is deterministic in first-strategy)
      expect(successCount.success + successCount.failure).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle parse errors gracefully', () => {
      const invalidProtocol = `
        protocol Invalid {
          This is not valid syntax
        }
      `;

      expect(() => {
        parse(invalidProtocol);
      }).toThrow();
    });

    it('should handle projection errors gracefully', () => {
      // Valid parse, but potentially invalid projection
      const protocol = `
        protocol EmptyProtocol(role A, role B) {
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0] as GlobalProtocolDeclaration);
      const projection = projectAll(cfg);

      // Should not throw, but may have empty CFSMs
      expect(projection.cfsms).toBeDefined();
    });
  });
});
