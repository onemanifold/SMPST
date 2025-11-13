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
  } from '$lib/stores/simulation';

  let selectedChoice: number | null = null;

  function handlePlay() {
    startPlaying();
  }

  function handlePause() {
    pauseSimulation();
  }

  function handleStep() {
    if ($isAtChoice && selectedChoice !== null) {
      makeChoice(selectedChoice);
      selectedChoice = null;
    } else {
      stepSimulation();
    }
  }

  function handleReset() {
    resetSimulation();
    selectedChoice = null;
  }

  // Auto-select first choice if at choice point
  $: if ($isAtChoice && $availableChoices.length > 0 && selectedChoice === null) {
    selectedChoice = 0;
  }
</script>

{#if $isSimulationActive}
  <div class="simulation-controls">
    <div class="control-group">
      <button
        class="control-btn"
        class:active={$isPlaying}
        on:click={$isPlaying ? handlePause : handlePlay}
        disabled={$executionState?.completed}
        title={$isPlaying ? 'Pause (auto-random mode)' : 'Play (auto-random mode)'}
      >
        {$isPlaying ? '⏸' : '▶'}
      </button>

      <button
        class="control-btn"
        on:click={handleStep}
        disabled={!$canStep || ($isAtChoice && selectedChoice === null)}
        title="Step forward"
      >
        ⏭
      </button>

      <button
        class="control-btn"
        on:click={handleReset}
        title="Reset simulation"
      >
        ⏮
      </button>
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

    {#if $isAtChoice && !$isPlaying}
      <div class="choice-group">
        <span class="choice-label">Choose branch:</span>
        <select bind:value={selectedChoice} class="choice-select">
          {#each $availableChoices as choice, index}
            <option value={index}>
              {choice.label || `Branch ${index + 1}`}
              {choice.description ? ` - ${choice.description}` : ''}
            </option>
          {/each}
        </select>
      </div>
    {/if}
  </div>
{:else}
  <div class="simulation-controls empty">
    <p class="placeholder-text">Parse a protocol to start simulation</p>
  </div>
{/if}

<style>
  .simulation-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
    flex-wrap: wrap;
  }

  .simulation-controls.empty {
    justify-content: center;
    padding: 6px;
  }

  .placeholder-text {
    color: #666;
    font-style: italic;
    font-size: 13px;
    margin: 0;
  }

  .control-group {
    display: flex;
    gap: 2px;
  }

  .control-btn {
    width: 32px;
    height: 32px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .control-btn:hover:not(:disabled) {
    background: #4d4d4d;
    border-color: #007acc;
  }

  .control-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .control-btn.active {
    background: #007acc;
    color: #fff;
    border-color: #007acc;
  }

  .status-group {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 6px;
    border-left: 1px solid #555;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 13px;
  }

  .status-item .label {
    color: #888;
  }

  .status-item .value {
    color: #fff;
    font-weight: 500;
    font-family: monospace;
  }

  .status-badge {
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }

  .status-badge.success {
    background: #2d5f2d;
    color: #90ee90;
  }

  .status-badge.playing {
    background: #2d4d7f;
    color: #66b3ff;
  }

  .status-badge.stepping {
    background: #5f5f2d;
    color: #ffeb3b;
  }

  .status-badge.idle {
    background: #3d3d3d;
    color: #ccc;
  }

  .choice-group {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 6px;
    border-left: 1px solid #555;
  }

  .choice-label {
    color: #ccc;
    font-size: 12px;
    font-weight: 500;
  }

  .choice-select {
    padding: 3px 6px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    min-width: 180px;
  }

  .choice-select:hover {
    border-color: #007acc;
  }

  .choice-select:focus {
    outline: none;
    border-color: #007acc;
  }
</style>
