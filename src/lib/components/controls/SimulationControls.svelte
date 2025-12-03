<script lang="ts">
  import {
    simulationMode,
    executionState,
    isSimulationActive,
    isPlaying,
    canStep,
    isAtChoice,
    availableChoices,
    startPlaying,
    pauseSimulation,
    stepSimulation,
    resetSimulation,
    makeChoice,
    playbackSpeed,
    currentCFG,
    choiceStrategy,
    type ChoiceStrategy,
  } from '$lib/stores/simulation';
  import { IconButton } from '$lib/components/atoms';
  import TimelineControls from './TimelineControls.svelte';
  import ChoicePreview from '../panels/ChoicePreview.svelte';

  let selectedChoice: number | null = null;

  async function handleStrategyChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newStrategy = target.value as ChoiceStrategy;
    choiceStrategy.set(newStrategy);
  }

  function handleChoiceSelect(index: number) {
    selectedChoice = index;
  }

  function handlePlay() {
    startPlaying();
  }

  function handlePause() {
    pauseSimulation();
  }

  async function handleStep() {
    if ($isAtChoice && selectedChoice !== null) {
      await makeChoice(selectedChoice);
      selectedChoice = null;
    } else {
      await stepSimulation();
    }
  }

  function handleReset() {
    resetSimulation();
    selectedChoice = null;
  }

  // In play mode: auto-select and auto-step when at choice
  // In step mode: don't auto-select, wait for user input
  $: if ($isAtChoice && $isPlaying && $availableChoices.length > 0) {
    // Auto-select RANDOM choice in play mode
    const randomIndex = Math.floor(Math.random() * $availableChoices.length);
    selectedChoice = randomIndex;
    // Brief pause to show the choice (200ms), then make selection
    setTimeout(() => {
      if (selectedChoice !== null) {
        makeChoice(selectedChoice);
        selectedChoice = null;
      }
    }, 200);
  }

  // Reset selection when no longer at choice or when switching modes
  $: if (!$isAtChoice || ($isAtChoice && !$isPlaying && selectedChoice === null)) {
    // In step mode, wait for user selection (don't auto-select)
    selectedChoice = null;
  }
</script>

{#if $isSimulationActive}
  <div class="simulation-controls">
    <div class="strategy-selector-group">
      <label for="choice-strategy">Strategy:</label>
      <select
        id="choice-strategy"
        class="strategy-select"
        value={$choiceStrategy}
        on:change={handleStrategyChange}
        disabled={$isPlaying}
        title="Choice selection strategy"
      >
        <option value="manual">Manual</option>
        <option value="random">Random</option>
        <option value="first">First Branch</option>
      </select>
    </div>

    <div class="control-group">
      <IconButton
        active={$isPlaying}
        on:click={$isPlaying ? handlePause : handlePlay}
        disabled={$executionState?.completed}
        title={$isPlaying ? 'Pause' : 'Play (auto-step)'}
      >
        {$isPlaying ? '⏸' : '▶'}
      </IconButton>

      <IconButton
        on:click={handleStep}
        disabled={!$canStep || ($isAtChoice && selectedChoice === null)}
        title="Step forward"
      >
        ⏭
      </IconButton>

      <IconButton
        on:click={handleReset}
        title="Reset simulation"
      >
        ⏮
      </IconButton>
    </div>

    <div class="status-group">
      <div class="status-item">
        <span class="label">Step:</span>
        <span class="value">{$executionState?.stepCount ?? 0}</span>
      </div>

      {#if $executionState?.completed}
        <div class="status-badge success">✓ Completed</div>
      {:else if $isPlaying}
        <div class="status-badge playing">▶ Playing</div>
      {:else if $simulationMode === 'stepping'}
        <div class="status-badge stepping">⏸ Stepping</div>
      {:else}
        <div class="status-badge idle">⏯ Ready</div>
      {/if}
    </div>

    <div class="speed-group">
      <span class="speed-label">Speed:</span>
      <input
        type="range"
        min="10"
        max="1000"
        step="10"
        bind:value={$playbackSpeed}
        class="speed-slider"
        title="Playback speed: {$playbackSpeed}ms"
      />
      <span class="speed-value">{$playbackSpeed}ms</span>
    </div>

    <TimelineControls />

    <!-- Compact choice display for auto-play mode -->
    {#if $isAtChoice && $isPlaying}
      <div class="choice-group-compact" class:auto-selecting={$isPlaying}>
        <span>⚡ Auto-selecting:</span>
        <div class="choice-buttons-compact">
          {#each $availableChoices as choice, index}
            <div
              class="choice-btn-compact"
              class:auto-selected={selectedChoice === index}
            >
              {choice.label || `Branch ${index + 1}`}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Enhanced Choice Previews (outside controls bar for more space) -->
  {#if $isAtChoice && !$isPlaying}
    <ChoicePreview
      choices={$availableChoices}
      selectedChoice={selectedChoice}
      onSelectChoice={handleChoiceSelect}
      disabled={$isPlaying}
    />
  {/if}
{:else}
  <div class="simulation-controls empty">
    <p class="placeholder-text">Parse a protocol to start simulation</p>
  </div>
{/if}

<style>
  .simulation-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-bg-primary);
    flex-wrap: wrap;
  }

  .simulation-controls.empty {
    justify-content: center;
    padding: var(--spacing-1);
  }

  .placeholder-text {
    color: var(--color-text-muted);
    font-style: italic;
    font-size: var(--font-size-base);
    margin: 0;
  }

  .strategy-selector-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding-right: var(--spacing-2);
    border-right: 1px solid var(--color-border-strong);
  }

  .strategy-selector-group label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .strategy-select {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-normal);
  }

  .strategy-select:hover:not(:disabled) {
    background: var(--color-bg-active);
    border-color: var(--color-accent);
  }

  .strategy-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-group {
    display: flex;
    gap: 2px;
  }

  .status-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding-left: var(--spacing-1);
    border-left: 1px solid var(--color-border-strong);
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-base);
  }

  .status-item .label {
    color: var(--color-text-secondary);
  }

  .status-item .value {
    color: var(--color-text-inverse);
    font-weight: var(--font-weight-medium);
    font-family: var(--font-family-mono);
  }

  .status-badge {
    padding: 2px var(--spacing-1);
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
  }

  .status-badge.success {
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  .status-badge.playing {
    background: var(--color-info-bg);
    color: var(--color-info);
  }

  .status-badge.stepping {
    background: var(--color-warning-bg);
    color: var(--color-warning);
  }

  .status-badge.idle {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .speed-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding-left: var(--spacing-1);
    border-left: 1px solid var(--color-border-strong);
  }

  .speed-label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .speed-slider {
    width: 100px;
    height: 4px;
    background: var(--color-bg-hover);
    border-radius: var(--radius-sm);
    outline: none;
    -webkit-appearance: none;
  }

  .speed-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: var(--color-accent);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: background var(--transition-normal);
  }

  .speed-slider::-webkit-slider-thumb:hover {
    background: var(--color-accent-hover);
  }

  .speed-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: background var(--transition-normal);
  }

  .speed-slider::-moz-range-thumb:hover {
    background: var(--color-accent-hover);
  }

  .speed-value {
    color: var(--color-text-primary);
    font-size: var(--font-size-xs);
    font-family: var(--font-family-mono);
    min-width: 42px;
    text-align: right;
  }

  /* Auto-play mode compact choice display */
  .choice-group-compact {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    padding-left: var(--spacing-1);
    border-left: 1px solid var(--color-border-strong);
  }

  .choice-group-compact.auto-selecting {
    background: var(--color-info-bg);
    border-left-color: var(--color-info);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-md);
  }

  .choice-group-compact > span {
    color: var(--color-info);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
  }

  .choice-buttons-compact {
    display: flex;
    gap: var(--spacing-1);
    flex-wrap: wrap;
  }

  .choice-btn-compact {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    white-space: nowrap;
    transition: all var(--transition-normal);
  }

  .choice-btn-compact.auto-selected {
    background: var(--color-info);
    border-color: var(--color-info);
    color: var(--color-text-inverse);
    animation: pulse 0.5s ease-in-out;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
</style>
