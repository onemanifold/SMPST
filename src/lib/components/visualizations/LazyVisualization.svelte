<script lang="ts">
  /**
   * Lazy Visualization
   *
   * Wrapper component that lazy loads D3 visualization components.
   * Shows a loading state while the component is being loaded.
   */
  import { onMount } from 'svelte';
  import type { SvelteComponent } from 'svelte';

  /**
   * Which visualization to load
   */
  export let type: 'cfsm-network' | 'cfg-sequence';

  /**
   * Props to pass to the visualization component
   */
  export let props: Record<string, any> = {};

  let Component: typeof SvelteComponent | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      if (type === 'cfsm-network') {
        const module = await import('./CFSMNetwork.svelte');
        Component = module.default;
      } else if (type === 'cfg-sequence') {
        const module = await import('./CFGSequence.svelte');
        Component = module.default;
      }
      loading = false;
    } catch (err) {
      console.error(`Failed to load ${type} visualization:`, err);
      error = err instanceof Error ? err.message : 'Failed to load visualization';
      loading = false;
    }
  });
</script>

<div class="lazy-vis-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading visualization...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <span class="error-icon">⚠</span>
      <span>{error}</span>
    </div>
  {:else if Component}
    <svelte:component this={Component} {...props} />
  {/if}
</div>

<style>
  .lazy-vis-container {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  .loading-state,
  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-3, 12px);
    background: var(--color-bg-primary, #1e1e1e);
    color: var(--color-text-secondary, #9d9d9d);
    font-size: var(--font-size-sm, 12px);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--color-bg-tertiary, #2d2d2d);
    border-top-color: var(--color-accent, #007acc);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    color: var(--color-error, #f14c4c);
  }

  .error-icon {
    font-size: 20px;
  }
</style>
