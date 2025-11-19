/**
 * ChoicePreview Component Tests
 *
 * Tests verify the component correctly:
 * - Renders choice cards with all metadata
 * - Handles choice selection via click and keyboard
 * - Shows selected state correctly
 * - Respects disabled state
 * - Formats action previews correctly
 * - Displays roles and estimated steps
 * - Does not render when no choices available
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ChoicePreview from '../ChoicePreview.svelte';
import type { EnhancedChoiceOption } from '../../../../core/simulation/types';

describe('ChoicePreview', () => {
  // Helper to create test choices
  function createTestChoices(): EnhancedChoiceOption[] {
    return [
      {
        label: 'Option1',
        description: 'First choice description',
        preview: [
          { type: 'message', from: 'A', to: 'B', label: 'Hello' },
          { type: 'message', from: 'B', to: 'A', label: 'World' },
        ],
        participatingRoles: ['A', 'B'],
        estimatedSteps: 3,
      },
      {
        label: 'Option2',
        description: 'Second choice description',
        preview: [
          { type: 'message', from: 'A', to: 'C', label: 'Hi' },
        ],
        participatingRoles: ['A', 'C'],
        estimatedSteps: 2,
      },
    ];
  }

  describe('Initial Rendering', () => {
    it('should not render when choices array is empty', () => {
      const { container } = render(ChoicePreview, {
        props: {
          choices: [],
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(container.querySelector('.choice-preview-panel')).not.toBeInTheDocument();
    });

    it('should render panel title', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('Choose Branch')).toBeInTheDocument();
    });

    it('should render all choice cards', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      const cards = container.querySelectorAll('.choice-card');
      expect(cards).toHaveLength(2);
    });

    it('should render choice numbers', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('1')).toBeInTheDocument();
      expect(getByText('2')).toBeInTheDocument();
    });

    it('should render choice labels', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('Option1')).toBeInTheDocument();
      expect(getByText('Option2')).toBeInTheDocument();
    });

    it('should render choice descriptions', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('First choice description')).toBeInTheDocument();
      expect(getByText('Second choice description')).toBeInTheDocument();
    });

    it('should use default label when no label provided', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: '',
          preview: [],
          participatingRoles: [],
        },
      ];

      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('Branch 1')).toBeInTheDocument();
    });
  });

  describe('Action Preview Display', () => {
    it('should render preview actions', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      // Check formatted message actions
      expect(getByText('A → B: Hello')).toBeInTheDocument();
      expect(getByText('B → A: World')).toBeInTheDocument();
      expect(getByText('A → C: Hi')).toBeInTheDocument();
    });

    it('should format message type actions correctly', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [{ type: 'message', from: 'Alice', to: 'Bob', label: 'Greet' }],
          participatingRoles: [],
        },
      ];

      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('Alice → Bob: Greet')).toBeInTheDocument();
    });

    it('should format choice type actions correctly', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [{ type: 'choice', label: 'A' }],
          participatingRoles: [],
        },
      ];

      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('choice at A')).toBeInTheDocument();
    });

    it('should format parallel type actions correctly', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [{ type: 'parallel', label: '2 branches' }],
          participatingRoles: [],
        },
      ];

      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('parallel (2 branches)')).toBeInTheDocument();
    });

    it('should format recursion type actions correctly', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [{ type: 'recursion', label: 'X' }],
          participatingRoles: [],
        },
      ];

      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('rec X')).toBeInTheDocument();
    });

    it('should not show preview section when no preview actions', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [],
          participatingRoles: [],
        },
      ];

      const { queryByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(queryByText('Actions')).not.toBeInTheDocument();
    });
  });

  describe('Metadata Display', () => {
    it('should display participating roles', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('A, B')).toBeInTheDocument();
      expect(getByText('A, C')).toBeInTheDocument();
    });

    it('should display estimated steps', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('~3')).toBeInTheDocument();
      expect(getByText('~2')).toBeInTheDocument();
    });

    it('should not show roles if empty', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [],
          participatingRoles: [],
        },
      ];

      const { queryByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(queryByText('Roles:')).not.toBeInTheDocument();
    });

    it('should not show steps if undefined', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [],
          participatingRoles: [],
        },
      ];

      const { queryByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(queryByText('Steps:')).not.toBeInTheDocument();
    });
  });

  describe('Choice Selection', () => {
    it('should call onSelectChoice when card clicked', async () => {
      const choices = createTestChoices();
      const onSelectChoice = vi.fn();

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice,
          disabled: false,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.click(firstCard);

      expect(onSelectChoice).toHaveBeenCalledWith(0);
    });

    it('should call onSelectChoice for second card', async () => {
      const choices = createTestChoices();
      const onSelectChoice = vi.fn();

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice,
          disabled: false,
        },
      });

      const cards = container.querySelectorAll('.choice-card');
      await fireEvent.click(cards[1] as HTMLElement);

      expect(onSelectChoice).toHaveBeenCalledWith(1);
    });

    it('should call onSelectChoice when Enter key pressed', async () => {
      const choices = createTestChoices();
      const onSelectChoice = vi.fn();

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice,
          disabled: false,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.keyDown(firstCard, { key: 'Enter' });

      expect(onSelectChoice).toHaveBeenCalledWith(0);
    });

    it('should not call onSelectChoice for other keys', async () => {
      const choices = createTestChoices();
      const onSelectChoice = vi.fn();

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice,
          disabled: false,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.keyDown(firstCard, { key: 'Space' });

      expect(onSelectChoice).not.toHaveBeenCalled();
    });

    it('should show selected indicator when choice selected', () => {
      const choices = createTestChoices();
      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: 0,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('✓ Selected')).toBeInTheDocument();
    });

    it('should apply selected class to selected card', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: 1,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      const cards = container.querySelectorAll('.choice-card');
      expect(cards[0]).not.toHaveClass('selected');
      expect(cards[1]).toHaveClass('selected');
    });
  });

  describe('Disabled State', () => {
    it('should not call onSelectChoice when disabled and clicked', async () => {
      const choices = createTestChoices();
      const onSelectChoice = vi.fn();

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice,
          disabled: true,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.click(firstCard);

      expect(onSelectChoice).not.toHaveBeenCalled();
    });

    it('should not call onSelectChoice when disabled and Enter pressed', async () => {
      const choices = createTestChoices();
      const onSelectChoice = vi.fn();

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice,
          disabled: true,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      await fireEvent.keyDown(firstCard, { key: 'Enter' });

      expect(onSelectChoice).not.toHaveBeenCalled();
    });

    it('should apply disabled class to cards when disabled', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: true,
        },
      });

      const cards = container.querySelectorAll('.choice-card');
      cards.forEach(card => {
        expect(card).toHaveClass('disabled');
      });
    });

    it('should set tabindex to -1 when disabled', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: true,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      expect(firstCard.tabIndex).toBe(-1);
    });

    it('should set tabindex to 0 when not disabled', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      expect(firstCard.tabIndex).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have role="button" on choice cards', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      const cards = container.querySelectorAll('.choice-card');
      cards.forEach(card => {
        expect(card).toHaveAttribute('role', 'button');
      });
    });

    it('should be keyboard accessible', () => {
      const choices = createTestChoices();
      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      const firstCard = container.querySelector('.choice-card') as HTMLElement;
      expect(firstCard.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle choice with no description', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [],
          participatingRoles: [],
        },
      ];

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(container.querySelector('.choice-description')).not.toBeInTheDocument();
    });

    it('should handle many choices', () => {
      const choices: EnhancedChoiceOption[] = Array.from({ length: 5 }, (_, i) => ({
        label: `Choice ${i + 1}`,
        preview: [],
        participatingRoles: [],
      }));

      const { container } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      const cards = container.querySelectorAll('.choice-card');
      expect(cards).toHaveLength(5);
    });

    it('should handle action with fallback description', () => {
      const choices: EnhancedChoiceOption[] = [
        {
          label: 'Test',
          preview: [{ type: 'unknown' as any, description: 'Fallback description' }],
          participatingRoles: [],
        },
      ];

      const { getByText } = render(ChoicePreview, {
        props: {
          choices,
          selectedChoice: null,
          onSelectChoice: vi.fn(),
          disabled: false,
        },
      });

      expect(getByText('Fallback description')).toBeInTheDocument();
    });
  });
});
