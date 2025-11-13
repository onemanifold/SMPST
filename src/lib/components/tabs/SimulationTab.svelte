<script lang="ts">
  import CFSMNetwork from '../visualizations/CFSMNetwork.svelte';
  import CFGSequence from '../visualizations/CFGSequence.svelte';

  let activeView: 'cfsm' | 'sequence' = 'cfsm';
</script>

<div class="simulation-tab">
  <div class="view-selector">
    <button
      class="view-btn"
      class:active={activeView === 'cfsm'}
      on:click={() => activeView = 'cfsm'}
    >
      CFSM Network
    </button>
    <button
      class="view-btn"
      class:active={activeView === 'sequence'}
      on:click={() => activeView = 'sequence'}
    >
      CFG Sequence
    </button>
  </div>

  <div class="visualization-container">
    {#if activeView === 'cfsm'}
      <CFSMNetwork />
    {:else}
      <CFGSequence />
    {/if}
  </div>
</div>

<style>
  .simulation-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
  }

  .view-selector {
    display: flex;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
    padding: 8px;
    gap: 8px;
  }

  .view-btn {
    padding: 8px 16px;
    background: transparent;
    color: #ccc;
    border: 1px solid #444;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .view-btn:hover {
    background: #3d3d3d;
    border-color: #666;
  }

  .view-btn.active {
    background: #007acc;
    color: #fff;
    border-color: #007acc;
  }

  .visualization-container {
    flex: 1;
    overflow: hidden;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    text-align: center;
  }

  .placeholder h3 {
    color: #fff;
    margin-bottom: 16px;
  }
</style>
