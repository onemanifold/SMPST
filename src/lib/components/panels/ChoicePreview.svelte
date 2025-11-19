<script lang="ts">
  import type { EnhancedChoiceOption } from '../../../core/simulation/types';

  export let choices: EnhancedChoiceOption[];
  export let selectedChoice: number | null;
  export let onSelectChoice: (index: number) => void;
  export let disabled: boolean = false;

  function formatPreview(action: any): string {
    switch (action.type) {
      case 'message':
        return `${action.from} → ${action.to}: ${action.label}`;
      case 'choice':
        return `choice at ${action.label}`;
      case 'parallel':
        return `parallel (${action.label})`;
      case 'recursion':
        return `rec ${action.label}`;
      default:
        return action.description || '';
    }
  }
</script>

{#if choices.length > 0}
  <div class="choice-preview-panel">
    <h4 class="panel-title">Choose Branch</h4>
    <div class="choice-cards">
      {#each choices as choice, index}
        <div
          class="choice-card"
          class:selected={selectedChoice === index}
          class:disabled
          on:click={() => !disabled && onSelectChoice(index)}
          on:keydown={(e) => e.key === 'Enter' && !disabled && onSelectChoice(index)}
          role="button"
          tabindex={disabled ? -1 : 0}
        >
          <div class="choice-header">
            <span class="choice-number">{index + 1}</span>
            <h5 class="choice-label">{choice.label || `Branch ${index + 1}`}</h5>
          </div>

          {#if choice.description}
            <div class="choice-description">{choice.description}</div>
          {/if}

          <!-- Preview Actions -->
          {#if choice.preview && choice.preview.length > 0}
            <div class="preview-section">
              <div class="section-header">
                <span class="section-icon">📋</span>
                <span class="section-title">Actions</span>
              </div>
              <div class="preview-actions">
                {#each choice.preview as action}
                  <div class="preview-action">{formatPreview(action)}</div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Metadata -->
          <div class="choice-metadata">
            {#if choice.participatingRoles && choice.participatingRoles.length > 0}
              <div class="metadata-item">
                <span class="metadata-icon">👥</span>
                <span class="metadata-label">Roles:</span>
                <span class="metadata-value">{choice.participatingRoles.join(', ')}</span>
              </div>
            {/if}

            {#if choice.estimatedSteps !== undefined}
              <div class="metadata-item">
                <span class="metadata-icon">📊</span>
                <span class="metadata-label">Steps:</span>
                <span class="metadata-value">~{choice.estimatedSteps}</span>
              </div>
            {/if}
          </div>

          {#if selectedChoice === index}
            <div class="selected-indicator">✓ Selected</div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .choice-preview-panel {
    background: #1e1e1e;
    border: 1px solid #3d3d3d;
    border-radius: 6px;
    padding: 12px;
    margin: 8px 0;
  }

  .panel-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #ccc;
  }

  .choice-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .choice-card {
    background: #2d2d2d;
    border: 2px solid #3d3d3d;
    border-radius: 6px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .choice-card:hover:not(.disabled) {
    border-color: #007acc;
    background: #333;
  }

  .choice-card.selected {
    border-color: #007acc;
    background: #1a3a52;
  }

  .choice-card.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .choice-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .choice-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: #007acc;
    color: #fff;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .choice-label {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .choice-description {
    font-size: 12px;
    color: #999;
    margin-bottom: 8px;
    font-style: italic;
  }

  .preview-section {
    margin: 12px 0;
    padding: 8px;
    background: #252525;
    border-radius: 4px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .section-icon {
    font-size: 12px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preview-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preview-action {
    font-size: 12px;
    color: #ccc;
    font-family: 'Consolas', 'Monaco', monospace;
    padding: 4px 6px;
    background: #1e1e1e;
    border-left: 2px solid #007acc;
    border-radius: 2px;
  }

  .choice-metadata {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #3d3d3d;
  }

  .metadata-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .metadata-icon {
    font-size: 14px;
  }

  .metadata-label {
    color: #888;
    font-weight: 500;
  }

  .metadata-value {
    color: #ccc;
    font-weight: 400;
  }

  .selected-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #2d5f2d;
    color: #90ee90;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
</style>
