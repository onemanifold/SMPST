<script lang="ts">
  /**
   * Simulation Page
   *
   * Protocol execution and debugging view with:
   * - Simulation controls (step, play, reset)
   * - Execution mode selector (CFG, Distributed, Bisimulation)
   * - Event log
   * - CFSM state visualization
   * - Time-travel debugging
   */
  import SimulationTab from '$lib/components/tabs/SimulationTab.svelte';
  import { appStore, currentRoute } from '$lib/stores/app.store';
  import { parseStatus } from '$lib/stores/editor';
  import { onMount } from 'svelte';

  // Check if we have a parsed protocol
  let hasProtocol = false;

  $: hasProtocol = $parseStatus === 'success';

  onMount(() => {
    // Redirect to editor if no protocol loaded
    if (!hasProtocol) {
      appStore.navigateTo('/');
    }
  });

  // Watch for protocol changes - redirect if protocol is lost
  $: if (!hasProtocol && $currentRoute.startsWith('/simulation')) {
    appStore.navigateTo('/');
  }
</script>

<div class="simulation-page">
  {#if hasProtocol}
    <SimulationTab />
  {:else}
    <div class="no-protocol">
      <div class="message">
        <h2>No Protocol Loaded</h2>
        <p>Parse a protocol in the Editor before starting simulation.</p>
        <button class="go-to-editor" on:click={() => appStore.navigateTo('/')}>
          Go to Editor
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .simulation-page {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .no-protocol {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary, #1e1e1e);
    color: var(--color-text-secondary, #9d9d9d);
  }

  .message {
    text-align: center;
    padding: var(--spacing-8, 32px);
  }

  .message h2 {
    margin: 0 0 var(--spacing-4, 16px);
    color: var(--color-text-primary, #ccc);
    font-size: var(--font-size-xl, 18px);
  }

  .message p {
    margin: 0 0 var(--spacing-6, 24px);
    font-size: var(--font-size-base, 13px);
  }

  .go-to-editor {
    padding: var(--spacing-2, 8px) var(--spacing-4, 16px);
    background: var(--color-accent, #007acc);
    color: white;
    border: none;
    border-radius: var(--radius-md, 4px);
    cursor: pointer;
    font-size: var(--font-size-base, 13px);
    transition: background var(--transition-fast, 100ms);
  }

  .go-to-editor:hover {
    background: var(--color-accent-hover, #1a8ad4);
  }
</style>
