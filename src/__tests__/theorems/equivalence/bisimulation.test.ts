/**
 * Theorem: CFG vs. CFSM Bisimulation
 *
 * Formal Specification Reference:
 * - CFSM Execution Semantics (docs/CFSM_EXECUTION_SEMANTICS.md)
 * - Bisimulation Architecture (docs/CORRECT_BISIMULATION_ARCHITECTURE.md)
 *
 * This test verifies that:
 * 1. CFG and CFSMs execute in lockstep via BisimulationCoordinator
 * 2. Concurrent events can be reordered locally
 * 3. Causal dependencies are strictly enforced
 * 4. Both representations reach equivalent terminal states
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import { BisimulationCoordinator } from '../../../core/simulation/bisimulation-coordinator';

describe('Theorem: CFG vs. CFSM Bisimulation', () => {
  describe('Formal Requirement: Trace Equivalence', () => {
    it('should maintain bisimulation for simple request-response protocol', async () => {
      const protocol = `
        protocol RequestResponse(role A, role B) {
          A -> B: Request();
          B -> A: Response();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Execute until complete
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      // Verify CFG completed
      const cfgState = coordinator.getCFGState();
      expect(cfgState.completed).toBe(true);

      // Verify all CFSMs completed
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('A')?.completed).toBe(true);
      expect(cfsmStates.get('B')?.completed).toBe(true);

      // Verify bisimulation validity
      const result = coordinator.verifyBisimulation();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should maintain bisimulation for three-party protocol', async () => {
      const protocol = `
        protocol ThreeParty(role A, role B, role C) {
          A -> B: Msg1();
          B -> C: Msg2();
          C -> A: Msg3();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      // All three roles should complete
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('A')?.completed).toBe(true);
      expect(cfsmStates.get('B')?.completed).toBe(true);
      expect(cfsmStates.get('C')?.completed).toBe(true);
    });
  });

  describe('Formal Requirement: Concurrent Event Reordering', () => {
    it('should allow concurrent actions to happen in any order', async () => {
      const protocol = `
        protocol Parallel(role A, role B, role C, role D) {
          par {
            A -> B: Msg1();
          } and {
            C -> D: Msg2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
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
        if (info.actionId.label === 'Msg1') msg1NodeId = nodeId;
        if (info.actionId.label === 'Msg2') msg2NodeId = nodeId;
      }

      expect(msg1NodeId).toBeDefined();
      expect(msg2NodeId).toBeDefined();

      // They should be concurrent (can happen in any order)
      expect(analyzer.areConcurrent(msg1NodeId!, msg2NodeId!)).toBe(true);

      // Execute to completion
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Formal Requirement: Causal Dependency Enforcement', () => {
    it('should enforce causal dependencies in sequential protocol', async () => {
      const protocol = `
        protocol Sequential(role A, role B, role C) {
          A -> B: First();
          B -> C: Second();
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Verify analyzer identifies causal dependency
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      let firstNodeId: string | undefined;
      let secondNodeId: string | undefined;
      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'First') firstNodeId = nodeId;
        if (info.actionId.label === 'Second') secondNodeId = nodeId;
      }

      expect(firstNodeId).toBeDefined();
      expect(secondNodeId).toBeDefined();

      // Second MUST happen after First (causal dependency)
      expect(analyzer.mustHappenBefore(firstNodeId!, secondNodeId!)).toBe(true);
      expect(analyzer.areConcurrent(firstNodeId!, secondNodeId!)).toBe(false);

      // Execute to completion
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);
    });

    it('should enforce mixed causal and concurrent dependencies', async () => {
      const protocol = `
        protocol MixedDeps(role A, role B, role C, role D) {
          par {
            A -> B: Msg1();
            B -> A: Msg2();
          } and {
            C -> D: Msg3();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      let msg1NodeId: string | undefined;
      let msg2NodeId: string | undefined;
      let msg3NodeId: string | undefined;

      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'Msg1') msg1NodeId = nodeId;
        if (info.actionId.label === 'Msg2') msg2NodeId = nodeId;
        if (info.actionId.label === 'Msg3') msg3NodeId = nodeId;
      }

      expect(msg1NodeId).toBeDefined();
      expect(msg2NodeId).toBeDefined();
      expect(msg3NodeId).toBeDefined();

      // Msg2 depends on Msg1 (same branch, sequential)
      expect(analyzer.mustHappenBefore(msg1NodeId!, msg2NodeId!)).toBe(true);

      // Msg3 is concurrent with Msg1 and Msg2 (different branches)
      expect(analyzer.areConcurrent(msg1NodeId!, msg3NodeId!)).toBe(true);
      expect(analyzer.areConcurrent(msg2NodeId!, msg3NodeId!)).toBe(true);

      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Formal Requirement: Choice Bisimulation', () => {
    it('should maintain bisimulation through choice points', async () => {
      const protocol = `
        protocol Choice(role A, role B) {
          choice at A {
            A -> B: Option1();
          } or {
            A -> B: Option2();
          }
        }
      `;

      const ast = parse(protocol);
      const cfg = buildCFG(ast.declarations[0]);
      const { cfsms } = projectAll(cfg);

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first', // Auto-select first option
        maxSteps: 100,
      });

      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);

      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.get('A')?.completed).toBe(true);
      expect(cfsmStates.get('B')?.completed).toBe(true);
    });
  });
});
