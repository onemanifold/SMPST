/**
 * SimulationControls Component Tests
 *
 * Tests verify the component correctly:
 * - Renders based on store state
 * - Handles user interactions (button clicks, slider changes)
 * - Executes async handlers successfully
 * - Updates reactively when store changes
 * - Shows correct visual feedback (status badges, disabled states)
 * - Handles choice selection in step mode vs auto-play mode
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import SimulationControls from '../SimulationControls.svelte';
import {
  initializeCFGSimulation,
  stopSimulation,
  executionState,
  isSimulationActive,
  isPlaying,
  canStep,
  isAtChoice,
  currentStepNumber,
  playbackSpeed,
  simulationMode,
} from '../../../stores/simulation';
import { createSimpleCFG, createChoiceCFG, createCompletableCFG } from './test-helpers';

describe('SimulationControls', () => {
  beforeEach(() => {
    // Clean state before each test
    stopSimulation();
  });

  describe('Initial Rendering', () => {
    it('should show placeholder when no simulation is active', () => {
      const { getByText } = render(SimulationControls);
      expect(getByText('Parse a protocol to start simulation')).toBeInTheDocument();
    });

    it('should render controls when simulation is active', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);

      expect(getByTitle('Play (auto-random mode)')).toBeInTheDocument();
      expect(getByTitle('Step forward')).toBeInTheDocument();
      expect(getByTitle('Reset simulation')).toBeInTheDocument();
    });

    it('should display initial step count as 0', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText } = render(SimulationControls);

      expect(getByText('0')).toBeInTheDocument();
    });

    it('should show idle status badge initially', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText } = render(SimulationControls);

      expect(getByText('⏯ Ready')).toBeInTheDocument();
    });
  });

  describe('Play/Pause Functionality', () => {
    it('should start playing when play button clicked', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);
      const playBtn = getByTitle('Play (auto-random mode)');

      await fireEvent.click(playBtn);

      expect(get(isPlaying)).toBe(true);
    });

    it('should show pause button when playing', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, rerender } = render(SimulationControls);
      const playBtn = getByTitle('Play (auto-random mode)');

      await fireEvent.click(playBtn);
      await rerender({});

      expect(getByTitle('Pause (auto-random mode)')).toBeInTheDocument();
    });

    it('should pause when pause button clicked', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, rerender } = render(SimulationControls);

      // Start playing
      const playBtn = getByTitle('Play (auto-random mode)');
      await fireEvent.click(playBtn);
      await rerender({});

      // Then pause
      const pauseBtn = getByTitle('Pause (auto-random mode)');
      await fireEvent.click(pauseBtn);

      expect(get(isPlaying)).toBe(false);
    });

    it('should show playing status badge when playing', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, getByText, rerender } = render(SimulationControls);
      const playBtn = getByTitle('Play (auto-random mode)');

      await fireEvent.click(playBtn);
      await rerender({});

      expect(getByText('▶ Playing')).toBeInTheDocument();
    });
  });

  describe('Step Functionality', () => {
    it('should step forward when step button clicked', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      const initialStep = get(currentStepNumber);
      await fireEvent.click(stepBtn);

      // Wait for async step to complete
      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(initialStep + 1);
      });
    });

    it('should disable step button when cannot step', async () => {
      const cfg = createCompletableCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);

      // Step until completed
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      // Wait for completion
      await waitFor(() => {
        expect(get(executionState)?.completed).toBe(true);
      });

      // Verify button is disabled
      await waitFor(() => {
        expect(stepBtn).toBeDisabled();
      });
    });

    it('should handle async stepSimulation correctly', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);
      const stepBtn = getByTitle('Step forward');

      // Should not throw and should complete
      await expect(fireEvent.click(stepBtn)).resolves.not.toThrow();

      // Verify step completed
      await waitFor(() => {
        expect(get(currentStepNumber)).toBeGreaterThan(0);
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset simulation when reset button clicked', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);

      // Step forward first
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);
      await waitFor(() => {
        expect(get(currentStepNumber)).toBeGreaterThan(0);
      });

      // Then reset
      const resetBtn = getByTitle('Reset simulation');
      await fireEvent.click(resetBtn);

      expect(get(currentStepNumber)).toBe(0);
    });

    it('should always enable reset button', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);
      const resetBtn = getByTitle('Reset simulation');

      expect(resetBtn).not.toBeDisabled();
    });
  });

  describe('Choice Handling - Step Mode', () => {
    it('should disable step button at choice when no choice selected', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle } = render(SimulationControls);

      // Step until we reach a choice
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);

      // Wait for choice point
      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      });

      // Step button should be disabled (no choice selected)
      await waitFor(() => {
        expect(stepBtn).toBeDisabled();
      });
    });

    it('should not show auto-select UI in step mode', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const { queryByText } = render(SimulationControls);

      // Step until we reach a choice
      const stepBtn = queryByText('⏭');
      if (stepBtn) await fireEvent.click(stepBtn);

      // Wait for choice point
      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      });

      // Should not show auto-select UI (only shown in play mode)
      expect(queryByText('⚡ Auto-selecting:')).not.toBeInTheDocument();
    });
  });

  describe('Choice Handling - Auto-Play Mode', () => {
    it('should show auto-select UI when at choice in play mode', async () => {
      const cfg = createChoiceCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, getByText, rerender } = render(SimulationControls);

      // Start playing
      const playBtn = getByTitle('Play (auto-random mode)');
      await fireEvent.click(playBtn);

      // Wait for choice point
      await waitFor(() => {
        expect(get(isAtChoice)).toBe(true);
      }, { timeout: 3000 });

      await rerender({});

      // Should show auto-select UI
      expect(getByText('⚡ Auto-selecting:')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should show idle/ready status badge initially', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText } = render(SimulationControls);

      // Simulation starts in idle mode
      expect(get(simulationMode)).toBe('idle');

      // Should show idle/ready badge
      expect(getByText('⏯ Ready')).toBeInTheDocument();
    });

    it('should show completed status when simulation completes', async () => {
      const cfg = createCompletableCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, getByText, rerender } = render(SimulationControls);

      // Step until completion
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      // Wait for completion
      await waitFor(() => {
        expect(get(executionState)?.completed).toBe(true);
      });

      await rerender({});

      expect(getByText('✓ Completed')).toBeInTheDocument();
    });

    it('should disable play button when completed', async () => {
      const cfg = createCompletableCFG();
      await initializeCFGSimulation(cfg);

      const { getByTitle, rerender } = render(SimulationControls);

      // Step until completion
      const stepBtn = getByTitle('Step forward');
      await fireEvent.click(stepBtn);
      await fireEvent.click(stepBtn);

      // Wait for completion
      await waitFor(() => {
        expect(get(executionState)?.completed).toBe(true);
      });

      await rerender({});

      const playBtn = getByTitle('Play (auto-random mode)');
      expect(playBtn).toBeDisabled();
    });
  });

  describe('Speed Control', () => {
    it('should render speed slider', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { container } = render(SimulationControls);
      const slider = container.querySelector('.speed-slider');

      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('type', 'range');
    });

    it('should update playback speed when slider changed', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { container } = render(SimulationControls);
      const slider = container.querySelector('.speed-slider') as HTMLInputElement;

      // Change slider value
      fireEvent.input(slider, { target: { value: '500' } });

      await waitFor(() => {
        expect(get(playbackSpeed)).toBe(500);
      });
    });

    it('should display current speed value', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText } = render(SimulationControls);

      // Default speed should be displayed
      const currentSpeed = get(playbackSpeed);
      expect(getByText(`${currentSpeed}ms`)).toBeInTheDocument();
    });
  });

  describe('Reactivity', () => {
    it('should update when store state changes', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText, rerender } = render(SimulationControls);

      // Initial state
      expect(getByText('0')).toBeInTheDocument();

      // Trigger store change by stepping
      const stepBtn = getByText('⏭');
      await fireEvent.click(stepBtn);

      // Wait for step to complete
      await waitFor(() => {
        expect(get(currentStepNumber)).toBe(1);
      });

      await rerender({});

      // Component should show updated step count
      expect(getByText('1')).toBeInTheDocument();
    });
  });
});
