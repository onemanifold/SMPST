<script lang="ts">
  import { projectionData, parseStatus } from '$lib/stores/editor';

  let selectedRole = '';

  // Auto-select first role when projection data updates
  $: if ($projectionData.length > 0 && !selectedRole) {
    selectedRole = $projectionData[0].role;
  }

  // Get serialized local protocol from projection data
  $: currentProjection = $projectionData.find(p => p.role === selectedRole);
  $: localScribble = currentProjection?.localProtocol || '';
</script>

<div class="local-projection-panel">
  {#if $parseStatus !== 'success' || $projectionData.length === 0}
    <div class="placeholder">
      <p>Parse a protocol to see local projections</p>
    </div>
  {:else}
    <div class="role-tabs">
      {#each $projectionData as projection}
        <button
          class="role-tab"
          class:active={selectedRole === projection.role}
          on:click={() => selectedRole = projection.role}
        >
          {projection.role}
        </button>
      {/each}
    </div>

    <div class="projection-content">
      <pre class="scribble-code">{localScribble}</pre>
    </div>
  {/if}
</div>

<style>
  .local-projection-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    color: #ccc;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-style: italic;
  }

  .role-tabs {
    display: flex;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
    overflow-x: auto;
  }

  .role-tab {
    padding: 8px 16px;
    background: transparent;
    color: #ccc;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .role-tab:hover {
    background: #3d3d3d;
  }

  .role-tab.active {
    color: #fff;
    border-bottom-color: #4EC9B0;
  }

  .projection-content {
    flex: 1;
    overflow: auto;
    padding: 16px;
  }

  .scribble-code {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #d4d4d4;
    margin: 0;
  }
</style>
