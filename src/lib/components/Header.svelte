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
    padding: 12px 24px;
    background: #1e1e1e;
    border-bottom: 1px solid #333;
    color: #fff;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
  }

  .logo-icon {
    font-size: 24px;
  }

  .status {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .status-indicator {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    background: #333;
  }

  .status-indicator.success {
    background: #2d5f2d;
    color: #90ee90;
  }

  .status-indicator.error {
    background: #5f2d2d;
    color: #ff6b6b;
  }

  .verification-status {
    display: flex;
    gap: 12px;
    font-size: 13px;
  }

  .verification-status span {
    color: #ff6b6b;
  }

  .verification-status span.success {
    color: #90ee90;
  }
</style>
