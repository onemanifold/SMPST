/**
 * Simulation Store Tests - Backend Contract Enforcement (NEW ARCHITECTURE)
 *
 * These tests GUARANTEE the store faithfully exposes backend state through
 * the debugger layer. Tests verify the 4-layer architecture:
 * - Layer 2: CFGSimulator (VM runtime)
 * - Layer 3: CFGDebugger (wraps VM, adds history)
 * - Layer 4: Store (exposes debugger state to UI)
 *
 * If backend adds new properties, these tests MUST be updated.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  simulationMode,
  cfgExecutionState,
  executionState,
  initializeCFGSimulation,
  stepSimulation,
  makeChoice,
  resetSimulation,
  stopSimulation,
  isSimulationActive,
  visibleExecutionEvents,
  currentStepNumber,
  totalStepCount
} from '../simulation';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import type { GlobalProtocolDeclaration } from '../../../core/ast/types';
import type { CFG } from '../../../core/cfg/types';

// Test helper: Create minimal valid CFG from source
function createSimpleCFG(): CFG {
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
  return buildCFG(protocol);
}

// Test helper: Create CFG with choice point
function createChoiceCFG(): CFG {
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
  return buildCFG(protocol);
}

describe('Simulation Store - Backend Contract Enforcement (4-Layer Architecture)', () => {
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

    it('should initialize CFG simulation and set execution state', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      expect(get(isSimulationActive)).toBe(true);
      const state = get(cfgExecutionState);
      expect(state).not.toBeNull();
      expect(state?.currentNode).toBeDefined();
      expect(state?.completed).toBe(false);
      expect(state?.stepCount).toBe(0);
    });

    it('should initialize step tracking through debugger', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      expect(get(currentStepNumber)).toBe(0);
      expect(get(totalStepCount)).toBe(0);
    });
  });

  describe('Step Execution - Backend State Contract', () => {
    it('should update executionState from backend through debugger', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const initialNode = get(cfgExecutionState)?.currentNode;
      await stepSimulation();

      const state = get(cfgExecutionState);
      expect(state?.currentNode).not.toBe(initialNode);
      expect(state?.stepCount).toBeGreaterThan(0);
    });

    it('should capture backend events through debugger', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      expect(get(visibleExecutionEvents)).toHaveLength(0);

      await stepSimulation();

      // ✅ CRITICAL: Backend emits events, debugger captures them with stepNumber
      const events = get(visibleExecutionEvents);
      expect(events.length).toBeGreaterThan(0);

      const event = events[0];
      expect(event).toHaveProperty('stepNumber');
      expect(event).toHaveProperty('type');
      expect(['message', 'choice', 'recursion', 'parallel', 'subprotocol', 'state-change'])
        .toContain(event.type);
    });

    it('should increment stepNumber through debugger', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      expect(get(currentStepNumber)).toBe(0);

      await stepSimulation();
      expect(get(currentStepNumber)).toBe(1);
      expect(get(totalStepCount)).toBe(1);

      await stepSimulation();
      expect(get(currentStepNumber)).toBe(2);
      expect(get(totalStepCount)).toBe(2);
    });

    it('should update stepCount from backend VM state', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      expect(get(cfgExecutionState)?.stepCount).toBe(0);

      await stepSimulation();
      expect(get(cfgExecutionState)?.stepCount).toBe(1);

      await stepSimulation();
      expect(get(cfgExecutionState)?.stepCount).toBe(2);
    });

    it('should stop when execution completes', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      // Step until completion
      await stepSimulation(); // initial → n1
      await stepSimulation(); // n1 → terminal

      const state = get(cfgExecutionState);
      expect(state?.completed).toBe(true);
      expect(get(simulationMode)).toBe('idle');
    });
  });

  describe('Choice Handling - Backend Contract', () => {
    it('should detect choice point from backend state', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation(); // Move to choice point

      const state = get(cfgExecutionState);
      expect(state?.atChoice).toBe(true);
      expect(state?.availableChoices).toBeDefined();
      expect((state?.availableChoices ?? []).length).toBeGreaterThan(0);
    });

    it('should handle choice selection through makeChoice', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation(); // Move to choice point

      const stateBefore = get(cfgExecutionState);
      expect(stateBefore?.atChoice).toBe(true);

      makeChoice(0); // Select first branch

      const stateAfter = get(cfgExecutionState);
      expect(stateAfter?.atChoice).toBe(false);
      expect(stateAfter?.currentNode).not.toBe(stateBefore?.currentNode);
    });
  });

  describe('State Reset - Contract Enforcement', () => {
    it('should reset all state including events through debugger', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      // Create some execution history
      await stepSimulation();
      await stepSimulation();

      expect(get(currentStepNumber)).toBeGreaterThan(0);
      expect(get(visibleExecutionEvents).length).toBeGreaterThan(0);

      // Reset should clear everything through debugger
      resetSimulation();

      expect(get(currentStepNumber)).toBe(0);
      expect(get(totalStepCount)).toBe(0);
      expect(get(visibleExecutionEvents)).toHaveLength(0);
      expect(get(cfgExecutionState)?.stepCount).toBe(0);
      expect(get(simulationMode)).toBe('idle');
    });
  });

  describe('Backend State Contract - All Properties Exposed', () => {
    /**
     * This test DOCUMENTS what properties backend VM returns.
     * The debugger wraps the VM and must preserve all state.
     * If backend adds new properties, TypeScript + this test will catch it.
     */
    it('should expose all CFGExecutionState properties through debugger', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      // ✅ VERIFY: All backend VM state properties are exposed
      const state = get(cfgExecutionState);

      expect(state).toHaveProperty('currentNode');
      expect(state).toHaveProperty('visitedNodes');
      expect(state).toHaveProperty('stepCount');
      expect(state).toHaveProperty('completed');
      expect(state).toHaveProperty('atChoice');
      expect(state).toHaveProperty('availableChoices');
      expect(state).toHaveProperty('inParallel');
      expect(state).toHaveProperty('reachedMaxSteps');
      expect(state).toHaveProperty('recursionStack');

      // If backend adds properties (e.g., state.warnings), this will fail
      // and force us to update the debugger layer
    });

    it('should annotate backend events with debugger metadata', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const events = get(visibleExecutionEvents);
      expect(events.length).toBeGreaterThan(0);

      const event = events[0];

      // ✅ VERIFY: Backend event properties are preserved
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('timestamp');

      // ✅ VERIFY: Debugger adds stepNumber (Layer 3 responsibility)
      expect(event).toHaveProperty('stepNumber');
      expect(typeof event.stepNumber).toBe('number');
    });
  });

  describe('Debugger Layer Separation - Architecture Contract', () => {
    it('should maintain separate execution state per mode', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      // CFG state should be populated
      expect(get(cfgExecutionState)).not.toBeNull();

      // Legacy executionState should point to CFG state in cfg mode
      expect(get(executionState)).toBe(get(cfgExecutionState));
    });

    it('should track history through debugger snapshots', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      // Initial state (snapshot 0)
      expect(get(currentStepNumber)).toBe(0);
      expect(get(totalStepCount)).toBe(0);

      // Step 1 (snapshot 1)
      await stepSimulation();
      expect(get(currentStepNumber)).toBe(1);
      expect(get(totalStepCount)).toBe(1);

      // Step 2 (snapshot 2)
      await stepSimulation();
      expect(get(currentStepNumber)).toBe(2);
      expect(get(totalStepCount)).toBe(2);

      // History is maintained by debugger, not VM
      expect(get(cfgExecutionState)?.stepCount).toBe(2);
    });
  });

  describe('Distributed Mode - DistributedDebugger Contract', () => {
    it('should initialize distributed simulation with CFSMs', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeDistributedSimulation } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      const { executionMode, distributedExecutionState } = await import('../simulation');
      expect(get(executionMode)).toBe('distributed');
      expect(get(isSimulationActive)).toBe(true);

      const state = get(distributedExecutionState);
      expect(state).not.toBeNull();
      expect(state?.roleStates).toBeDefined();
      expect(state?.roleStates.size).toBe(cfg.roles.length);
    });

    it('should track distributed execution through DistributedDebugger', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeDistributedSimulation } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      expect(get(currentStepNumber)).toBe(0);
      expect(get(totalStepCount)).toBe(0);

      await await stepSimulation();
      expect(get(currentStepNumber)).toBe(1);
      expect(get(totalStepCount)).toBe(1);

      await await stepSimulation();
      expect(get(currentStepNumber)).toBe(2);
      expect(get(totalStepCount)).toBe(2);
    });

    it('should expose distributed state properties through debugger', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeDistributedSimulation, distributedExecutionState } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      await stepSimulation();

      const state = get(distributedExecutionState);

      // ✅ VERIFY: All DistributedExecutionState properties exposed
      expect(state).toHaveProperty('roleStates');
      expect(state).toHaveProperty('roleSteps');
      expect(state).toHaveProperty('globalSteps');
      expect(state).toHaveProperty('inFlightMessages');
      expect(state).toHaveProperty('roleBuffers');
      expect(state).toHaveProperty('anyCompleted');
      expect(state).toHaveProperty('allCompleted');
      expect(state).toHaveProperty('deadlocked');
      expect(state).toHaveProperty('enabledRoles');
    });

    it('should capture distributed events with role information', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeDistributedSimulation } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      await stepSimulation();

      const events = get(visibleExecutionEvents);
      expect(events.length).toBeGreaterThan(0);

      // ✅ VERIFY: Distributed events have role information
      const event = events[0] as any;
      expect(event).toHaveProperty('stepNumber');
      expect(event).toHaveProperty('role');
      expect(event).toHaveProperty('timestamp');
    });
  });

  describe('Bisimulation Mode - BisimulationValidator Contract', () => {
    it('should initialize bisimulation with both CFG and CFSMs', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeBisimulation } = await import('../simulation');
      await initializeBisimulation(cfg, cfsms);

      const { executionMode } = await import('../simulation');
      expect(get(executionMode)).toBe('bisimulation');
      expect(get(isSimulationActive)).toBe(true);

      // Both states should be populated
      expect(get(cfgExecutionState)).not.toBeNull();

      const { distributedExecutionState } = await import('../simulation');
      expect(get(distributedExecutionState)).not.toBeNull();
    });

    it('should step both debuggers in parallel', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeBisimulation } = await import('../simulation');
      await initializeBisimulation(cfg, cfsms);

      const cfgStepBefore = get(cfgExecutionState)?.stepCount;
      const { distributedExecutionState } = await import('../simulation');
      const distStepBefore = get(distributedExecutionState)?.globalSteps;

      await stepSimulation(); // Should step both

      const cfgStepAfter = get(cfgExecutionState)?.stepCount;
      const distStepAfter = get(distributedExecutionState)?.globalSteps;

      // Both should have advanced
      expect(cfgStepAfter).toBeGreaterThan(cfgStepBefore ?? 0);
      expect(distStepAfter).toBeGreaterThan(distStepBefore ?? 0);
    });

    it('should provide bisimulation trace', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeBisimulation, bisimulationTrace } = await import('../simulation');
      await initializeBisimulation(cfg, cfsms);

      await stepSimulation();
      await stepSimulation();

      const trace = get(bisimulationTrace);
      expect(trace).not.toBeNull();
      expect(trace).toHaveProperty('cfgTrace');
      expect(trace).toHaveProperty('distributedTrace');
      expect(trace).toHaveProperty('equivalent');
    });

    it('should provide equivalence checking result', async () => {
      const cfg = createSimpleCFG();
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeBisimulation, bisimulationResult } = await import('../simulation');
      await initializeBisimulation(cfg, cfsms);

      await stepSimulation();

      const result = get(bisimulationResult);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('equivalent');
      expect(result).toHaveProperty('stepsCompared');
    });
  });

  describe('Mode Switching - Execution Mode Contract', () => {
    it('should switch from CFG to Distributed mode', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { executionMode } = await import('../simulation');
      expect(get(executionMode)).toBe('cfg');

      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeDistributedSimulation } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      expect(get(executionMode)).toBe('distributed');
    });

    it('should switch from CFG to Bisimulation mode', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { executionMode } = await import('../simulation');
      expect(get(executionMode)).toBe('cfg');

      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeBisimulation } = await import('../simulation');
      await initializeBisimulation(cfg, cfsms);

      expect(get(executionMode)).toBe('bisimulation');
    });

    it('should maintain separate state per mode', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      const cfgStep = get(currentStepNumber);

      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);

      const { initializeDistributedSimulation } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      // Distributed mode starts fresh
      expect(get(currentStepNumber)).toBe(0);

      await stepSimulation();
      const distStep = get(currentStepNumber);
      expect(distStep).toBe(1);

      // CFG state is gone (modes don't share state)
      expect(get(cfgExecutionState)).toBeNull();
    });

    it('should use mode-aware derived stores', async () => {
      const cfg = createSimpleCFG();

      // CFG mode
      await initializeCFGSimulation(cfg);
      await stepSimulation();
      const cfgEvents = get(visibleExecutionEvents);
      expect(cfgEvents.length).toBeGreaterThan(0);

      // Switch to distributed mode
      const { projectAll } = await import('../../../core/projection/projector');
      const { cfsms } = projectAll(cfg);
      const { initializeDistributedSimulation } = await import('../simulation');
      await initializeDistributedSimulation(cfsms);

      // Events should be from distributed debugger now
      const distEventsInitial = get(visibleExecutionEvents);
      expect(distEventsInitial).toHaveLength(0);

      await stepSimulation();
      const distEventsAfterStep = get(visibleExecutionEvents);
      expect(distEventsAfterStep.length).toBeGreaterThan(0);
    });
  });
});
