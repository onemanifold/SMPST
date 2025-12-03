/**
 * Bisimulation Coordinator Tests
 *
 * Tests the coordination of CFG and CFSM execution as a single bisimulation.
 */

import { describe, it, expect } from 'vitest';
import { BisimulationCoordinator } from '../bisimulation-coordinator';
import { buildCFG } from '../../cfg/builder';
import { projectAll } from '../../projection/projector';
import type { Module } from '../../ast/types';

describe('Bisimulation Coordinator', () => {
  describe('Simple Two-Party Protocol', () => {
    it('should coordinate CFG and CFSM execution for simple protocol', async () => {
      // Protocol: A sends hello to B
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'TwoParty',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'MessageTransfer',
              from: 'A',
              to: ['B'],
              message: {
                label: 'hello',
                from: 'A',
                to: 'B',
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Check initial state
      expect(coordinator.isComplete()).toBe(false);
      expect(coordinator.getStepCount()).toBe(0);

      // Execute one step
      await coordinator.step();

      // After one step, protocol should be complete
      expect(coordinator.isComplete()).toBe(true);
      expect(coordinator.getStepCount()).toBe(1);

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
      // Protocol: A→B: msg1; B→C: msg2
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Sequential',
            parameters: [],
            roles: ['A', 'B', 'C'],
            body: {
              type: 'Sequence',
              left: {
                type: 'MessageTransfer',
                from: 'A',
                to: ['B'],
                message: {
                  label: 'msg1',
                  from: 'A',
                  to: 'B',
                },
              },
              right: {
                type: 'MessageTransfer',
                from: 'B',
                to: ['C'],
                message: {
                  label: 'msg2',
                  from: 'B',
                  to: 'C',
                },
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Execute first step (A→B)
      await coordinator.step();
      expect(coordinator.getStepCount()).toBe(1);
      expect(coordinator.isComplete()).toBe(false);

      // Execute second step (B→C)
      await coordinator.step();
      expect(coordinator.getStepCount()).toBe(2);
      expect(coordinator.isComplete()).toBe(true);

      // Verify dependencies were checked
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      // Should have 2 actions
      expect(allInfo.size).toBe(2);

      // Find the second action and check it depends on the first
      let secondActionInfo;
      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'msg2') {
          secondActionInfo = info;
          break;
        }
      }

      expect(secondActionInfo).toBeDefined();
      expect(secondActionInfo!.dependencies.size).toBeGreaterThan(0);
    });
  });

  describe('Parallel Protocol', () => {
    it('should handle concurrent execution correctly', async () => {
      // Protocol: par { A→B: msg1 } and { C→D: msg2 }
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Parallel',
            parameters: [],
            roles: ['A', 'B', 'C', 'D'],
            body: {
              type: 'Parallel',
              branches: [
                {
                  type: 'MessageTransfer',
                  from: 'A',
                  to: ['B'],
                  message: {
                    label: 'msg1',
                    from: 'A',
                    to: 'B',
                  },
                },
                {
                  type: 'MessageTransfer',
                  from: 'C',
                  to: ['D'],
                  message: {
                    label: 'msg2',
                    from: 'C',
                    to: 'D',
                  },
                },
              ],
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 100,
      });

      // Verify concurrency analyzer identifies these as concurrent
      const analyzer = coordinator.getConcurrencyAnalyzer();
      const allInfo = analyzer.getAllConcurrencyInfo();

      expect(allInfo.size).toBe(2);

      let msg1NodeId, msg2NodeId;
      for (const [nodeId, info] of allInfo) {
        if (info.actionId.label === 'msg1') msg1NodeId = nodeId;
        if (info.actionId.label === 'msg2') msg2NodeId = nodeId;
      }

      expect(msg1NodeId).toBeDefined();
      expect(msg2NodeId).toBeDefined();
      expect(analyzer.areConcurrent(msg1NodeId!, msg2NodeId!)).toBe(true);

      // Execute protocol - both messages can happen in any order
      await coordinator.step(); // First action
      expect(coordinator.isComplete()).toBe(false);

      await coordinator.step(); // Second action
      expect(coordinator.isComplete()).toBe(false); // Need to pass join

      await coordinator.step(); // Join node
      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Choice Protocol', () => {
    it('should handle choices correctly', async () => {
      // Protocol: choice at A { option1: A→B: msg1 } or { option2: A→B: msg2 }
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Choice',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'Choice',
              at: 'A',
              branches: [
                {
                  label: 'option1',
                  body: {
                    type: 'MessageTransfer',
                    from: 'A',
                    to: ['B'],
                    message: {
                      label: 'msg1',
                      from: 'A',
                      to: 'B',
                    },
                  },
                },
                {
                  label: 'option2',
                  body: {
                    type: 'MessageTransfer',
                    from: 'A',
                    to: ['B'],
                    message: {
                      label: 'msg2',
                      from: 'A',
                      to: 'B',
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first', // Auto-select first option
        maxSteps: 100,
      });

      // Should need to make a choice
      await coordinator.step();

      // Protocol should complete after choice is made
      expect(coordinator.isComplete()).toBe(true);
    });
  });

  describe('Coordinator API', () => {
    it('should provide access to CFG simulator', async () => {
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Simple',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'MessageTransfer',
              from: 'A',
              to: ['B'],
              message: {
                label: 'hello',
                from: 'A',
                to: 'B',
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms);

      const cfgSimulator = coordinator.getCFGSimulator();
      expect(cfgSimulator).toBeDefined();
      expect(cfgSimulator.isComplete()).toBe(false);
    });

    it('should provide access to CFSM debuggers', async () => {
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Simple',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'MessageTransfer',
              from: 'A',
              to: ['B'],
              message: {
                label: 'hello',
                from: 'A',
                to: 'B',
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms);

      const debuggerA = coordinator.getDebugger('A');
      const debuggerB = coordinator.getDebugger('B');

      expect(debuggerA).toBeDefined();
      expect(debuggerB).toBeDefined();
      expect(debuggerA!.isComplete()).toBe(false);
      expect(debuggerB!.isComplete()).toBe(false);
    });

    it('should provide access to concurrency analyzer', async () => {
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Simple',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'MessageTransfer',
              from: 'A',
              to: ['B'],
              message: {
                label: 'hello',
                from: 'A',
                to: 'B',
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms);

      const analyzer = coordinator.getConcurrencyAnalyzer();
      expect(analyzer).toBeDefined();

      const allInfo = analyzer.getAllConcurrencyInfo();
      expect(allInfo.size).toBe(1); // One message action
    });

    it('should support reset', async () => {
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Simple',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'MessageTransfer',
              from: 'A',
              to: ['B'],
              message: {
                label: 'hello',
                from: 'A',
                to: 'B',
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
      });

      // Execute protocol
      await coordinator.step();
      expect(coordinator.isComplete()).toBe(true);
      expect(coordinator.getStepCount()).toBe(1);

      // Reset
      coordinator.reset();
      expect(coordinator.isComplete()).toBe(false);
      expect(coordinator.getStepCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when stepping after completion', async () => {
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Simple',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'MessageTransfer',
              from: 'A',
              to: ['B'],
              message: {
                label: 'hello',
                from: 'A',
                to: 'B',
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
      });

      await coordinator.step();
      expect(coordinator.isComplete()).toBe(true);

      // Attempting another step should throw
      await expect(coordinator.step()).rejects.toThrow('Bisimulation already completed');
    });

    it('should throw error when max steps reached', async () => {
      // Create a recursive protocol that won't terminate naturally
      const ast: Module = {
        type: 'Module',
        declarations: [
          {
            type: 'ProtocolDeclaration',
            name: 'Recursive',
            parameters: [],
            roles: ['A', 'B'],
            body: {
              type: 'Recursion',
              label: 'loop',
              body: {
                type: 'Sequence',
                left: {
                  type: 'MessageTransfer',
                  from: 'A',
                  to: ['B'],
                  message: {
                    label: 'ping',
                    from: 'A',
                    to: 'B',
                  },
                },
                right: {
                  type: 'Continue',
                  label: 'loop',
                },
              },
            },
          },
        ],
      };

      const cfg = buildCFG(ast.declarations[0]);
      const cfsms = projectAll(cfg).cfsms;

      const coordinator = new BisimulationCoordinator(cfg, cfsms, {
        choiceStrategy: 'first',
        maxSteps: 3, // Very low limit
      });

      // Step until max steps
      await coordinator.step();
      await coordinator.step();
      await coordinator.step();

      // Next step should throw
      await expect(coordinator.step()).rejects.toThrow('Maximum steps reached');
    });
  });
});
