<script lang="ts">
  /**
   * WebCola Simulation Page
   *
   * A dedicated page for visualizing CFSM simulation using WebCola
   * force-directed graph layout. Each role is a node, and links
   * represent message buffers between roles.
   */
  import { onMount, onDestroy } from 'svelte';
  import { appStore } from '$lib/stores/app.store';
  import { webcolaSimStore } from '$lib/stores/webcola-simulation.store';
  import WebColaGraph from '$lib/components/webcola-sim/WebColaGraph.svelte';
  import SimControls from '$lib/components/webcola-sim/SimControls.svelte';
  import { protocolExamples } from '$lib/data/examples';

  // Default protocol to load
  let selectedProtocolId = 'three-buyer-extended';
  let isLoading = true;
  let loadError: string | null = null;

  // Get available protocols (filter to ones that work well for visualization)
  const visualizableProtocols = protocolExamples.filter(p =>
    ['Basic', 'Classic', 'Advanced', 'Less is More'].includes(p.category)
  );

  /**
   * Load and parse a protocol, initialize the simulation
   */
  async function loadProtocol(protocolId: string) {
    isLoading = true;
    loadError = null;

    try {
      const example = protocolExamples.find(p => p.id === protocolId);
      if (!example) {
        throw new Error(`Protocol not found: ${protocolId}`);
      }

      // Dynamic imports for parsing pipeline
      const { parse } = await import('../../core/parser/parser');
      const { buildCFG } = await import('../../core/cfg/builder');
      const { projectAll } = await import('../../core/projection/projector');

      // 1. Parse the protocol
      const ast = parse(example.code);
      if (!ast || ast.type !== 'Module') {
        throw new Error('Failed to parse protocol');
      }

      if (!ast.declarations || ast.declarations.length === 0) {
        throw new Error('No protocol declarations found');
      }

      const protocol = ast.declarations[0];
      if (protocol.type !== 'GlobalProtocolDeclaration') {
        throw new Error('Expected global protocol declaration');
      }

      // 2. Build CFG
      const cfg = buildCFG(protocol);

      // 3. Project to CFSMs
      const projectionResult = projectAll(cfg);

      if (projectionResult.errors.length > 0) {
        console.warn('Projection warnings:', projectionResult.errors);
      }

      // 4. Initialize simulation store
      webcolaSimStore.initialize(
        projectionResult.cfsms,
        example.name,
        example.code
      );

      isLoading = false;
    } catch (err) {
      console.error('Failed to load protocol:', err);
      loadError = err instanceof Error ? err.message : 'Unknown error';
      isLoading = false;
    }
  }

  // Handle protocol selection change
  function handleProtocolChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedProtocolId = select.value;
    loadProtocol(selectedProtocolId);
  }

  onMount(() => {
    appStore.setRoute('/webcola-sim');
    loadProtocol(selectedProtocolId);
  });

  onDestroy(() => {
    webcolaSimStore.reset();
  });

  // Reactive state from store
  $: state = $webcolaSimStore;
</script>

<div class="webcola-sim-page">
  <header class="page-header">
    <div class="header-left">
      <h1>WebCola Simulation</h1>
      <span class="subtitle">CFSM Network Visualization</span>
    </div>
    <div class="header-right">
      <label class="protocol-select">
        <span>Protocol:</span>
        <select value={selectedProtocolId} on:change={handleProtocolChange}>
          {#each visualizableProtocols as protocol}
            <option value={protocol.id}>{protocol.name}</option>
          {/each}
        </select>
      </label>
    </div>
  </header>

  <main class="main-content">
    {#if isLoading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading protocol...</p>
      </div>
    {:else if loadError}
      <div class="error">
        <h3>Failed to load protocol</h3>
        <p>{loadError}</p>
        <button on:click={() => loadProtocol(selectedProtocolId)}>Retry</button>
      </div>
    {:else}
      <div class="graph-container">
        <WebColaGraph />
      </div>
    {/if}
  </main>

  <footer class="controls-footer">
    <SimControls />
    <div class="event-log">
      <h4>Event Log ({state.events.length})</h4>
      <div class="events">
        {#each state.events.slice(-5).reverse() as event}
          <div class="event" class:send={event.type === 'send'} class:receive={event.type === 'receive'}>
            <span class="event-step">#{state.events.indexOf(event) + 1}</span>
            <span class="event-details">{event.details}</span>
          </div>
        {/each}
        {#if state.events.length === 0}
          <div class="no-events">No events yet. Click Step or Play to start.</div>
        {/if}
      </div>
    </div>
  </footer>
</div>

<style>
  .webcola-sim-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-primary, #1e1e1e);
    color: var(--color-text-primary, #d4d4d4);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: var(--color-bg-secondary, #252526);
    border-bottom: 1px solid var(--color-border, #3c3c3c);
  }

  .header-left h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary, #fff);
  }

  .header-left .subtitle {
    font-size: 12px;
    color: var(--color-text-secondary, #888);
    margin-left: 12px;
  }

  .protocol-select {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .protocol-select span {
    font-size: 13px;
    color: var(--color-text-secondary, #888);
  }

  .protocol-select select {
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid var(--color-border, #3c3c3c);
    background: var(--color-bg-tertiary, #333);
    color: var(--color-text-primary, #d4d4d4);
    font-size: 13px;
    cursor: pointer;
  }

  .protocol-select select:hover {
    border-color: var(--color-accent, #007acc);
  }

  .main-content {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .graph-container {
    width: 100%;
    height: 100%;
  }

  .loading, .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border, #3c3c3c);
    border-top-color: var(--color-accent, #007acc);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error {
    color: #f48771;
  }

  .error button {
    padding: 8px 16px;
    background: var(--color-accent, #007acc);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .controls-footer {
    display: flex;
    gap: 20px;
    padding: 12px 20px;
    background: var(--color-bg-secondary, #252526);
    border-top: 1px solid var(--color-border, #3c3c3c);
  }

  .event-log {
    flex: 1;
    min-width: 0;
  }

  .event-log h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--color-text-secondary, #888);
    text-transform: uppercase;
  }

  .events {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .event {
    display: flex;
    gap: 6px;
    padding: 4px 8px;
    background: var(--color-bg-tertiary, #333);
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
  }

  .event.send {
    border-left: 2px solid #4FC3F7;
  }

  .event.receive {
    border-left: 2px solid #81C784;
  }

  .event-step {
    color: var(--color-text-secondary, #888);
  }

  .no-events {
    color: var(--color-text-secondary, #666);
    font-size: 12px;
    font-style: italic;
  }
</style>
