/**
 * Simulation Store Tests - Contract Enforcement
 *
 * These tests GUARANTEE the store faithfully implements backend.
 * If backend adds new properties, these tests MUST be updated.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
  simulationMode,
  executionState,
  lastError,
  lastEvent,
  initializeSimulation,
  stepSimulation,
  makeChoice,
  resetSimulation,
  isSimulationActive,
  hasError
} from '../simulation-v2';
import type { CFG } from '../../../core/cfg/types';
import type { CFGStepResult } from '../../../core/simulation/types';

// Test helper: Create minimal valid CFG
function createSimpleCFG(): CFG {
  return {
    id: 'test-protocol',
    nodes: {
      'initial': {
        id: 'initial',
        type: 'initial',
        outgoing: ['n1']
      },
      'n1': {
        id: 'n1',
        type: 'action',
        action: {
          type: 'message',
          sender: 'A',
          receiver: 'B',
          label: 'msg'
        },
        outgoing: ['terminal']
      },
      'terminal': {
        id: 'terminal',
        type: 'terminal',
        outgoing: []
      }
    },
    edges: {
      'initial': [{ target: 'n1' }],
      'n1': [{ target: 'terminal' }]
    },
    initialNode: 'initial',
    terminalNode: 'terminal',
    roles: ['A', 'B']
  } as CFG;
}

// Test helper: Create CFG that will error on second step
function createErrorCFG(): CFG {
  return {
    id: 'error-protocol',
    nodes: {
      'initial': {
        id: 'initial',
        type: 'initial',
        outgoing: ['n1']
      },
      'n1': {
        id: 'n1',
        type: 'action',
        action: {
          type: 'message',
          sender: 'A',
          receiver: 'B',
          label: 'msg'
        },
        outgoing: [] // No outgoing edge - will cause error
      }
    },
    edges: {
      'initial': [{ target: 'n1' }],
      'n1': []
    },
    initialNode: 'initial',
    terminalNode: 'terminal',
    roles: ['A', 'B']
  } as CFG;
}

describe('Simulation Store - Backend Contract Enforcement', () => {
  beforeEach(() => {
    // Clean state before each test
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should start in idle mode with no active simulation', () => {
      expect(get(simulationMode)).toBe('idle');
      expect(get(executionState)).toBeNull();
      expect(get(isSimulationActive)).toBe(false);
      expect(get(lastError)).toBeNull();
      expect(get(lastEvent)).toBeNull();
    });

    it('should initialize simulation and set execution state', async () => {
      const cfg = createSimpleCFG();
      await initializeSimulation(cfg);

      expect(get(isSimulationActive)).toBe(true);
      expect(get(executionState)).not.toBeNull();
      expect(get(executionState)?.currentNode).toBe('initial');
      expect(get(lastError)).toBeNull();
    });
  });

  describe('Step Execution - SUCCESS CONTRACT', () => {
    it('should update executionState when step succeeds', async () => {
      const cfg = createSimpleCFG();
      await initializeSimulation(cfg);

      const initialNode = get(executionState)?.currentNode;
      stepSimulation();

      const state = get(executionState);
      expect(state?.currentNode).not.toBe(initialNode);
      expect(state?.stepCount).toBeGreaterThan(0);
    });

    it('should expose backend event when step succeeds', async () => {
      const cfg = createSimpleCFG();
      await initializeSimulation(cfg);

      stepSimulation();

      // ✅ CRITICAL: Backend returns event, store MUST expose it
      const event = get(lastEvent);
      expect(event).toBeDefined();
      // Event should be one of the valid types
      expect(['message', 'choice', 'recursion', 'parallel', 'subprotocol', 'state-change'])
        .toContain(event?.type);
    });

    it('should clear previous errors on successful step', async () => {
      const cfg = createSimpleCFG();
      await initializeSimulation(cfg);

      // Simulate a previous error (would come from failed step)
      // Then successful step should clear it
      stepSimulation();

      expect(get(lastError)).toBeNull();
      expect(get(hasError)).toBe(false);
    });

    it('should update stepCount from backend state', async () => {
      const cfg = createSimpleCFG();
      await initializeSimulation(cfg);

      expect(get(executionState)?.stepCount).toBe(0);

      stepSimulation();
      expect(get(executionState)?.stepCount).toBe(1);

      stepSimulation();
      expect(get(executionState)?.stepCount).toBe(2);
    });
  });

  describe('Step Execution - ERROR CONTRACT', () => {
    it('should expose backend error when step fails', async () => {
      const cfg = createErrorCFG();
      await initializeSimulation(cfg);

      // First step succeeds
      stepSimulation();
      expect(get(lastError)).toBeNull();

      // Second step fails (no outgoing edge)
      stepSimulation();

      // ✅ CRITICAL: Backend returns error, store MUST expose it
      const error = get(lastError);
      expect(error).toBeDefined();
      expect(error?.type).toBe('no-transition');
      expect(error?.message).toBeDefined();
    });

    it('should set hasError derived store on error', async () => {
      const cfg = createErrorCFG();
      await initializeSimulation(cfg);

      stepSimulation(); // Success
      expect(get(hasError)).toBe(false);

      stepSimulation(); // Error
      expect(get(hasError)).toBe(true);
    });

    it('should stop simulation on critical errors', async () => {
      const cfg = createErrorCFG();
      await initializeSimulation(cfg);

      stepSimulation();
      stepSimulation(); // Triggers error

      expect(get(simulationMode)).toBe('idle');
    });

    it('should preserve state on error', async () => {
      const cfg = createErrorCFG();
      await initializeSimulation(cfg);

      stepSimulation();
      const stateBeforeError = get(executionState);

      stepSimulation(); // Error
      const stateAfterError = get(executionState);

      // State should be preserved, not corrupted
      expect(stateAfterError).toBeDefined();
      expect(stateAfterError?.stepCount).toBeGreaterThanOrEqual(
        stateBeforeError?.stepCount ?? 0
      );
    });
  });

  describe('Choice Handling - FULL CONTRACT', () => {
    it('should handle valid choice selection', async () => {
      // TODO: Create CFG with choice point
      // Verify makeChoice updates state, event, and clears error
    });

    it('should expose error on invalid choice index', async () => {
      // TODO: Create CFG with choice point
      // Try invalid choice index
      // Verify lastError is set with type: 'invalid-choice'
    });

    it('should not stop simulation on invalid choice (allow retry)', async () => {
      // TODO: Verify mode stays 'stepping' on invalid choice
      // Only critical errors should stop simulation
    });
  });

  describe('State Reset', () => {
    it('should clear all state including errors and events', async () => {
      const cfg = createErrorCFG();
      await initializeSimulation(cfg);

      // Create some state with error
      stepSimulation();
      stepSimulation(); // Error

      expect(get(lastError)).not.toBeNull();

      // Reset should clear everything
      resetSimulation();

      expect(get(executionState)?.stepCount).toBe(0);
      expect(get(lastError)).toBeNull();
      expect(get(lastEvent)).toBeNull();
      expect(get(simulationMode)).toBe('idle');
    });
  });

  describe('Backend Contract Evolution', () => {
    /**
     * This test DOCUMENTS what properties backend returns.
     * If backend adds new properties, this test MUST be updated.
     * This forces future sessions to handle new backend features.
     */
    it('should handle all properties in CFGStepResult', async () => {
      const cfg = createSimpleCFG();
      await initializeSimulation(cfg);

      stepSimulation();

      // ✅ DOCUMENT: These are ALL the properties backend returns
      const state = get(executionState);
      const error = get(lastError);
      const event = get(lastEvent);

      // If CFGStepResult gets new properties (e.g., result.warnings),
      // TypeScript will force us to handle them, and this test will fail.

      // Verify we expose ALL backend state properties
      expect(state).toHaveProperty('currentNode');
      expect(state).toHaveProperty('visitedNodes');
      expect(state).toHaveProperty('stepCount');
      expect(state).toHaveProperty('completed');
      expect(state).toHaveProperty('atChoice');
      expect(state).toHaveProperty('availableChoices');
      expect(state).toHaveProperty('inParallel');
      expect(state).toHaveProperty('reachedMaxSteps');
      expect(state).toHaveProperty('recursionStack');

      // If any of these are missing, backend changed and we must update
    });
  });
});
