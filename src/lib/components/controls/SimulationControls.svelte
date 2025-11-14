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

    {#if $isAtChoice}
      <div class="choice-group" class:auto-selecting={$isPlaying}>
        <span class="choice-label">
          {$isPlaying ? '⚡ Auto-selecting:' : 'Choose branch:'}
        </span>
        <div class="choice-buttons">
          {#each $availableChoices as choice, index}
            <button
              class="choice-btn"
              class:selected={selectedChoice === index}
              class:auto-selected={$isPlaying && selectedChoice === index}
              on:click={() => {
                if (!$isPlaying) {
                  selectedChoice = index;
                }
              }}
              disabled={$isPlaying}
              title={choice.description || `Branch ${index + 1}`}
            >
              {choice.label || `Branch ${index + 1}`}
            </button>
          {/each}
        </div>
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
    transition: background-color 0.3s;
  }

  .choice-group.auto-selecting {
    background: rgba(45, 77, 127, 0.2);
    border-left-color: #66b3ff;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .choice-label {
    color: #ccc;
    font-size: 12px;
    font-weight: 500;
  }

  .choice-group.auto-selecting .choice-label {
    color: #66b3ff;
  }

  .choice-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .choice-btn {
    padding: 4px 10px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .choice-btn:hover:not(:disabled) {
    background: #4d4d4d;
    border-color: #007acc;
  }

  .choice-btn:disabled {
    cursor: not-allowed;
  }

  .choice-btn.selected {
    background: #007acc;
    border-color: #007acc;
    color: #fff;
  }

  .choice-btn.auto-selected {
    background: #66b3ff;
    border-color: #66b3ff;
    color: #fff;
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
