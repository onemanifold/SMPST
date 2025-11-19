/**
 * SimulationSettings Component Tests (Phase 3)
 *
 * Tests verify the component correctly:
 * - Renders collapsible settings panel
 * - Shows/hides settings on toggle
 * - Updates configuration stores
 * - Shows mode-specific settings
 * - Disables during playback
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import SimulationSettings from '../SimulationSettings.svelte';
import {
  initializeCFGSimulation,
  initializeBisimulation,
  stopSimulation,
  executionMode,
  maxStepsConfig,
  schedulingStrategy,
  deliveryModel,
  isPlaying,
  startPlaying,
} from '../../../stores/simulation';
import { createSimpleCFG, createCFGAndCFSMs } from './test-helpers';

describe('SimulationSettings', () => {
  beforeEach(() => {
    stopSimulation();
    // Reset to defaults
    maxStepsConfig.set(1000);
    schedulingStrategy.set('manual');
    deliveryModel.set('FIFO');
  });

  describe('Initial Rendering', () => {
    it('should render toggle button', () => {
      const { getByText } = render(SimulationSettings);
      expect(getByText(/Advanced/)).toBeInTheDocument();
    });

    it('should show collapsed by default', () => {
      const { container } = render(SimulationSettings);
      expect(container.querySelector('.settings-content')).not.toBeInTheDocument();
    });

    it('should show arrow indicating collapsed state', () => {
      const { getByText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      expect(toggleBtn).toHaveTextContent('▶');
    });
  });

  describe('Toggle Functionality', () => {
    it('should expand when toggle button clicked', async () => {
      const { getByText, container } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);

      await fireEvent.click(toggleBtn);

      expect(container.querySelector('.settings-content')).toBeInTheDocument();
    });

    it('should show down arrow when expanded', async () => {
      const { getByText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);

      await fireEvent.click(toggleBtn);

      expect(toggleBtn).toHaveTextContent('▼');
    });

    it('should collapse when clicked again', async () => {
      const { getByText, container } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);

      // Expand
      await fireEvent.click(toggleBtn);
      expect(container.querySelector('.settings-content')).toBeInTheDocument();

      // Collapse
      await fireEvent.click(toggleBtn);
      expect(container.querySelector('.settings-content')).not.toBeInTheDocument();
    });
  });

  describe('General Settings', () => {
    it('should show max steps input', async () => {
      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const maxStepsInput = getByLabelText('Max Steps:');
      expect(maxStepsInput).toBeInTheDocument();
      expect(maxStepsInput).toHaveAttribute('type', 'number');
    });

    it('should show current maxSteps value', async () => {
      maxStepsConfig.set(2000);

      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const maxStepsInput = getByLabelText('Max Steps:') as HTMLInputElement;
      expect(maxStepsInput.value).toBe('2000');
    });

    it('should update maxStepsConfig when input changes', async () => {
      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const maxStepsInput = getByLabelText('Max Steps:') as HTMLInputElement;
      await fireEvent.change(maxStepsInput, { target: { value: '5000' } });

      await waitFor(() => {
        expect(get(maxStepsConfig)).toBe(5000);
      });
    });

    it('should enforce min/max constraints on max steps', async () => {
      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const maxStepsInput = getByLabelText('Max Steps:') as HTMLInputElement;
      expect(maxStepsInput).toHaveAttribute('min', '100');
      expect(maxStepsInput).toHaveAttribute('max', '10000');
    });

    it('should show hint text for max steps', async () => {
      const { getByText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      expect(getByText('Simulation limit (100-10000)')).toBeInTheDocument();
    });
  });

  describe('Distributed Mode Settings', () => {
    it('should show distributed settings in bisimulation mode', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText, queryByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      expect(queryByLabelText('Scheduling:')).toBeInTheDocument();
      expect(queryByLabelText('Delivery Model:')).toBeInTheDocument();
    });

    it('should not show distributed settings in CFG mode', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText, queryByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      expect(queryByLabelText('Scheduling:')).not.toBeInTheDocument();
      expect(queryByLabelText('Delivery Model:')).not.toBeInTheDocument();
    });

    it('should show all scheduling strategies', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const schedulingSelect = getByLabelText('Scheduling:') as HTMLSelectElement;
      const options = Array.from(schedulingSelect.options).map(o => o.value);

      expect(options).toContain('manual');
      expect(options).toContain('round-robin');
      expect(options).toContain('fair');
      expect(options).toContain('random');
    });

    it('should update schedulingStrategy when select changes', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const schedulingSelect = getByLabelText('Scheduling:') as HTMLSelectElement;
      await fireEvent.change(schedulingSelect, { target: { value: 'round-robin' } });

      await waitFor(() => {
        expect(get(schedulingStrategy)).toBe('round-robin');
      });
    });

    it('should show all delivery models', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const deliverySelect = getByLabelText('Delivery Model:') as HTMLSelectElement;
      const options = Array.from(deliverySelect.options).map(o => o.value);

      expect(options).toContain('FIFO');
      expect(options).toContain('unordered');
      expect(options).toContain('lossy');
    });

    it('should update deliveryModel when select changes', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText, getByLabelText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      const deliverySelect = getByLabelText('Delivery Model:') as HTMLSelectElement;
      await fireEvent.change(deliverySelect, { target: { value: 'unordered' } });

      await waitFor(() => {
        expect(get(deliveryModel)).toBe('unordered');
      });
    });

    it('should show hint text for distributed settings', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      expect(getByText('Process scheduling strategy')).toBeInTheDocument();
      expect(getByText('Message delivery guarantees')).toBeInTheDocument();
    });
  });

  describe('Playback State', () => {
    it('should disable inputs during playback', async () => {
      const cfg = createSimpleCFG();
      await initializeCFGSimulation(cfg);

      const { getByText, getByLabelText, rerender } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      // Start playing
      startPlaying();
      await waitFor(() => {
        expect(get(isPlaying)).toBe(true);
      });
      await rerender({});

      const maxStepsInput = getByLabelText('Max Steps:');
      expect(maxStepsInput).toBeDisabled();
    });

    it('should disable distributed settings during playback', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText, getByLabelText, rerender } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      // Start playing
      startPlaying();
      await waitFor(() => {
        expect(get(isPlaying)).toBe(true);
      });
      await rerender({});

      const schedulingSelect = getByLabelText('Scheduling:');
      const deliverySelect = getByLabelText('Delivery Model:');

      expect(schedulingSelect).toBeDisabled();
      expect(deliverySelect).toBeDisabled();
    });
  });

  describe('Section Organization', () => {
    it('should show General section title', async () => {
      const { getByText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      expect(getByText('General')).toBeInTheDocument();
    });

    it('should show Distributed Execution section title in bisimulation mode', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(SimulationSettings);
      const toggleBtn = getByText(/Advanced/);
      await fireEvent.click(toggleBtn);

      expect(getByText('Distributed Execution')).toBeInTheDocument();
    });
  });
});
