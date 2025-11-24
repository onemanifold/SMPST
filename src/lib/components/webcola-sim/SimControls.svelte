<script lang="ts">
  /**
   * SimControls - Simulation playback controls
   *
   * Controls: Step, Play/Pause, Reset
   * Speed slider
   * Step counter and status
   */
  import { webcolaSimStore, isPlaying, stepCount, isComplete, isDeadlocked } from '$lib/stores/webcola-simulation.store';

  let speed = 500;

  function handleSpeedChange(event: Event) {
    const input = event.target as HTMLInputElement;
    speed = parseInt(input.value);
    webcolaSimStore.setSpeed(speed);
  }

  $: speedLabel = speed < 200 ? 'Fast' : speed < 500 ? 'Normal' : speed < 1000 ? 'Slow' : 'Very Slow';
</script>

<div class="sim-controls">
  <div class="control-buttons">
    <button
      class="control-btn"
      on:click={() => webcolaSimStore.step()}
      disabled={$isComplete || $isDeadlocked}
      title="Step forward (one transition)"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
      </svg>
      Step
    </button>

    <button
      class="control-btn play-btn"
      class:playing={$isPlaying}
      on:click={() => webcolaSimStore.togglePlay()}
      disabled={$isComplete || $isDeadlocked}
      title={$isPlaying ? 'Pause' : 'Play'}
    >
      {#if $isPlaying}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
        Pause
      {:else}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        Play
      {/if}
    </button>

    <button
      class="control-btn reset-btn"
      on:click={() => webcolaSimStore.reset()}
      title="Reset simulation"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
      </svg>
      Reset
    </button>
  </div>

  <div class="speed-control">
    <label>
      <span class="speed-label">Speed: {speedLabel}</span>
      <input
        type="range"
        min="100"
        max="2000"
        step="100"
        value={speed}
        on:input={handleSpeedChange}
      />
    </label>
  </div>

  <div class="status">
    <span class="step-count">Step: {$stepCount}</span>
    {#if $isComplete}
      <span class="status-indicator complete">Complete</span>
    {:else if $isDeadlocked}
      <span class="status-indicator deadlock">Deadlock</span>
    {:else if $isPlaying}
      <span class="status-indicator running">Running</span>
    {:else}
      <span class="status-indicator ready">Ready</span>
    {/if}
  </div>
</div>

<style>
  .sim-controls {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .control-buttons {
    display: flex;
    gap: 8px;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--color-border, #444);
    border-radius: 6px;
    background: var(--color-bg-tertiary, #333);
    color: var(--color-text-primary, #d4d4d4);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:hover:not(:disabled) {
    background: #444;
    border-color: var(--color-accent, #007acc);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .play-btn.playing {
    background: rgba(0, 122, 204, 0.2);
    border-color: var(--color-accent, #007acc);
    color: var(--color-accent, #007acc);
  }

  .speed-control {
    display: flex;
    align-items: center;
  }

  .speed-control label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .speed-label {
    font-size: 11px;
    color: var(--color-text-secondary, #888);
  }

  .speed-control input[type="range"] {
    width: 120px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #444;
    border-radius: 2px;
    cursor: pointer;
  }

  .speed-control input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: var(--color-accent, #007acc);
    border-radius: 50%;
    cursor: pointer;
  }

  .speed-control input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--color-accent, #007acc);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .step-count {
    font-size: 13px;
    color: var(--color-text-secondary, #888);
    font-variant-numeric: tabular-nums;
  }

  .status-indicator {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    font-weight: 500;
  }

  .status-indicator.ready {
    background: rgba(158, 158, 158, 0.2);
    color: #9E9E9E;
  }

  .status-indicator.running {
    background: rgba(0, 122, 204, 0.2);
    color: #64B5F6;
    animation: pulse 1.5s infinite;
  }

  .status-indicator.complete {
    background: rgba(76, 175, 80, 0.2);
    color: #81C784;
  }

  .status-indicator.deadlock {
    background: rgba(244, 67, 54, 0.2);
    color: #EF5350;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
</style>
