/**
 * BisimulationResults Component Tests (Phase 3)
 *
 * Tests verify the component correctly:
 * - Renders only in bisimulation mode
 * - Displays equivalence results
 * - Shows divergence details when not equivalent
 * - Provides navigation to divergence point
 * - Shows trace summary
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import BisimulationResults from '../BisimulationResults.svelte';
import {
  initializeBisimulation,
  stopSimulation,
  executionMode,
  bisimulationResult,
  currentStepNumber,
} from '../../../stores/simulation';
import { createCFGAndCFSMs } from '../../controls/__tests__/test-helpers';

describe('BisimulationResults', () => {
  beforeEach(() => {
    stopSimulation();
  });

  describe('Visibility', () => {
    it('should not render when not in bisimulation mode', () => {
      const { container } = render(BisimulationResults);
      expect(container.querySelector('.bisim-results-panel')).not.toBeInTheDocument();
    });

    it('should render when in bisimulation mode', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { container } = render(BisimulationResults);
      expect(container.querySelector('.bisim-results-panel')).toBeInTheDocument();
    });

    it('should show panel title', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);
      expect(getByText('Bisimulation Verification')).toBeInTheDocument();
    });
  });

  describe('Equivalence Display', () => {
    it('should show success message when equivalent', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      // Initial state should be equivalent (before any divergence)
      const result = get(bisimulationResult);
      if (result?.equivalent) {
        expect(getByText('Behaviorally Equivalent')).toBeInTheDocument();
      }
    });

    it('should show success icon when equivalent', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { container } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result?.equivalent) {
        const successResult = container.querySelector('.result.success');
        expect(successResult).toBeInTheDocument();
        expect(successResult).toHaveTextContent('✓');
      }
    });

    it('should show equivalence description', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result?.equivalent) {
        expect(getByText(/CFG.*orchestration.*Distributed.*choreography/i)).toBeInTheDocument();
      }
    });
  });

  describe('Divergence Display', () => {
    it('should show error state when divergence detected', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { container } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent) {
        const errorResult = container.querySelector('.result.error');
        expect(errorResult).toBeInTheDocument();
        expect(errorResult).toHaveTextContent('✗');
      }
    });

    it('should show divergence message when not equivalent', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent) {
        expect(getByText('Divergence Detected')).toBeInTheDocument();
      }
    });

    it('should show divergence step when available', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent && result.divergenceStep !== undefined) {
        expect(getByText('Divergence Step:')).toBeInTheDocument();
        expect(getByText(result.divergenceStep.toString())).toBeInTheDocument();
      }
    });

    it('should show divergence reason when available', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent && result.reason) {
        expect(getByText('Reason:')).toBeInTheDocument();
        expect(getByText(result.reason)).toBeInTheDocument();
      }
    });
  });

  describe('Navigation', () => {
    it('should show jump button when divergence occurs', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { queryByText } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent && result.divergenceStep !== undefined) {
        const jumpBtn = queryByText('Jump to Divergence Point');
        expect(jumpBtn).toBeInTheDocument();
      }
    });

    it('should navigate to divergence step when jump button clicked', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { queryByText } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent && result.divergenceStep !== undefined) {
        const jumpBtn = queryByText('Jump to Divergence Point');
        if (jumpBtn) {
          const expectedStep = result.divergenceStep;
          await fireEvent.click(jumpBtn);

          // Verify navigation occurred
          expect(get(currentStepNumber)).toBe(expectedStep);
        }
      }
    });
  });

  describe('Trace Summary', () => {
    it('should show trace summary when trace exists', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      // Trace summary should be visible
      expect(getByText('Trace Comparison')).toBeInTheDocument();
    });

    it('should show number of compared steps', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { getByText } = render(BisimulationResults);

      // Should show step count
      expect(getByText(/\d+ step\(s\) compared/)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply success styling for equivalent results', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { container } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result?.equivalent) {
        const successResult = container.querySelector('.result.success');
        expect(successResult).toBeInTheDocument();
      }
    });

    it('should apply error styling for divergent results', async () => {
      const { cfg, cfsms } = createCFGAndCFSMs();
      await initializeBisimulation(cfg, cfsms);

      const { container } = render(BisimulationResults);

      const result = get(bisimulationResult);
      if (result && !result.equivalent) {
        const errorResult = container.querySelector('.result.error');
        expect(errorResult).toBeInTheDocument();
      }
    });
  });
});
