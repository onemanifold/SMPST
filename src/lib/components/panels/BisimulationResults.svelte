<script lang="ts">
  import {
    bisimulationResult,
    isSimulationActive,
  } from '$lib/stores/simulation';
</script>

{#if $isSimulationActive && $bisimulationResult}
  <div class="bisim-results-panel">
    <h4 class="panel-title">Bisimulation Status</h4>

    {#if $bisimulationResult.valid}
      <div class="result success">
        <div class="result-icon">✓</div>
        <div class="result-content">
          <div class="result-header">Valid Bisimulation</div>
          <div class="result-description">
            CFG (choreography) and CFSM (distributed) executions are coordinated correctly.
            All causal dependencies are satisfied.
          </div>
        </div>
      </div>
    {:else}
      <div class="result error">
        <div class="result-icon">✗</div>
        <div class="result-content">
          <div class="result-header">Bisimulation Error</div>
          <div class="result-description">
            The coordination detected an issue with the execution.
          </div>

          {#if $bisimulationResult.errors && $bisimulationResult.errors.length > 0}
            <div class="error-details">
              {#each $bisimulationResult.errors as error}
                <div class="error-item">{error}</div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .bisim-results-panel {
    background: #2d2d2d;
    border: 1px solid #3d3d3d;
    border-radius: 4px;
    padding: 12px;
    margin: 8px 0;
  }

  .panel-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #ccc;
    border-bottom: 1px solid #3d3d3d;
    padding-bottom: 8px;
  }

  .result {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid;
  }

  .result.success {
    background: rgba(45, 95, 45, 0.2);
    border-color: #2d5f2d;
  }

  .result.error {
    background: rgba(95, 45, 45, 0.2);
    border-color: #5f2d2d;
  }

  .result-icon {
    font-size: 24px;
    line-height: 1;
    flex-shrink: 0;
  }

  .result.success .result-icon {
    color: #90ee90;
  }

  .result.error .result-icon {
    color: #ff6b6b;
  }

  .result-content {
    flex: 1;
  }

  .result-header {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .result.success .result-header {
    color: #90ee90;
  }

  .result.error .result-header {
    color: #ff6b6b;
  }

  .result-description {
    font-size: 12px;
    color: #ccc;
    line-height: 1.5;
  }

  .error-details {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 10px;
    margin-top: 8px;
  }

  .error-item {
    font-size: 12px;
    color: #ff6b6b;
    font-family: monospace;
    margin-bottom: 4px;
  }

  .error-item:last-child {
    margin-bottom: 0;
  }
</style>
