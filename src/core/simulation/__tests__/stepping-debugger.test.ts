/**
 * Tests for stepping debugger functionality
 */

import { describe, it, expect } from 'vitest';
import { CFGSimulator } from '../cfg-simulator';
import { parse } from '../../parser/parser';
import { buildCFG } from '../../cfg/builder';
import type { GlobalProtocolDeclaration } from '../../ast/types';

describe('CFG Simulator - Stepping Debugger', () => {
  describe('Basic stepping', () => {
    it('should step forward and record snapshots', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
          B -> A: World(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg, {
        choiceStrategy: 'first',
      });

      // Enable history tracking
      simulator.enableHistory();

      // Get initial state
      const initialState = simulator.getState();
      expect(initialState.stepCount).toBe(0);

      // Step forward
      const result1 = simulator.stepForward();
      expect(result1.success).toBe(true);
      expect(simulator.getState().stepCount).toBe(1);

      // Step forward again
      const result2 = simulator.stepForward();
      expect(result2.success).toBe(true);
      expect(simulator.getState().stepCount).toBe(2);

      // Verify execution history has snapshots
      const history = simulator.getExecutionHistory();
      const allSnapshots = history.getAllSnapshots();
      expect(allSnapshots.length).toBeGreaterThan(0);
    });

    it('should step backward and restore previous state', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
          B -> A: World(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg, {
        choiceStrategy: 'first',
      });

      // Enable history tracking
      simulator.enableHistory();

      // Step forward twice
      simulator.stepForward();
      const stateAtStep1 = simulator.getState();
      simulator.stepForward();
      const stateAtStep2 = simulator.getState();

      expect(stateAtStep2.stepCount).toBe(2);

      // Step backward
      const backResult = simulator.stepBackward();
      expect(backResult.success).toBe(true);
      const restoredState = simulator.getState();

      // Should be back at step 1
      expect(restoredState.stepCount).toBe(stateAtStep1.stepCount);
      expect(restoredState.currentNode).toBe(stateAtStep1.currentNode);
    });

    it('should fail to step backward when no history available', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg, {
        choiceStrategy: 'first',
      });

      // Don't enable history - it's disabled by default
      // Try to step backward immediately
      const result = simulator.stepBackward();
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No previous state');
    });
  });

  describe('Event emission', () => {
    it('should emit step-forward event', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg);

      simulator.enableHistory();

      let eventEmitted = false;
      simulator.on('step-forward', (data) => {
        expect(data).toBeDefined();
        expect(data.stepCount).toBeDefined();
        eventEmitted = true;
      });

      simulator.stepForward();
      expect(eventEmitted).toBe(true);
    });

    it('should emit step-back event', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
          B -> A: World(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg);

      simulator.enableHistory();
      // Take multiple steps to ensure we have snapshots
      simulator.stepForward();
      simulator.stepForward();

      let eventEmitted = false;
      simulator.on('step-back', (data) => {
        expect(data).toBeDefined();
        expect(data.stepCount).toBeDefined();
        expect(data.restoredState).toBeDefined();
        eventEmitted = true;
      });

      const result = simulator.stepBackward();
      expect(result.success).toBe(true);
      expect(eventEmitted).toBe(true);
    });
  });

  describe('Choice state preservation', () => {
    it('should preserve choice state when stepping backward', () => {
      const source = `
        protocol ChoiceProtocol(role A, role B) {
          choice at A {
            A -> B: Option1(string);
            B -> A: Response1(string);
          } or {
            A -> B: Option2(string);
            B -> A: Response2(string);
          }
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg, {
        choiceStrategy: 'manual',
      });

      simulator.enableHistory();

      // Should be at choice point
      const state1 = simulator.getState();
      expect(state1.atChoice).toBe(true);
      expect(state1.availableChoices?.length).toBe(2);

      // Make a choice and step forward twice
      simulator.choose(0);
      simulator.stepForward();
      const state2 = simulator.getState();

      simulator.stepForward();
      const state3 = simulator.getState();
      expect(state3.stepCount).toBeGreaterThan(state2.stepCount);

      // Step backward
      const result = simulator.stepBackward();
      expect(result.success).toBe(true);

      // Should be back to state2
      const restoredState = simulator.getState();
      expect(restoredState.stepCount).toBe(state2.stepCount);
    });
  });

  describe('Parallel state preservation', () => {
    it('should preserve parallel state when stepping backward', () => {
      const source = `
        protocol ParallelProtocol(role A, role B, role C) {
          par {
            A -> B: Hello(string);
          } and {
            A -> C: World(string);
          }
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg);

      simulator.enableHistory();

      // Step into parallel
      simulator.stepForward();
      const parallelState = simulator.getState();
      expect(parallelState.inParallel).toBe(true);

      // Step forward more
      simulator.stepForward();
      simulator.stepForward();

      // Step backward
      simulator.stepBackward();
      const restoredState = simulator.getState();

      // Parallel state should be preserved
      expect(restoredState.inParallel).toBeDefined();
    });
  });

  describe('History management', () => {
    it('should enable and disable history tracking', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg);

      // History disabled by default
      const history = simulator.getExecutionHistory();

      simulator.stepForward();
      let snapshots = history.getAllSnapshots();
      // Should only have initial snapshot
      expect(snapshots.length).toBeLessThanOrEqual(1);

      // Enable history
      simulator.enableHistory();
      simulator.reset();

      simulator.stepForward();
      simulator.stepForward();

      snapshots = history.getAllSnapshots();
      // Should have multiple snapshots now
      expect(snapshots.length).toBeGreaterThan(1);
    });

    it('should clear history on reset', () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
          B -> A: World(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      if (!protocol) {
        throw new Error('No protocol found in module');
      }

      const cfg = buildCFG(protocol);
      const simulator = new CFGSimulator(cfg);

      simulator.enableHistory();

      // Take several steps
      simulator.stepForward();
      simulator.stepForward();

      const history = simulator.getExecutionHistory();
      let snapshots = history.getAllSnapshots();
      expect(snapshots.length).toBeGreaterThan(1);

      // Reset
      simulator.reset();

      snapshots = history.getAllSnapshots();
      // Should only have initial snapshot after reset
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].stepNumber).toBe(0);
    });
  });
});
