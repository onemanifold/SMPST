/**
 * Bisimulation End-to-End Tests
 *
 * Confirms that CFG and CFSM execution maintain bisimulation:
 * - CFG provides ordering (source of truth)
 * - CFSMs provide state (distributed execution with full fidelity)
 * - Concurrent events can be reordered locally
 * - Causal dependencies are enforced
 * - Protocol violations detected
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../core/parser/parser';
import { buildCFG } from '../../core/cfg/builder';
import { projectAll } from '../../core/projection/projector';
import { BisimulationCoordinator } from '../../core/simulation/bisimulation-coordinator';

describe('Bisimulation E2E Tests', () => {
  describe('Two-Party Request-Response', () => {
    it('should maintain bisimulation for request-response protocol', async () => {
      const source = `
        protocol RequestResponse(role Client, role Server) {
          Client -> Server: request();
          Server -> Client: response();
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Execute protocol
      let steps = 0;
      while (!coordinator.isComplete() && steps < 10) {
        await coordinator.step();
        steps++;
      }

      expect(coordinator.isComplete()).toBe(true);
      expect(steps).toBe(3); // Two messages + tau transitions

      // Verify both CFG and CFSMs completed
      const cfgState = coordinator.getCFGState();
      expect(cfgState.completed).toBe(true);

      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('Client')?.completed).toBe(true);
      expect(cfsmStates.get('Server')?.completed).toBe(true);
    });
  });

  describe('Three-Party Mediation', () => {
    it('should maintain bisimulation for three-party protocol', async () => {
      const source = `
        protocol ThreeParty(role A, role B, role C) {
          A -> B: msg1();
          B -> C: msg2();
          C -> A: msg3();
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Track steps
      const executionSteps: string[] = [];
      let stepCount = 0;

      while (!coordinator.isComplete() && stepCount < 10) {
        const cfgState = coordinator.getCFGState();
        executionSteps.push(`Step ${stepCount}: ${cfgState.currentNode}`);

        await coordinator.step();
        stepCount++;
      }

      expect(coordinator.isComplete()).toBe(true);
      expect(stepCount).toBe(4); // Three messages + tau transitions

      // All roles should complete
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('A')?.completed).toBe(true);
      expect(cfsmStates.get('B')?.completed).toBe(true);
      expect(cfsmStates.get('C')?.completed).toBe(true);
    });
  });

  describe('Parallel Branches', () => {
    it('should allow concurrent actions to happen in any order', async () => {
      const source = `
        protocol Parallel(role A, role B, role C, role D) {
          par {
            A -> B: msg1();
          } and {
            C -> D: msg2();
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Verify concurrency analyzer identifies these as concurrent
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      // Should have 2 message actions
      expect(allInfo.size).toBe(2);

      // Find the two actions
      let msg1NodeId: string | undefined;
      let msg2NodeId: string | undefined;

      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'msg1') msg1NodeId = nodeId;
        if (info.actionId.label === 'msg2') msg2NodeId = nodeId;
      }

      expect(msg1NodeId).toBeDefined();
      expect(msg2NodeId).toBeDefined();

      // They should be concurrent
      expect(analyzer.areConcurrent(msg1NodeId!, msg2NodeId!)).toBe(true);

      // Execute protocol
      let steps = 0;
      while (!coordinator.isComplete() && steps < 10) {
        await coordinator.step();
        steps++;
      }

      expect(coordinator.isComplete()).toBe(true);

      // All roles should complete
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('A')?.completed).toBe(true);
      expect(cfsmStates.get('B')?.completed).toBe(true);
      expect(cfsmStates.get('C')?.completed).toBe(true);
      expect(cfsmStates.get('D')?.completed).toBe(true);
    });

    it('should enforce causal dependencies within parallel branches', async () => {
      const source = `
        protocol ParallelWithDeps(role A, role B, role C, role D) {
          par {
            A -> B: msg1();
            B -> A: msg2();
          } and {
            C -> D: msg3();
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Verify dependencies
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      // Find msg1 and msg2
      let msg1NodeId: string | undefined;
      let msg2NodeId: string | undefined;
      let msg3NodeId: string | undefined;

      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'msg1') msg1NodeId = nodeId;
        if (info.actionId.label === 'msg2') msg2NodeId = nodeId;
        if (info.actionId.label === 'msg3') msg3NodeId = nodeId;
      }

      expect(msg1NodeId).toBeDefined();
      expect(msg2NodeId).toBeDefined();
      expect(msg3NodeId).toBeDefined();

      // msg2 should depend on msg1 (same branch)
      expect(analyzer.mustHappenBefore(msg1NodeId!, msg2NodeId!)).toBe(true);

      // msg3 should be concurrent with msg1 (different branches)
      expect(analyzer.areConcurrent(msg1NodeId!, msg3NodeId!)).toBe(true);

      // Execute protocol
      let steps = 0;
      while (!coordinator.isComplete() && steps < 10) {
        await coordinator.step();
        steps++;
      }

      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Choice Protocol', () => {
    it('should maintain bisimulation through choice points', async () => {
      const source = `
        protocol Choice(role Client, role Server) {
          choice at Client {
            Client -> Server: login();
            Server -> Client: ok();
          } or {
            Client -> Server: logout();
            Server -> Client: bye();
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first', // Auto-select first option
        maxSteps: 100,
      });

      // Execute protocol
      let steps = 0;
      while (!coordinator.isComplete() && steps < 10) {
        await coordinator.step();
        steps++;
      }

      expect(coordinator.isComplete()).toBe(true);

      // Verify both roles completed
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('Client')?.completed).toBe(true);
      expect(cfsmStates.get('Server')?.completed).toBe(true);
    });
  });

  describe('Complex Protocol', () => {
    it('should handle HTTP-like protocol with parallel and sequential sections', async () => {
      const source = `
        protocol HTTP(role Client, role Server, role Cache) {
          Client -> Server: request();
          par {
            Server -> Client: response();
          } and {
            Server -> Cache: update();
          }
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Verify concurrency structure
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      expect(allInfo.size).toBe(3); // Three messages

      // Find actions
      let requestNodeId: string | undefined;
      let responseNodeId: string | undefined;
      let updateNodeId: string | undefined;

      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'request') requestNodeId = nodeId;
        if (info.actionId.label === 'response') responseNodeId = nodeId;
        if (info.actionId.label === 'update') updateNodeId = nodeId;
      }

      expect(requestNodeId).toBeDefined();
      expect(responseNodeId).toBeDefined();
      expect(updateNodeId).toBeDefined();

      // response and update should be concurrent
      expect(analyzer.areConcurrent(responseNodeId!, updateNodeId!)).toBe(true);

      // Both should depend on request (sequential before parallel)
      const responseInfo = analyzer.getConcurrencyInfo(responseNodeId!);
      const updateInfo = analyzer.getConcurrencyInfo(updateNodeId!);

      expect(responseInfo!.dependencies.has(requestNodeId!)).toBe(true);
      expect(updateInfo!.dependencies.has(requestNodeId!)).toBe(true);

      // Execute protocol
      let steps = 0;
      while (!coordinator.isComplete() && steps < 10) {
        await coordinator.step();
        steps++;
      }

      expect(coordinator.isComplete()).toBe(true);

      // All roles should complete
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('Client')?.completed).toBe(true);
      expect(cfsmStates.get('Server')?.completed).toBe(true);
      expect(cfsmStates.get('Cache')?.completed).toBe(true);
    });
  });

  describe('Concurrency Validation', () => {
    it('should track completed actions correctly', async () => {
      const source = `
        protocol Sequential(role A, role B, role C) {
          A -> B: msg1();
          B -> C: msg2();
          C -> A: msg3();
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Execute step by step and verify ordering
      expect(coordinator.getStepCount()).toBe(0);

      await coordinator.step();
      expect(coordinator.getStepCount()).toBe(1);

      await coordinator.step();
      expect(coordinator.getStepCount()).toBe(2);

      await coordinator.step();
      expect(coordinator.getStepCount()).toBe(3);
      // CFG completes but CFSMs still need tau transitions

      // Continue until all CFSMs reach terminal states
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('API Integration', () => {
    it('should provide consistent state across CFG and CFSM views', async () => {
      const source = `
        protocol Simple(role A, role B) {
          A -> B: hello();
          B -> A: world();
        }
      `;

      const ast = parse(source);
      const protocol = ast.declarations[0];
      const cfg = buildCFG(protocol);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Initial state
      expect(coordinator.isComplete()).toBe(false);
      expect(coordinator.getStepCount()).toBe(0);

      const cfgSim = coordinator.getCFGSimulator();
      expect(cfgSim.isComplete()).toBe(false);

      // Execute protocol
      let steps = 0;
      while (!coordinator.isComplete() && steps < 10) {
        await coordinator.step();
        steps++;

        // CFG and coordinator sync during message steps
        // After CFG completes, coordinator continues stepping CFSMs
      }

      // Final state
      expect(coordinator.isComplete()).toBe(true);
      expect(cfgSim.isComplete()).toBe(true);

      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('A')?.completed).toBe(true);
      expect(cfsmStates.get('B')?.completed).toBe(true);
    });
  });
});
