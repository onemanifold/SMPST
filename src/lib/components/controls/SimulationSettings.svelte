<script lang="ts">
  import {
    executionMode,
    maxStepsConfig,
    schedulingStrategy,
    deliveryModel,
    switchExecutionMode,
    isPlaying,
    type SchedulingStrategy,
    type DeliveryModel,
  } from '$lib/stores/simulation';

  let showAdvanced = false;

  async function handleMaxStepsChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (value >= 100 && value <= 10000) {
      maxStepsConfig.set(value);
      // Re-initialize to apply new setting
      await switchExecutionMode($executionMode);
    }
  }

  async function handleSchedulingChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    schedulingStrategy.set(target.value as SchedulingStrategy);
    // Re-initialize to apply new setting
    if ($executionMode === 'distributed' || $executionMode === 'bisimulation') {
      await switchExecutionMode($executionMode);
    }
  }

  async function handleDeliveryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    deliveryModel.set(target.value as DeliveryModel);
    // Re-initialize to apply new setting
    if ($executionMode === 'distributed' || $executionMode === 'bisimulation') {
      await switchExecutionMode($executionMode);
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
        <div class="section-title">General</div>

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

      <!-- Distributed Mode Settings -->
      {#if $executionMode === 'distributed' || $executionMode === 'bisimulation'}
        <div class="setting-section">
          <div class="section-title">Distributed Execution</div>

          <div class="setting-item">
            <label for="scheduling">Scheduling:</label>
            <select
              id="scheduling"
              value={$schedulingStrategy}
              on:change={handleSchedulingChange}
              disabled={$isPlaying}
              class="select-input"
            >
              <option value="manual">Manual</option>
              <option value="round-robin">Round Robin</option>
              <option value="fair">Fair</option>
              <option value="random">Random</option>
            </select>
            <span class="hint">Process scheduling strategy</span>
          </div>

          <div class="setting-item">
            <label for="delivery">Delivery Model:</label>
            <select
              id="delivery"
              value={$deliveryModel}
              on:change={handleDeliveryChange}
              disabled={$isPlaying}
              class="select-input"
            >
              <option value="FIFO">FIFO (Ordered)</option>
              <option value="unordered">Unordered</option>
              <option value="lossy">Lossy (Unreliable)</option>
            </select>
            <span class="hint">Message delivery guarantees</span>
          </div>
        </div>
      {/if}
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

  .number-input,
  .select-input {
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    font-family: inherit;
    transition: all 0.2s;
  }

  .number-input:hover:not(:disabled),
  .select-input:hover:not(:disabled) {
    background: #4d4d4d;
    border-color: #007acc;
  }

  .number-input:focus,
  .select-input:focus {
    outline: none;
    border-color: #007acc;
    background: #4d4d4d;
  }

  .number-input:disabled,
  .select-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hint {
    grid-column: 2;
    color: #666;
    font-size: 11px;
    font-style: italic;
  }
</style>
