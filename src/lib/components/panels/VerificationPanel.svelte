<script lang="ts">
  import { verificationResult, parseError, outputPanelCollapsed } from '$lib/stores/editor';
  import { Button } from '$lib/components/atoms';

  function togglePanel() {
    outputPanelCollapsed.update(v => !v);
  }
</script>

<div class="verification-panel">
  <div class="panel-header">
    <h3>Verification Results</h3>
    <Button variant="ghost" size="sm" on:click={togglePanel}>
      {$outputPanelCollapsed ? '▲' : '▼'}
    </Button>
  </div>

  {#if !$outputPanelCollapsed}
    <div class="panel-content">
      {#if $parseError}
      <div class="error-section">
        <h4>Parse Error{#if $parseError.location} (Line {$parseError.location.line}, Column {$parseError.location.column}){/if}</h4>
        <pre class="error-message">{$parseError.message}</pre>
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
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-header h3 {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-medium);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-4);
  }

  .result-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--color-error);
  }

  .result-item.success {
    color: var(--color-success);
  }

  .icon {
    font-weight: var(--font-weight-bold);
  }

  .error-list, .warning-list {
    margin-top: var(--spacing-4);
  }

  .error-list h4, .warning-list h4 {
    margin: 0 0 var(--spacing-2) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
  }

  .error-item {
    padding: var(--spacing-1) var(--spacing-3);
    margin-bottom: var(--spacing-1);
    background: var(--color-error-bg);
    color: var(--color-error);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
  }

  .warning-item {
    padding: var(--spacing-1) var(--spacing-3);
    margin-bottom: var(--spacing-1);
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
  }

  .placeholder {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .error-message {
    color: var(--color-error);
    background: var(--color-error-bg);
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    overflow-x: auto;
    font-size: var(--font-size-base);
    line-height: var(--line-height-normal);
  }
</style>
