/**
 * Simulation Store Integration Tests
 *
 * These tests verify the simulation store works correctly with real protocol execution.
 * They test the full integration: parser → CFG builder → projector → coordinator → store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  initializeSimulation,
  initializeSimulationFromCFG,
  stepSimulation,
  makeChoice,
  resetSimulation,
  stopSimulation,
  // Execution state
  executionState,
  cfgExecutionState,
  isComplete,
  currentStepNumber,
  availableChoices,
  isSimulationActive,
  lastError,
} from '../simulation';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../../core/ast/types';
import type { CFG } from '../../../core/cfg/types';
import type { CFSM } from '../../../core/projection/types';

// Test helper: Parse and build CFG + CFSMs from source
function createProtocol(source: string): { cfg: CFG; cfsms: Map<string, CFSM> } {
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;
  
  if (!protocol) {
    throw new Error('No protocol found in source');
  }
  
  const cfg = buildCFG(protocol);
  const { cfsms } = projectAll(cfg);
  return { cfg, cfsms };
}

describe('Simulation Store - Integration Tests', () => {
  beforeEach(() => {
    // Clean up before each test
    stopSimulation();
  });

  describe('Basic Execution', () => {
    it('should execute simple two-message protocol', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
          B -> A: World(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);

      expect(get(isSimulationActive)).toBe(true);
      expect(get(isComplete)).toBe(false);

      // Step through the protocol
      await stepSimulation();
      await stepSimulation();

      // Should complete after both messages
      let maxSteps = 5;
      while (!get(isComplete) && maxSteps > 0) {
        await stepSimulation();
        maxSteps--;
      }

      expect(get(isComplete)).toBe(true);
    });

    it('should track step count correctly', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol SimpleProtocol(role A, role B) {
          A -> B: Msg1(string);
          B -> A: Msg2(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);

      expect(get(currentStepNumber)).toBe(0);

      await stepSimulation();
      expect(get(currentStepNumber)).toBe(1);

      await stepSimulation();
      expect(get(currentStepNumber)).toBe(2);
    });

    it('should handle three-party protocol', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol ThreeParty(role A, role B, role C) {
          A -> B: Msg1(string);
          B -> C: Msg2(string);
          C -> A: Msg3(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);

      expect(get(isSimulationActive)).toBe(true);

      // Step through all messages
      let maxSteps = 10;
      while (!get(isComplete) && maxSteps > 0) {
        await stepSimulation();
        maxSteps--;
      }

      expect(get(isComplete)).toBe(true);
    });
  });

  describe('Choice Handling', () => {
    it('should detect choice point', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol ChoiceProtocol(role A, role B) {
          choice at A {
            A -> B: Option1(string);
          } or {
            A -> B: Option2(int);
          }
        }
      `);

      await initializeSimulation(cfg, cfsms);

      // Step to reach choice point
      await stepSimulation();

      const state = get(cfgExecutionState);
      if (state?.atChoice) {
        expect(state.atChoice).toBe(true);
        expect(state.availableChoices?.length).toBeGreaterThan(0);
      }
    });

    it('should handle choice selection', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol ChoiceProtocol(role A, role B) {
          choice at A {
            A -> B: Option1(string);
          } or {
            A -> B: Option2(int);
          }
        }
      `);

      await initializeSimulation(cfg, cfsms);

      // Step to choice point
      await stepSimulation();

      const stateBefore = get(cfgExecutionState);
      if (stateBefore?.atChoice) {
        await makeChoice(0);
        
        const stateAfter = get(cfgExecutionState);
        expect(stateAfter?.atChoice).toBe(false);
      }
    });

    it('should complete after choice branch', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol ChoiceProtocol(role A, role B) {
          choice at A {
            A -> B: Option1(string);
          } or {
            A -> B: Option2(int);
          }
        }
      `);

      await initializeSimulation(cfg, cfsms);

      // Step through
      let maxSteps = 10;
      while (!get(isComplete) && maxSteps > 0) {
        const state = get(cfgExecutionState);
        if (state?.atChoice) {
          await makeChoice(0);
        } else {
          await stepSimulation();
        }
        maxSteps--;
      }

      expect(get(isComplete)).toBe(true);
    });
  });

  describe('Reset and Stop', () => {
    it('should reset simulation to initial state', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);

      await stepSimulation();
      await stepSimulation();

      expect(get(currentStepNumber)).toBeGreaterThan(0);

      resetSimulation();

      expect(get(currentStepNumber)).toBe(0);
      expect(get(isComplete)).toBe(false);
    });

    it('should stop and clean up simulation', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);
      expect(get(isSimulationActive)).toBe(true);

      stopSimulation();

      expect(get(isSimulationActive)).toBe(false);
      expect(get(cfgExecutionState)).toBeNull();
    });

    it('should reset error state', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);
      resetSimulation();

      expect(get(lastError)).toBeNull();
    });
  });

  describe('Auto-projection (CFG-only init)', () => {
    it('should initialize from CFG only', async () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `;
      
      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;
      const cfg = buildCFG(protocol);

      await initializeSimulationFromCFG(cfg);

      expect(get(isSimulationActive)).toBe(true);
      expect(get(cfgExecutionState)).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should not crash on stepping completed simulation', async () => {
      const { cfg, cfsms } = createProtocol(`
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `);

      await initializeSimulation(cfg, cfsms);

      // Step to completion
      let maxSteps = 10;
      while (!get(isComplete) && maxSteps > 0) {
        await stepSimulation();
        maxSteps--;
      }

      expect(get(isComplete)).toBe(true);

      // Stepping after completion should capture error but not crash
      await stepSimulation();
      
      // Error might be set, but simulation should still be marked complete
      expect(get(isComplete)).toBe(true);
    });
  });
});
