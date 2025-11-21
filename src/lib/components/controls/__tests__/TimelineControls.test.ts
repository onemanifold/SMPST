/**
 * TimelineControls Component Tests
 *
 * Tests verify the component correctly:
 * - Renders only when there are steps in history
 * - Handles backward/forward navigation
 * - Handles time-travel slider interactions
 * - Executes async handlers successfully
 * - Disables controls appropriately (when playing, at boundaries)
 * - Displays current step position correctly
 * - Updates reactively when store changes
 */
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../../test/component-helpers'; // Enable DOM matchers for component tests
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import TimelineControls from '../TimelineControls.svelte';
import {
  initializeCFGSimulation,
  stopSimulation,
  stepSimulation,
  currentStepNumber,
  totalStepCount,
  canStepBack,
  canStepForward,
  isPlaying,
  startPlaying,
  pauseSimulation,
} from '../../../stores/simulation';
import { createMultiStepCFG } from './test-helpers';

describe('TimelineControls', () => {
  beforeEach(() => {
    // Clean state before each test
    stopSimulation();
  });

  describe('Initial Rendering', () => {
    it('should not render when totalStepCount is 0', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      const { container } = render(TimelineControls);

      // Should not render timeline controls initially (no steps taken yet)
      expect(container.querySelector('.timeline-controls')).not.toBeInTheDocument();
    });

    it('should render when steps exist in history', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take a step to create history
      await stepSimulation();

      const { container } = render(TimelineControls);

      expect(container.querySelector('.timeline-controls')).toBeInTheDocument();
    });

    it('should render backward and forward buttons', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);
      await stepSimulation();

      const { getByTitle } = render(TimelineControls);

      expect(getByTitle('Step backward')).toBeInTheDocument();
      expect(getByTitle('Step forward')).toBeInTheDocument();
    });

    it('should render timeline slider', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);
      await stepSimulation();

      const { container } = render(TimelineControls);

      const slider = container.querySelector('.timeline-slider');
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('type', 'range');
    });

    it('should display current step label', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);
      await stepSimulation();

      const { getByText } = render(TimelineControls);

      expect(getByText(/Step \d+ \/ \d+/)).toBeInTheDocument();
    });
  });

  describe('Backward Navigation', () => {
    it('should step backward when backward button clicked', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take multiple steps
      await stepSimulation();
      await stepSimulation();

      const currentStep = get(currentStepNumber);
      expect(currentStep).toBeGreaterThan(0);

      const { getByTitle } = render(TimelineControls);
      const backBtn = getByTitle('Step backward');

      await fireEvent.click(backBtn);

      // Wait for async step to complete
      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(currentStep - 1);
      });
    });

    it('should disable backward button at step 0', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take one step and go back
      await stepSimulation();

      const { getByTitle, rerender } = render(TimelineControls);
      const backBtn = getByTitle('Step backward');

      await fireEvent.click(backBtn);

      // Wait for step to complete
      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(0);
      });

      await rerender({});

      // Should be disabled at step 0
      expect(backBtn).toBeDisabled();
    });

    it('should handle async stepBack correctly', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();

      const { getByTitle } = render(TimelineControls);
      const backBtn = getByTitle('Step backward');

      // Should not throw and should complete
      await expect(fireEvent.click(backBtn)).resolves.not.toThrow();

      // Verify step completed
      await waitFor(() => {
        expect(get(currentStepNumber)).toBeLessThan(2);
      });
    });
  });

  describe('Forward Navigation', () => {
    it('should step forward when forward button clicked', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take steps and go back
      await stepSimulation();
      await stepSimulation();

      const { getByTitle } = render(TimelineControls);
      const backBtn = getByTitle('Step backward');
      await fireEvent.click(backBtn);

      // Wait for back step to complete
      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      // Now go forward
      const forwardBtn = getByTitle('Step forward');
      await fireEvent.click(forwardBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(2);
      });
    });

    it('should disable forward button at latest step', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take steps and go back one
      await stepSimulation();
      await stepSimulation();

      const { getByTitle, rerender } = render(TimelineControls);
      const backBtn = getByTitle('Step backward');
      await fireEvent.click(backBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      await rerender({});

      // Forward button should be enabled (not at latest step)
      const forwardBtn = getByTitle('Step forward');
      expect(forwardBtn).not.toBeDisabled();

      // Go to latest step
      await fireEvent.click(forwardBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(2);
      });

      await rerender({});

      // Now forward should be disabled
      expect(forwardBtn).toBeDisabled();
    });

    it('should handle async stepForward correctly', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();

      const { getByTitle } = render(TimelineControls);

      // Go back first
      const backBtn = getByTitle('Step backward');
      await fireEvent.click(backBtn);

      await waitFor(() => {
        expect(get(canStepForward)).toBe(true);
      });

      // Then test forward
      const forwardBtn = getByTitle('Step forward');
      await expect(fireEvent.click(forwardBtn)).resolves.not.toThrow();

      // Verify step completed
      await waitFor(() => {
        expect(get(currentStepNumber)).toBeGreaterThan(0);
      });
    });
  });

  describe('Timeline Slider', () => {
    it('should sync slider value with current step', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();

      const { container } = render(TimelineControls);
      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;

      expect(slider.value).toBe(String(get(currentStepNumber)));
    });

    it('should jump to step when slider changed', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      // Take multiple steps
      await stepSimulation();
      await stepSimulation();
      await stepSimulation();

      const { container } = render(TimelineControls);
      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;

      // Jump to step 1
      fireEvent.input(slider, { target: { value: '1' } });

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });
    });

    it('should set slider max to totalStepCount', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();

      const { container } = render(TimelineControls);
      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;

      expect(slider.max).toBe(String(get(totalStepCount)));
    });

    it('should handle slider change asynchronously', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();
      await stepSimulation();

      const { container } = render(TimelineControls);
      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;

      // Should not throw
      await expect(
        fireEvent.input(slider, { target: { value: '0' } })
      ).resolves.not.toThrow();

      // Verify jump completed
      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(0);
      });
    });
  });

  describe('Play Mode Interactions', () => {
    it('should disable backward button when playing', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const { getByTitle, rerender } = render(TimelineControls);

      // Start playing
      startPlaying();
      await rerender({});

      const backBtn = getByTitle('Step backward');
      expect(backBtn).toBeDisabled();
    });

    it('should disable forward button when playing', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();

      const { getByTitle, rerender } = render(TimelineControls);

      // Go back one step
      const backBtn = getByTitle('Step backward');
      await fireEvent.click(backBtn);

      await waitFor(() => {
        expect(get(canStepForward)).toBe(true);
      });

      // Start playing
      startPlaying();
      await rerender({});

      const forwardBtn = getByTitle('Step forward');
      expect(forwardBtn).toBeDisabled();
    });

    it('should disable slider when playing', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const { container, rerender } = render(TimelineControls);

      // Start playing
      startPlaying();
      await rerender({});

      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;
      expect(slider).toBeDisabled();
    });

    it('should re-enable controls when paused', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const { getByTitle, rerender } = render(TimelineControls);

      // Start playing
      startPlaying();
      await rerender({});

      expect(get(isPlaying)).toBe(true);

      // Pause
      pauseSimulation();
      await rerender({});

      const backBtn = getByTitle('Step backward');
      expect(backBtn).not.toBeDisabled();
    });
  });

  describe('Step Label Display', () => {
    it('should show correct step numbers', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();
      await stepSimulation();

      const currentStep = get(currentStepNumber);
      const totalSteps = get(totalStepCount);

      const { getByText } = render(TimelineControls);

      expect(getByText(`Step ${currentStep} / ${totalSteps}`)).toBeInTheDocument();
    });

    it('should update label when stepping', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const { getByText, getByTitle, rerender } = render(TimelineControls);

      // Initial label
      expect(getByText('Step 1 / 1')).toBeInTheDocument();

      // Take another step
      await stepSimulation();
      await rerender({});

      // Label should update
      expect(getByText('Step 2 / 2')).toBeInTheDocument();
    });
  });

  describe('Reactivity', () => {
    it('should update when store state changes', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const { container, rerender } = render(TimelineControls);

      const slider = container.querySelector('.timeline-slider') as HTMLInputElement;
      const initialValue = slider.value;

      // Take another step
      await stepSimulation();
      await rerender({});

      // Slider should update
      expect(slider.value).not.toBe(initialValue);
      expect(slider.value).toBe(String(get(currentStepNumber)));
    });

    it('should update boundary states reactively', async () => {
      const cfg = createMultiStepCFG();
      await initializeCFGSimulation(cfg);

      await stepSimulation();

      const { getByTitle, rerender } = render(TimelineControls);
      const backBtn = getByTitle('Step backward');

      // Should be enabled initially
      expect(backBtn).not.toBeDisabled();

      // Go to step 0
      await fireEvent.click(backBtn);

      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(0);
      });

      await rerender({});

      // Should now be disabled
      expect(backBtn).toBeDisabled();
    });
  });
});
