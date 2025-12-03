/**
 * Bisimulation Coordinator Tests
 *
 * Tests the coordination of CFG and CFSM execution as a single bisimulation.
 * Uses parser to create protocols (cleaner than manual AST construction).
 */

import { describe, it, expect } from 'vitest';
import { BisimulationCoordinator } from '../bisimulation-coordinator';
import { buildCFG } from '../../cfg/builder';
import { projectAll } from '../../projection/projector';
import { parse } from '../../parser/parser';

// Helper to create coordinator from protocol source
function createCoordinator(source: string, options?: { choiceStrategy?: 'first' | 'random'; maxSteps?: number }) {
  const ast = parse(source);
  const protocol = ast.declarations[0];
  const cfg = buildCFG(protocol);
  const { cfsms } = projectAll(cfg);
  return new BisimulationCoordinator(cfg, cfsms, {
    choiceStrategy: options?.choiceStrategy ?? 'first',
    maxSteps: options?.maxSteps ?? 100,
  });
}

describe('Bisimulation Coordinator', () => {
  describe('Simple Two-Party Protocol', () => {
    it('should coordinate CFG and CFSM execution for simple protocol', async () => {
      const coordinator = createCoordinator(`
        protocol TwoParty(role A, role B) {
          A -> B: hello();
        }
      `);

      // Check initial state
      expect(coordinator.isComplete()).toBe(false);
      expect(coordinator.getStepCount()).toBe(0);

      // Execute until complete
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      // Protocol should be complete
      expect(coordinator.isComplete()).toBe(true);

      // CFG state
      const cfgState = coordinator.getCFGState();
      expect(cfgState.completed).toBe(true);

      // CFSM states
      const cfsmStates = coordinator.getCFSMStates();
      expect(cfsmStates.size).toBe(2);

      const stateA = cfsmStates.get('A');
      const stateB = cfsmStates.get('B');

      // Both should have completed
      expect(stateA?.completed).toBe(true);
      expect(stateB?.completed).toBe(true);
    });

    it('should validate causal dependencies', async () => {
      const coordinator = createCoordinator(`
        protocol Sequential(role A, role B, role C) {
          A -> B: msg1();
          B -> C: msg2();
        }
      `);

      // Execute until complete
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);

      // Verify dependencies were tracked
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      // Should have 2 message actions
      expect(allInfo.size).toBe(2);

      // Find the second action and check it depends on the first
      let hasSecondAction = false;
      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'msg2') {
          hasSecondAction = true;
          expect(info.dependencies.size).toBeGreaterThan(0);
        }
      }
      expect(hasSecondAction).toBe(true);
    });
  });

  describe('Parallel Protocol', () => {
    it('should handle concurrent execution correctly', async () => {
      const coordinator = createCoordinator(`
        protocol Parallel(role A, role B, role C, role D) {
          par {
            A -> B: msg1();
          } and {
            C -> D: msg2();
          }
        }
      `);

      // Verify concurrency analyzer identifies these as concurrent
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      expect(allInfo.size).toBe(2);

      let msg1NodeId: string | undefined;
      let msg2NodeId: string | undefined;
      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'msg1') msg1NodeId = nodeId;
        if (info.actionId.label === 'msg2') msg2NodeId = nodeId;
      }

      expect(msg1NodeId).toBeDefined();
      expect(msg2NodeId).toBeDefined();
      expect(analyzer.areConcurrent(msg1NodeId!, msg2NodeId!)).toBe(true);

      // Execute until complete
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Choice Protocol', () => {
    it('should handle choices correctly', async () => {
      const coordinator = createCoordinator(`
        protocol Choice(role A, role B) {
          choice at A {
            A -> B: option1();
          } or {
            A -> B: option2();
          }
        }
      `);

      // Execute until complete (choiceStrategy 'first' auto-selects)
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }

      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Coordinator API', () => {
    it('should provide access to CFG simulator', async () => {
      const coordinator = createCoordinator(`
        protocol Simple(role A, role B) {
          A -> B: hello();
        }
      `);

      const cfgSimulator = coordinator.getCFGSimulator();
      expect(cfgSimulator).toBeDefined();
      expect(cfgSimulator.isComplete()).toBe(false);
    });

    it('should provide access to CFSM debuggers', async () => {
      const coordinator = createCoordinator(`
        protocol Simple(role A, role B) {
          A -> B: hello();
        }
      `);

      const debuggerA = coordinator.getDebugger('A');
      const debuggerB = coordinator.getDebugger('B');

      expect(debuggerA).toBeDefined();
      expect(debuggerB).toBeDefined();
      expect(debuggerA!.isComplete()).toBe(false);
      expect(debuggerB!.isComplete()).toBe(false);
    });

    it('should provide access to concurrency analyzer', async () => {
      const coordinator = createCoordinator(`
        protocol Simple(role A, role B) {
          A -> B: hello();
        }
      `);

      const analyzer = coordinator.getConcurrencyAnalyzer();
      expect(analyzer).toBeDefined();

      const allInfo = analyzer.getAllConcurrencyInfo();
      expect(allInfo.size).toBe(1); // One message action
    });

    it('should support reset', async () => {
      const coordinator = createCoordinator(`
        protocol Simple(role A, role B) {
          A -> B: hello();
        }
      `);

      // Execute until complete
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }
      expect(coordinator.isComplete()).toBe(true);

      // Reset
      coordinator.reset();
      expect(coordinator.isComplete()).toBe(false);
      expect(coordinator.getStepCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when stepping after completion', async () => {
      const coordinator = createCoordinator(`
        protocol Simple(role A, role B) {
          A -> B: hello();
        }
      `);

      // Execute until complete
      while (!coordinator.isComplete()) {
        await coordinator.step();
      }
      expect(coordinator.isComplete()).toBe(true);

      // Attempting another step should throw
      await expect(coordinator.step()).rejects.toThrow('Bisimulation already completed');
    });

    it('should throw error when max steps reached', async () => {
      const coordinator = createCoordinator(`
        protocol Recursive(role A, role B) {
          rec loop {
            A -> B: ping();
            continue loop;
          }
        }
      `, { maxSteps: 3 });

      // Step until max steps
      await coordinator.step();
      await coordinator.step();
      await coordinator.step();

      // Next step should throw
      await expect(coordinator.step()).rejects.toThrow('Maximum steps reached');
    });
  });
});
