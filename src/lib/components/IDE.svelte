<script lang="ts">
  import CodeTab from './tabs/CodeTab.svelte';
  import SimulationTab from './tabs/SimulationTab.svelte';
  import Header from './Header.svelte';

  let currentTab: 'code' | 'simulation' = 'code';
</script>

<div class="ide-container">
  <Header />

  <nav class="tab-bar">
    <button
      class="tab"
      class:active={currentTab === 'code'}
      on:click={() => currentTab = 'code'}
    >
      CODE
    </button>
    <button
      class="tab"
      class:active={currentTab === 'simulation'}
      on:click={() => currentTab = 'simulation'}
    >
      SIMULATION
    </button>
  </nav>

  <main class="tab-content">
    {#if currentTab === 'code'}
      <CodeTab />
    {:else}
      <SimulationTab />
    {/if}
  </main>
</div>

<style>
  .ide-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
  }

  .tab {
    padding: 12px 24px;
    background: transparent;
    color: #ccc;
    border: none;
    cursor: pointer;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab:hover {
    background: #3d3d3d;
  }

  .tab.active {
    color: #fff;
    border-bottom-color: #007acc;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
  }
</style>
