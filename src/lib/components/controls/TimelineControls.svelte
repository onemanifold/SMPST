<script lang="ts">
  import {
    canStepBack,
    canStepForward,
    currentStepNumber,
    totalStepCount,
    stepBack,
    stepForward,
    jumpToStep,
    isPlaying,
  } from '$lib/stores/simulation';

  let sliderValue = 0;

  // Sync slider with current step
  $: sliderValue = $currentStepNumber;

  function handleSliderChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const stepNumber = parseInt(target.value, 10);
    jumpToStep(stepNumber);
  }

  function handleStepBack() {
    stepBack();
  }

  function handleStepForward() {
    stepForward();
  }
</script>

{#if $totalStepCount > 0}
  <div class="timeline-controls">
    <button
      class="timeline-btn"
      on:click={handleStepBack}
      disabled={!$canStepBack || $isPlaying}
      title="Step backward"
    >
      ⏪
    </button>

    <div class="timeline-slider-container">
      <input
        type="range"
        min="0"
        max={$totalStepCount}
        step="1"
        value={sliderValue}
        on:input={handleSliderChange}
        disabled={$isPlaying}
        class="timeline-slider"
        title="Jump to step {sliderValue}"
      />
      <div class="timeline-label">
        Step {$currentStepNumber} / {$totalStepCount}
      </div>
    </div>

    <button
      class="timeline-btn"
      on:click={handleStepForward}
      disabled={!$canStepForward || $isPlaying}
      title="Step forward"
    >
      ⏩
    </button>
  </div>
{/if}

<style>
  .timeline-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 6px;
    border-left: 1px solid #555;
  }

  .timeline-btn {
    width: 28px;
    height: 28px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .timeline-btn:hover:not(:disabled) {
    background: #4d4d4d;
    border-color: #9d4aff;
  }

  .timeline-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .timeline-slider-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 150px;
  }

  .timeline-slider {
    width: 100%;
    height: 4px;
    background: #3d3d3d;
    border-radius: 2px;
    outline: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  .timeline-slider:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .timeline-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    background: #9d4aff;
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;
  }

  .timeline-slider::-webkit-slider-thumb:hover {
    background: #b366ff;
  }

  .timeline-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: #9d4aff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;
  }

  .timeline-slider::-moz-range-thumb:hover {
    background: #b366ff;
  }

  .timeline-label {
    color: #ccc;
    font-size: 10px;
    font-family: monospace;
    text-align: center;
    white-space: nowrap;
  }
</style>
