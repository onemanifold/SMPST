<script lang="ts">
  import { verificationResult, parseError, outputPanelCollapsed } from '$lib/stores/editor';

  function togglePanel() {
    outputPanelCollapsed.update(v => !v);
  }
</script>

<div class="verification-panel">
  <div class="panel-header">
    <h3>Verification Results</h3>
    <button class="btn-collapse" on:click={togglePanel}>
      {$outputPanelCollapsed ? '▲' : '▼'}
    </button>
  </div>

  {#if !$outputPanelCollapsed}
    <div class="panel-content">
      {#if $parseError}
      <div class="error-section">
        <h4>Parse Error</h4>
        <pre class="error-message">{$parseError}</pre>
      </div>
    {:else if $verificationResult}
      <div class="result-section">
        <div class="result-item" class:success={$verificationResult.deadlockFree}>
          <span class="icon">{$verificationResult.deadlockFree ? '✓' : '✗'}</span>
          <span>Deadlock Free: {$verificationResult.deadlockFree ? 'Yes' : 'No'}</span>
        </div>
        <div class="result-item" class:success={$verificationResult.livenessSatisfied}>
          <span class="icon">{$verificationResult.livenessSatisfied ? '✓' : '✗'}</span>
          <span>Liveness: {$verificationResult.livenessSatisfied ? 'Satisfied' : 'Violated'}</span>
        </div>
        <div class="result-item" class:success={$verificationResult.safetySatisfied}>
          <span class="icon">{$verificationResult.safetySatisfied ? '✓' : '✗'}</span>
          <span>Safety: {$verificationResult.safetySatisfied ? 'Satisfied' : 'Violated'}</span>
        </div>
      </div>

      {#if $verificationResult.errors.length > 0}
        <div class="error-list">
          <h4>Errors</h4>
          {#each $verificationResult.errors as error}
            <div class="error-item">✗ {error}</div>
          {/each}
        </div>
      {/if}

      {#if $verificationResult.warnings.length > 0}
        <div class="warning-list">
          <h4>Warnings</h4>
          {#each $verificationResult.warnings as warning}
            <div class="warning-item">⚠ {warning}</div>
          {/each}
        </div>
      {/if}
    {:else}
      <p class="placeholder">Parse a protocol to see verification results</p>
    {/if}
    </div>
  {/if}
</div>

<style>
  .verification-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
    color: #ccc;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #2d2d2d;
    border-bottom: 1px solid #333;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
  }

  .btn-collapse {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    padding: 4px;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .result-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ff6b6b;
  }

  .result-item.success {
    color: #90ee90;
  }

  .icon {
    font-weight: bold;
  }

  .error-list, .warning-list {
    margin-top: 16px;
  }

  .error-list h4, .warning-list h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 500;
  }

  .error-item {
    padding: 6px 12px;
    margin-bottom: 4px;
    background: #5f2d2d;
    color: #ff6b6b;
    border-radius: 4px;
    font-size: 13px;
  }

  .warning-item {
    padding: 6px 12px;
    margin-bottom: 4px;
    background: #5f5f2d;
    color: #ffeb3b;
    border-radius: 4px;
    font-size: 13px;
  }

  .placeholder {
    color: #666;
    font-style: italic;
  }

  .error-message {
    color: #ff6b6b;
    background: #2d1e1e;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
  }
</style>
