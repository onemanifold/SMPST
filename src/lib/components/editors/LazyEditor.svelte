<script lang="ts">
  /**
   * Lazy Editor
   *
   * In headless environments: immediately uses textarea (no Monaco attempt)
   * In normal environments: lazy loads Monaco Editor
   */
  import { onMount } from 'svelte';
  import { editorContent, parseProtocol } from '$lib/stores/editor';

  let EditorComponent: typeof import('./GlobalEditor.svelte').default | null = null;
  let loading = true;
  let error: string | null = null;
  let useTextareaFallback = false;

  /**
   * Detect if running in headless environment - check BEFORE any Monaco loading
   */
  function isHeadlessEnvironment(): boolean {
    if (typeof window === 'undefined') return true;

    return (
      navigator.webdriver === true ||
      /HeadlessChrome/.test(navigator.userAgent) ||
      /PhantomJS/.test(navigator.userAgent)
    );
  }

  // Check headless immediately on script load (before onMount)
  const headless = typeof window !== 'undefined' && isHeadlessEnvironment();

  onMount(async () => {
    // If headless, use textarea immediately - DO NOT load Monaco
    if (headless) {
      console.log('[LazyEditor] Headless detected, using textarea (Monaco not loaded)');
      useTextareaFallback = true;
      loading = false;
      return;
    }

    // Normal environment - load Monaco
    try {
      const module = await import('./GlobalEditor.svelte');
      EditorComponent = module.default;
      loading = false;
    } catch (err) {
      console.error('Failed to load Monaco:', err);
      useTextareaFallback = true;
      loading = false;
    }
  });

  // Handle textarea changes
  function handleTextareaInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    editorContent.set(textarea.value);
  }

  // Handle parse on Ctrl+Enter
  function handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === 'Enter') {
      parseProtocol($editorContent);
    }
  }
</script>

<div class="lazy-editor-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading editor...</span>
    </div>
  {:else if useTextareaFallback}
    <!-- Fallback textarea for headless/constrained environments -->
    <div class="fallback-editor">
      <textarea
        class="fallback-textarea"
        value={$editorContent}
        on:input={handleTextareaInput}
        on:keydown={handleKeydown}
        placeholder="Enter Scribble protocol... (Ctrl+Enter to parse)"
        spellcheck="false"
      ></textarea>
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

  /* Fallback textarea styles */
  .fallback-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary, #1e1e1e);
  }

  .fallback-textarea {
    flex: 1;
    width: 100%;
    padding: var(--spacing-3, 12px);
    background: var(--color-bg-secondary, #252526);
    color: var(--color-text-primary, #cccccc);
    border: none;
    outline: none;
    resize: none;
    font-family: var(--font-family-mono, 'Consolas', 'Monaco', monospace);
    font-size: var(--font-size-base, 14px);
    line-height: 1.5;
  }

  .fallback-textarea::placeholder {
    color: var(--color-text-muted, #6e6e6e);
  }

  .fallback-textarea:focus {
    box-shadow: inset 0 0 0 1px var(--color-accent, #007acc);
  }
</style>
