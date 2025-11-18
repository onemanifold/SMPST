/**
 * Simulation Store Integration Tests
 *
 * These tests verify the simulation store works correctly with real CFG execution.
 * They test the full integration: parser → CFG builder → simulator → store → UI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  initializeSimulation,
  stepSimulation,
  makeChoice,
  resetSimulation,
  stopSimulation,
  stepBack,
  stepForward,
  jumpToStep,
  // Phase 1: Execution Events
  executionEvents,
  messageEvents,
  choiceEvents,
  recursionEvents,
  parallelEvents,
  // Phase 2: Backward Stepping
  canStepBack,
  canStepForward,
  currentStepNumber,
  totalStepCount,
  executionState,
} from '../simulation';
import { parse } from '../../../core/parser/parser';
import { buildCFG } from '../../../core/cfg/builder';
import type { GlobalProtocolDeclaration } from '../../../core/ast/types';

describe('Simulation Store - Integration Tests', () => {
  beforeEach(() => {
    // Clean up before each test
    stopSimulation();
  });

  describe('Phase 1: Execution Events - Integration', () => {
    it('should capture message events during real execution', async () => {
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

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Initially no events
      expect(get(executionEvents).length).toBe(0);

      // Step 1: Should capture A -> B: Hello
      stepSimulation();
      const events1 = get(executionEvents);
      expect(events1.length).toBe(1);
      expect(events1[0].type).toBe('message');
      if (events1[0].type === 'message') {
        expect(events1[0].from).toBe('A');
        expect(events1[0].to).toBe('B');
        expect(events1[0].label).toBe('Hello');
      }

      // Step 2: Should capture B -> A: World
      stepSimulation();
      const events2 = get(executionEvents);
      expect(events2.length).toBe(2);
      expect(events2[1].type).toBe('message');
      if (events2[1].type === 'message') {
        expect(events2[1].from).toBe('B');
        expect(events2[1].to).toBe('A');
        expect(events2[1].label).toBe('World');
      }
    });

    it('should filter events by type correctly', async () => {
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

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      stepSimulation();
      stepSimulation();

      const allEvents = get(executionEvents);
      const messages = get(messageEvents);
      const choices = get(choiceEvents);

      expect(allEvents.length).toBe(2);
      expect(messages.length).toBe(2);
      expect(choices.length).toBe(0);
    });

    it('should clear events on reset', async () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);
      stepSimulation();

      expect(get(executionEvents).length).toBe(1);

      resetSimulation();

      expect(get(executionEvents).length).toBe(0);
    });

    it('should preserve event order (chronological)', async () => {
      const source = `
        protocol SimpleProtocol(role A, role B, role C) {
          A -> B: Msg1(string);
          B -> C: Msg2(string);
          C -> A: Msg3(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      stepSimulation();
      stepSimulation();
      stepSimulation();

      const events = get(executionEvents);
      expect(events.length).toBe(3);

      // Verify chronological order
      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i].timestamp).toBeLessThanOrEqual(events[i + 1].timestamp);
      }
    });

    it('should capture choice events when choice is made', async () => {
      const source = `
        protocol ChoiceProtocol(role A, role B) {
          choice at A {
            A -> B: Option1(string);
          } or {
            A -> B: Option2(int);
          }
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Should be at choice point
      const state = get(executionState);
      expect(state?.atChoice).toBe(true);

      // Make a choice
      makeChoice(0);

      // Should have choice event
      const events = get(executionEvents);
      const choices = get(choiceEvents);
      expect(choices.length).toBeGreaterThan(0);
      expect(choices[0].type).toBe('choice');
      expect(choices[0].decidingRole).toBe('A');
      expect(choices[0].choiceIndex).toBe(0);
    });

    it('should capture recursion events', async () => {
      const source = `
        protocol RecursiveProtocol(role A, role B) {
          rec Loop {
            A -> B: Message(string);
            continue Loop;
          }
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Step through recursion
      stepSimulation(); // Enter rec
      stepSimulation(); // Message
      stepSimulation(); // Continue

      const events = get(executionEvents);
      const recEvents = get(recursionEvents);

      // Should have recursion events
      expect(recEvents.length).toBeGreaterThan(0);
      const enterEvent = recEvents.find(e => e.type === 'recursion' && e.action === 'enter');
      expect(enterEvent).toBeDefined();
      if (enterEvent && enterEvent.type === 'recursion') {
        expect(enterEvent.label).toBe('Loop');
      }
    });

    it('should capture parallel events', async () => {
      const source = `
        protocol ParallelProtocol(role A, role B, role C) {
          par {
            A -> B: Msg1(string);
          } and {
            A -> C: Msg2(string);
          }
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Step through parallel
      stepSimulation(); // Fork
      stepSimulation(); // First branch
      stepSimulation(); // Second branch
      stepSimulation(); // Join

      const events = get(executionEvents);
      const parEvents = get(parallelEvents);

      // Should have parallel events (fork and/or join)
      expect(parEvents.length).toBeGreaterThan(0);
      const forkEvent = parEvents.find(e => e.type === 'parallel' && e.action === 'fork');
      expect(forkEvent).toBeDefined();
    });
  });

  describe('Phase 2: Backward Stepping - Integration', () => {
    it('should enable stepping backward after forward steps', async () => {
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

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Initially cannot step back
      expect(get(canStepBack)).toBe(false);
      expect(get(currentStepNumber)).toBe(0);

      // Step forward
      stepSimulation();

      // Now should be able to step back
      expect(get(canStepBack)).toBe(true);
      expect(get(currentStepNumber)).toBeGreaterThan(0);
    });

    it('should restore previous state when stepping backward', async () => {
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

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Step forward twice
      stepSimulation();
      const stateAtStep1 = get(executionState);
      const step1Number = get(currentStepNumber);

      stepSimulation();
      const stateAtStep2 = get(executionState);
      const step2Number = get(currentStepNumber);

      expect(step2Number).toBeGreaterThan(step1Number);

      // Step backward
      stepBack();
      const restoredState = get(executionState);
      const restoredStepNumber = get(currentStepNumber);

      // Should be back at step 1
      expect(restoredStepNumber).toBe(step1Number);
      expect(restoredState?.stepCount).toBe(stateAtStep1?.stepCount);
    });

    it('should support stepping forward after stepping backward', async () => {
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

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Step forward twice
      stepSimulation();
      stepSimulation();
      const step2Number = get(currentStepNumber);

      // Step backward
      stepBack();
      expect(get(canStepForward)).toBe(true);

      // Step forward again
      stepForward();
      expect(get(currentStepNumber)).toBe(step2Number);
    });

    it('should track total step count correctly', async () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Msg1(string);
          B -> A: Msg2(string);
          A -> B: Msg3(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      stepSimulation();
      const total1 = get(totalStepCount);

      stepSimulation();
      const total2 = get(totalStepCount);

      stepSimulation();
      const total3 = get(totalStepCount);

      // Total should increase with each step
      expect(total2).toBeGreaterThan(total1);
      expect(total3).toBeGreaterThan(total2);

      // Step backward shouldn't decrease total
      stepBack();
      expect(get(totalStepCount)).toBe(total3);
    });

    it('should support jumpToStep to arbitrary position', async () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Msg1(string);
          B -> A: Msg2(string);
          A -> B: Msg3(string);
          B -> A: Msg4(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Take several steps
      stepSimulation(); // Step 1
      const step1 = get(currentStepNumber);
      stepSimulation(); // Step 2
      const step2 = get(currentStepNumber);
      stepSimulation(); // Step 3
      const step3 = get(currentStepNumber);

      // Jump back to step 1
      jumpToStep(step1);
      expect(get(currentStepNumber)).toBe(step1);

      // Jump forward to step 3
      jumpToStep(step3);
      expect(get(currentStepNumber)).toBe(step3);

      // Jump to step 2
      jumpToStep(step2);
      expect(get(currentStepNumber)).toBe(step2);
    });

    it.todo('should truncate events when stepping backward', async () => {
      // TODO: Event truncation during stepBack is complex
      // Current implementation keeps all events (they're preserved in history)
      // A future enhancement could filter displayed events based on current position
      // For now, backward stepping correctly restores execution state
      //
      // Ideal behavior:
      // - Events shown should match current history position
      // - Use derived store to filter: executionEvents.filter(e => e.stepNumber <= currentStep)
      // - This requires adding stepNumber to each event as it's captured

      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Msg1(string);
          B -> A: Msg2(string);
          A -> B: Msg3(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      // Take 3 steps
      stepSimulation();
      stepSimulation();
      stepSimulation();

      const events3 = get(executionEvents);
      expect(events3.length).toBe(3);

      // Step back twice
      stepBack();
      stepBack();

      // Events should be filtered to match current position
      const events1 = get(executionEvents);
      expect(events1.length).toBeLessThan(events3.length);
    });

    it('should reset history on simulation reset', async () => {
      const source = `
        protocol SimpleProtocol(role A, role B) {
          A -> B: Hello(string);
        }
      `;

      const module = parse(source);
      const protocol = module.declarations.find(
        d => d.type === 'GlobalProtocolDeclaration'
      ) as GlobalProtocolDeclaration;

      expect(protocol).toBeDefined();
      const cfg = buildCFG(protocol);

      await initializeSimulation(cfg);

      stepSimulation();
      expect(get(currentStepNumber)).toBeGreaterThan(0);

      resetSimulation();

      expect(get(currentStepNumber)).toBe(0);
      expect(get(canStepBack)).toBe(false);
    });
  });
});
