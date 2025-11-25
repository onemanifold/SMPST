<script lang="ts">
  import { parseStatus, verificationResult } from '$lib/stores/editor';
</script>

<header class="header">
  <div class="logo">
    <span class="logo-icon">🔄</span>
    <span class="logo-text">Scribble MPST IDE</span>
  </div>

  <div class="status">
    <div class="status-indicator" class:success={$parseStatus === 'success'}
         class:error={$parseStatus === 'error'}>
      {#if $parseStatus === 'success'}
        ✓ Protocol Valid
      {:else if $parseStatus === 'error'}
        ✗ Parse Error
      {:else}
        ○ Ready
      {/if}
    </div>

    {#if $verificationResult}
      <div class="verification-status">
        <span class:success={$verificationResult.deadlockFree}>
          Deadlock: {$verificationResult.deadlockFree ? '✓' : '✗'}
        </span>
        <span class:success={$verificationResult.livenessSatisfied}>
          Liveness: {$verificationResult.livenessSatisfied ? '✓' : '✗'}
        </span>
      </div>
    {/if}
  </div>
</header>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3) var(--spacing-6);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
  }

  .logo-icon {
    font-size: var(--font-size-3xl);
  }

  .status {
    display: flex;
    gap: var(--spacing-4);
    align-items: center;
  }

  .status-indicator {
    padding: var(--spacing-1) var(--spacing-3);
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
    background: var(--color-bg-tertiary);
  }

  .status-indicator.success {
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  .status-indicator.error {
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  .verification-status {
    display: flex;
    gap: var(--spacing-3);
    font-size: var(--font-size-base);
  }

  .verification-status span {
    color: var(--color-error);
  }

  .verification-status span.success {
    color: var(--color-success);
  }
</style>
