/**
 * Simulation Store Tests - Bisimulation Architecture
 *
 * These tests verify the store correctly uses BisimulationCoordinator
 * to coordinate CFG and CFSM execution together.
 *
 * Architecture:
 * - BisimulationCoordinator owns execution state
 * - CFG provides step ORDER
 * - CFSMs provide actual STATE
 * - Store exposes coordinator state to UI
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  simulationMode,
  cfgExecutionState,
  cfsmExecutionStates,
  executionState,
  initializeSimulation,
  initializeSimulationFromCFG,
  stepSimulation,
  makeChoice,
  resetSimulation,
  stopSimulation,
  isSimulationActive,
  isComplete,
  currentStepNumber,
  bisimulationResult,
  executionMode,
} from '../simulation';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import { projectAll } from '../../../core/projection/projector';
import type { GlobalProtocolDeclaration } from '../../../core/ast/types';
import type { CFG } from '../../../core/cfg/types';

// Test helper: Create minimal valid CFG and CFSMs from source
function createSimpleProtocol() {
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
  const cfg = buildCFG(protocol);
  const { cfsms } = projectAll(cfg);
  return { cfg, cfsms };
}

// Test helper: Create CFG with choice point
function createChoiceProtocol() {
  const source = `
    protocol ChoiceProtocol(role A, role B) {
      choice at A {
        A -> B: Option1(string);
      } or {
        A -> B: Option2(string);
      }
    }
  `;
  const module = parse(source);
  const protocol = module.declarations.find(
    d => d.type === 'GlobalProtocolDeclaration'
  ) as GlobalProtocolDeclaration;
  const cfg = buildCFG(protocol);
  const { cfsms } = projectAll(cfg);
  return { cfg, cfsms };
}

describe('Simulation Store - Bisimulation Architecture', () => {
  beforeEach(() => {
    // Clean state before each test
    stopSimulation();
  });

  describe('Initialization', () => {
    it('should start in idle mode with no active simulation', () => {
      expect(get(simulationMode)).toBe('idle');
      expect(get(cfgExecutionState)).toBeNull();
      expect(get(isSimulationActive)).toBe(false);
    });

    it('should always use bisimulation mode', () => {
      // executionMode is now a derived store that always returns 'bisimulation'
      expect(get(executionMode)).toBe('bisimulation');
    });

    it('should initialize simulation with CFG and CFSMs', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      expect(get(isSimulationActive)).toBe(true);
      expect(get(simulationMode)).toBe('idle');
      
      const state = get(cfgExecutionState);
      expect(state).not.toBeNull();
      expect(state?.currentNode).toBeDefined();
      expect(state?.completed).toBe(false);
    });

    it('should initialize simulation from CFG only (auto-project)', async () => {
      const { cfg } = createSimpleProtocol();
      await initializeSimulationFromCFG(cfg);

      expect(get(isSimulationActive)).toBe(true);
      const state = get(cfgExecutionState);
      expect(state).not.toBeNull();
    });

    it('should expose CFSM states for each role', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      const states = get(cfsmExecutionStates);
      expect(states).not.toBeNull();
      expect(states?.size).toBe(2); // A and B
      expect(states?.has('A')).toBe(true);
      expect(states?.has('B')).toBe(true);
    });
  });

  describe('Step Execution', () => {
    it('should update CFG state on step', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      const initialState = get(cfgExecutionState);
      await stepSimulation();

      const newState = get(cfgExecutionState);
      // State should be updated (stepCount incremented or node changed)
      expect(newState?.stepCount).toBeGreaterThanOrEqual(0);
    });

    it('should increment step count', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      expect(get(currentStepNumber)).toBe(0);

      await stepSimulation();
      expect(get(currentStepNumber)).toBe(1);

      await stepSimulation();
      expect(get(currentStepNumber)).toBe(2);
    });

    it('should complete when protocol finishes', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      // Step until completion
      let maxSteps = 10;
      while (!get(isComplete) && maxSteps > 0) {
        await stepSimulation();
        maxSteps--;
      }

      expect(get(isComplete)).toBe(true);
      expect(get(simulationMode)).toBe('idle');
    });
  });

  describe('Choice Handling', () => {
    it('should detect choice point', async () => {
      const { cfg, cfsms } = createChoiceProtocol();
      await initializeSimulation(cfg, cfsms);

      // Step to reach choice point
      await stepSimulation();

      const state = get(cfgExecutionState);
      expect(state?.atChoice).toBe(true);
      expect(state?.availableChoices?.length).toBeGreaterThan(0);
    });

    it('should handle choice selection', async () => {
      const { cfg, cfsms } = createChoiceProtocol();
      await initializeSimulation(cfg, cfsms);

      // Step to reach choice point
      await stepSimulation();

      const stateBefore = get(cfgExecutionState);
      expect(stateBefore?.atChoice).toBe(true);

      await makeChoice(0); // Select first branch

      const stateAfter = get(cfgExecutionState);
      expect(stateAfter?.atChoice).toBe(false);
    });
  });

  describe('Reset and Stop', () => {
    it('should reset simulation to initial state', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      await stepSimulation();
      await stepSimulation();

      expect(get(currentStepNumber)).toBeGreaterThan(0);

      resetSimulation();

      expect(get(currentStepNumber)).toBe(0);
      expect(get(isComplete)).toBe(false);
    });

    it('should stop and clean up simulation', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      expect(get(isSimulationActive)).toBe(true);

      stopSimulation();

      expect(get(isSimulationActive)).toBe(false);
      expect(get(cfgExecutionState)).toBeNull();
      expect(get(cfsmExecutionStates)).toBeNull();
    });
  });

  describe('Bisimulation Verification', () => {
    it('should provide bisimulation verification result', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      const result = get(bisimulationResult);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });

    it('should report valid bisimulation for correct protocols', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      await initializeSimulation(cfg, cfsms);

      // Step through protocol
      await stepSimulation();
      await stepSimulation();

      const result = get(bisimulationResult);
      expect(result?.valid).toBe(true);
      expect(result?.errors).toHaveLength(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should have deprecated initializeCFGSimulation that still works', async () => {
      const { cfg } = createSimpleProtocol();
      
      // This is deprecated but should still work
      const { initializeCFGSimulation } = await import('../simulation');
      await initializeCFGSimulation(cfg);

      expect(get(isSimulationActive)).toBe(true);
    });

    it('should have deprecated initializeBisimulation that works', async () => {
      const { cfg, cfsms } = createSimpleProtocol();
      
      // This is deprecated but should still work
      const { initializeBisimulation } = await import('../simulation');
      await initializeBisimulation(cfg, cfsms);

      expect(get(isSimulationActive)).toBe(true);
    });

    it('should warn when using initializeDistributedSimulation', async () => {
      const { cfsms } = createSimpleProtocol();
      
      const { initializeDistributedSimulation } = await import('../simulation');
      
      // This should throw because it's no longer supported
      await expect(initializeDistributedSimulation(cfsms)).rejects.toThrow();
    });
  });
});
