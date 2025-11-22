<script lang="ts">
  /**
   * Lazy Editor
   *
   * Wrapper component that lazy loads the Monaco-based GlobalEditor.
   * Shows a loading state while Monaco is being loaded.
   */
  import { onMount } from 'svelte';

  let EditorComponent: typeof import('./GlobalEditor.svelte').default | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      // Dynamically import the editor
      const module = await import('./GlobalEditor.svelte');
      EditorComponent = module.default;
      loading = false;
    } catch (err) {
      console.error('Failed to load editor:', err);
      error = err instanceof Error ? err.message : 'Failed to load editor';
      loading = false;
    }
  });
</script>

<div class="lazy-editor-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading editor...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <span class="error-icon">⚠</span>
      <span>{error}</span>
      <button on:click={() => window.location.reload()}>Reload</button>
    </div>
  {:else if EditorComponent}
    <svelte:component this={EditorComponent} />
  {/if}
</div>

<style>
  .lazy-editor-container {
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
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-bg-tertiary, #2d2d2d);
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
    font-size: 24px;
  }

  .error-state button {
    padding: var(--spacing-2, 8px) var(--spacing-4, 16px);
    background: var(--color-accent, #007acc);
    color: white;
    border: none;
    border-radius: var(--radius-md, 4px);
    cursor: pointer;
    font-size: var(--font-size-sm, 12px);
  }

  .error-state button:hover {
    background: var(--color-accent-hover, #1a8ad4);
  }
</style>
