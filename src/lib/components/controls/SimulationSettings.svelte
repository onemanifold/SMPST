<script lang="ts">
  import {
    maxStepsConfig,
    isPlaying,
  } from '$lib/stores/simulation';

  let showAdvanced = false;

  function handleMaxStepsChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (value >= 100 && value <= 10000) {
      maxStepsConfig.set(value);
    }
  }
</script>

<div class="settings-panel">
  <button
    class="toggle-btn"
    on:click={() => showAdvanced = !showAdvanced}
    title="Toggle advanced settings"
  >
    {showAdvanced ? '▼' : '▶'} Advanced
  </button>

  {#if showAdvanced}
    <div class="settings-content">
      <!-- General Settings -->
      <div class="setting-section">
        <div class="section-title">Simulation</div>

        <div class="setting-item">
          <label for="max-steps">Max Steps:</label>
          <input
            id="max-steps"
            type="number"
            min="100"
            max="10000"
            step="100"
            value={$maxStepsConfig}
            on:change={handleMaxStepsChange}
            disabled={$isPlaying}
            class="number-input"
          />
          <span class="hint">Simulation limit (100-10000)</span>
        </div>
      </div>

      <!-- Info about bisimulation -->
      <div class="setting-section">
        <div class="section-title">Execution Mode</div>
        <p class="info-text">
          The simulator uses <strong>bisimulation</strong> mode, coordinating 
          CFG (global choreography) and CFSM (distributed) execution together.
          This ensures formal correctness while allowing concurrent events to 
          be reordered locally.
        </p>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-panel {
    background: #2d2d2d;
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    margin: 8px;
    overflow: hidden;
  }

  .toggle-btn {
    width: 100%;
    padding: 8px 12px;
    background: #2d2d2d;
    color: #888;
    border: none;
    text-align: left;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .toggle-btn:hover {
    background: #3d3d3d;
    color: #ccc;
  }

  .settings-content {
    padding: 12px;
    background: #252525;
    border-top: 1px solid #3d3d3d;
  }

  .setting-section {
    margin-bottom: 16px;
  }

  .setting-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: #007acc;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #3d3d3d;
  }

  .setting-item {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }

  .setting-item:last-child {
    margin-bottom: 0;
  }

  .setting-item label {
    color: #888;
    font-size: 12px;
    font-weight: 500;
  }

  .number-input {
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.2s;
  }

  .number-input:hover:not(:disabled) {
    background: #4d4d4d;
    border-color: #007acc;
  }

  .number-input:focus {
    outline: none;
    border-color: #007acc;
    background: #4d4d4d;
  }

  .number-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hint {
    grid-column: 2;
    color: #666;
    font-size: 11px;
    font-style: italic;
  }

  .info-text {
    color: #888;
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
  }

  .info-text strong {
    color: #007acc;
  }
</style>
