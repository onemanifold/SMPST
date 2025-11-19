<script lang="ts">
  import {
    bisimulationResult,
    bisimulationTrace,
    executionMode,
    jumpToStep,
  } from '$lib/stores/simulation';
</script>

{#if $executionMode === 'bisimulation' && $bisimulationResult}
  <div class="bisim-results-panel">
    <h4 class="panel-title">Bisimulation Verification</h4>

    {#if $bisimulationResult.equivalent}
      <div class="result success">
        <div class="result-icon">✓</div>
        <div class="result-content">
          <div class="result-header">Behaviorally Equivalent</div>
          <div class="result-description">
            CFG (orchestration) and Distributed (choreography) executions are bisimilar.
            All observable behaviors match.
          </div>
        </div>
      </div>
    {:else}
      <div class="result error">
        <div class="result-icon">✗</div>
        <div class="result-content">
          <div class="result-header">Divergence Detected</div>
          <div class="result-description">
            The two execution models produced different observable behaviors.
          </div>

          {#if $bisimulationResult.divergenceStep !== undefined}
            <div class="divergence-details">
              <div class="detail-item">
                <span class="detail-label">Divergence Step:</span>
                <span class="detail-value">{$bisimulationResult.divergenceStep}</span>
              </div>

              {#if $bisimulationResult.reason}
                <div class="detail-item">
                  <span class="detail-label">Reason:</span>
                  <span class="detail-value">{$bisimulationResult.reason}</span>
                </div>
              {/if}

              {#if $bisimulationTrace}
                <button
                  class="jump-btn"
                  on:click={() => jumpToStep($bisimulationResult.divergenceStep)}
                  title="Navigate to the step where divergence occurred"
                >
                  Jump to Divergence Point
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if $bisimulationTrace && $bisimulationTrace.length > 0}
      <div class="trace-summary">
        <div class="trace-header">Trace Comparison</div>
        <div class="trace-info">
          {$bisimulationTrace.length} step(s) compared
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
    margin-bottom: 12px;
  }

  .divergence-details {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 10px;
    margin-top: 8px;
  }

  .detail-item {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
  }

  .detail-item:last-of-type {
    margin-bottom: 0;
  }

  .detail-label {
    color: #888;
    font-weight: 500;
    min-width: 120px;
  }

  .detail-value {
    color: #fff;
    font-family: monospace;
  }

  .jump-btn {
    margin-top: 12px;
    padding: 6px 12px;
    background: #007acc;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .jump-btn:hover {
    background: #0098ff;
  }

  .trace-summary {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #3d3d3d;
  }

  .trace-header {
    font-size: 12px;
    font-weight: 600;
    color: #888;
    margin-bottom: 4px;
  }

  .trace-info {
    font-size: 12px;
    color: #ccc;
    font-family: monospace;
  }
</style>
