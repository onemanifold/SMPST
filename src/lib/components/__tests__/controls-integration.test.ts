/**
 * UI Component Integration Tests
 *
 * Tests verify multiple components working together with the simulation store:
 * - SimulationControls + TimelineControls synchronization
 * - SimulationControls + ChoicePreview interaction
 * - Full user workflows (play → pause → step → reset)
 * - Time-travel interaction with controls state
 * - Choice selection flow across components
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import SimulationControls from '../controls/SimulationControls.svelte';
import TimelineControls from '../controls/TimelineControls.svelte';
import ChoicePreview from '../panels/ChoicePreview.svelte';
import {
  initializeCFGSimulation,
  stopSimulation,
  currentStepNumber,
  totalStepCount,
  isPlaying,
  isAtChoice,
  availableChoices,
  executionState,
  canStepForward,
} from '../../stores/simulation';
import { createMultiStepCFG, createChoiceCFG } from '../controls/__tests__/test-helpers';

describe('UI Component Integration Tests', () => {
  beforeEach(() => {
    stopSimulation();
  });

  afterEach(() => {
    // Ensure simulation is stopped to prevent test interference
    stopSimulation();
  });

  describe('SimulationControls + TimelineControls Integration', () => {
    it('should synchronize when stepping forward via SimulationControls', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // SimulationControls includes TimelineControls, so only render SimulationControls
      const { getByTitle, getAllByText } = render(SimulationControls);

      // Step forward via simulation controls
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      // Timeline should show the step (embedded in SimulationControls)
      await waitFor(() => {
        const stepLabels = getAllByText(/Step 1 \//);
        expect(stepLabels.length).toBeGreaterThan(0);
      });
    });

    it('should synchronize when navigating via TimelineControls', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take several steps first
      const { getByTitle, getAllByText } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(3);
      });

      // Use the embedded timeline controls to go back
      const backBtn = getByTitle('Step backward');
      await fireEvent.click(backBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(2);
      });

      // Should show updated step count
      await waitFor(() => {
        const stepCounts = getAllByText('2');
        expect(stepCounts.length).toBeGreaterThan(0);
      });
    });

    it('should disable timeline controls when playing', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take a step to create history
      const { getByTitle, rerender } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      // Start playing
      const playBtn = getByTitle('Play (auto-random mode)');
      await fireEvent.click(playBtn);

      expect(get(isPlaying)).toBe(true);

      await rerender({});

      // Timeline controls (embedded) should be disabled
      const backBtn = getByTitle('Step backward');
      expect(backBtn).toBeDisabled();
    });

    it('should show correct step numbers after time-travel', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, container, getAllByText, rerender } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      // Take 3 steps
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(3);
        expect(get(totalStepCount)).toBe(3);
      });

      // Jump to step 1 using embedded timeline slider
      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;

      fireEvent.input(slider, { target: { value: '1' } });

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      await rerender({});

      // Should show step 1 in status
      const stepOnes = getAllByText('1');
      expect(stepOnes.length).toBeGreaterThan(0);

      // Timeline should show "Step 1 / 3"
      expect(getAllByText(/Step 1 \/ 3/).length).toBeGreaterThan(0);
    });
  });

  describe('SimulationControls + ChoicePreview Integration', () => {
    it('should show ChoicePreview only when at choice in step mode', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const simControls = render(SimulationControls);

      // Step until we reach a choice
      const stepBtn = simControls.getByTitle('Step forward');
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      });

      // ChoicePreview should render
      expect(simControls.getByText('Choose Branch')).toBeInTheDocument();

      // Step button should be disabled (no choice selected)
      expect(stepBtn).toBeDisabled();
    });

    it('should enable step button after choice selection', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, container } = render(SimulationControls);

      // Step until we reach a choice
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      });

      // Initially disabled
      await waitFor(() => {
        expect(stepBtn).toBeDisabled();
      });

      // Select a choice by clicking on a choice card
      await waitFor(() => {
        const choiceCard = container.querySelector('.choice-card') as HTMLElement;
        expect(choiceCard).toBeInTheDocument();
      });

      const choiceCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.click(choiceCard);

      // Step button should now be enabled
      await waitFor(() => {
        expect(stepBtn).not.toBeDisabled();
      });
    });

    it('should hide ChoicePreview in play mode', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, queryByText, rerender } = render(SimulationControls);

      // Start playing
      const playBtn = getByTitle('Play (auto-random mode)');
      await fireEvent.click(playBtn);

      expect(get(isPlaying)).toBe(true);

      // Wait for auto-play to reach choice
      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      }, { timeout: 3000 });

      await rerender({});

      // ChoicePreview should NOT show (only auto-select compact UI)
      expect(queryByText('Choose Branch')).not.toBeInTheDocument();

      // Should show auto-select UI instead
      await waitFor(() => {
        expect(queryByText('⚡ Auto-selecting:')).toBeInTheDocument();
      });

      // Pause to prevent interference with next test
      const pauseBtn = getByTitle('Pause (auto-random mode)');
      await fireEvent.click(pauseBtn);
    });

    it('should complete choice selection workflow', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, container, rerender } = render(SimulationControls);

      // Step to choice
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      });

      // Select choice
      const choiceCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.click(choiceCard);

      await rerender({});

      // Step again to execute choice
      await fireEvent.click(stepBtn);

      // Should no longer be at choice
      await waitFor(() => {
        expect(get(isAtChoice)).toBe(false);
      });
    });
  });

  describe('Full User Workflows', () => {
    it('should handle complete step-through workflow', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const simControls = render(SimulationControls);
      const stepBtn = simControls.getByTitle('Step forward');

      // Step through entire protocol
      let previousStep = get(currentStepNumber);

      for (let i = 0; i < 5; i++) {
        if (!get(executionState)?.completed) {
          await fireEvent.click(stepBtn);

          await waitFor(() => {
            expect(get(currentStepNumber)).toBeGreaterThan(previousStep);
          });

          previousStep = get(currentStepNumber);
        }
      }

      // Eventually should complete
      await waitFor(() => {
        const state = get(executionState);
        expect(state?.completed).toBe(true);
      }, { timeout: 2000 });

      // Should show completed badge
      await simControls.rerender({});
      expect(simControls.getByText('✓ Completed')).toBeInTheDocument();

      // Play button should be disabled
      const playBtn = simControls.getByTitle('Play (auto-random mode)');
      expect(playBtn).toBeDisabled();
    });

    it('should handle reset workflow', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const simControls = render(SimulationControls);
      const stepBtn = simControls.getByTitle('Step forward');
      const resetBtn = simControls.getByTitle('Reset simulation');

      // Take several steps
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBeGreaterThan(0);
      });

      // Reset
      await fireEvent.click(resetBtn);

      expect(get(currentStepNumber)).toBe(0);

      // Should show step 0
      await simControls.rerender({});
      expect(simControls.getByText('0')).toBeInTheDocument();
    });

    it('should handle play → pause → step workflow', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, container, rerender } = render(SimulationControls);

      // Start playing
      const playBtn = getByTitle('Play (auto-random mode)');
      await fireEvent.click(playBtn);

      expect(get(isPlaying)).toBe(true);

      // Wait for some automatic steps
      await waitFor(() => {
        expect(get(currentStepNumber)).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Pause
      await rerender({});
      const pauseBtn = getByTitle('Pause (auto-random mode)');
      await fireEvent.click(pauseBtn);

      expect(get(isPlaying)).toBe(false);

      const stepAtPause = get(currentStepNumber);

      // Manual step - need to be more specific since there might be multiple "Step forward" buttons
      await rerender({});

      // Use container to find the main step button (⏭ not ⏩)
      const stepButtons = container.querySelectorAll('button');
      const mainStepBtn = Array.from(stepButtons).find(btn =>
        btn.textContent?.includes('⏭')
      ) as HTMLButtonElement;

      await fireEvent.click(mainStepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(stepAtPause + 1);
      });
    });

    it('should handle time-travel → step forward workflow', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, rerender } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      // Take 3 steps
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(3);
      });

      // Use embedded timeline to go back to step 1
      const backBtn = getByTitle('Step backward');
      await fireEvent.click(backBtn);
      await fireEvent.click(backBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      // Should be able to step forward via timeline
      await rerender({});

      // Get the timeline forward button (⏩)
      const forwardBtns = Array.from(document.querySelectorAll('button[title="Step forward"]'));
      // The timeline forward button is the one with ⏩ emoji (different from the step forward ⏭)
      const timelineForwardBtn = document.querySelector('button[title="Step forward"]') as HTMLButtonElement;

      // Just verify we can step forward through the store
      expect(get(canStepForward)).toBe(true);

      // Step forward using the step button
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(2);
      });
    });
  });

  describe('State Consistency Across Components', () => {
    it('should maintain consistent state when all components rendered together', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, container, getAllByText, rerender } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      // Take steps
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(2);
      });

      // Should show step 2 in multiple places
      const step2Texts = getAllByText('2');
      expect(step2Texts.length).toBeGreaterThan(0);
      expect(getAllByText(/Step 2 \/ 2/).length).toBeGreaterThan(0);

      // Navigate via timeline slider
      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;
      fireEvent.input(slider, { target: { value: '1' } });

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      await rerender({});

      // Should update to step 1
      const step1Texts = getAllByText('1');
      expect(step1Texts.length).toBeGreaterThan(0);
      expect(getAllByText(/Step 1 \/ 2/).length).toBeGreaterThan(0);
    });

    it('should update all components when stepping', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, getAllByText, rerender } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      // Take initial step
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      // Take another step
      await fireEvent.click(stepBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(2);
      });

      await rerender({});

      // Should reflect step 2 everywhere
      const step2Texts = getAllByText('2');
      expect(step2Texts.length).toBeGreaterThan(0);
      expect(getAllByText(/Step 2 \/ 2/).length).toBeGreaterThan(0);
    });

    it('should propagate completion state to all components', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, getByText, rerender } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      // Step through until completion
      for (let i = 0; i < 10; i++) {
        if (!get(executionState)?.completed) {
          await fireEvent.click(stepBtn);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      await waitFor(() => {
        expect(get(executionState)?.completed).toBe(true);
      }, { timeout: 3000 });

      await rerender({});

      // Should show completed
      expect(getByText('✓ Completed')).toBeInTheDocument();

      // Play button should be disabled
      const playBtn = getByTitle('Play (auto-random mode)');
      expect(playBtn).toBeDisabled();

      // Timeline should still work (for reviewing history)
      const backBtn = getByTitle('Step backward');
      expect(backBtn).not.toBeDisabled();
    });
  });
});
