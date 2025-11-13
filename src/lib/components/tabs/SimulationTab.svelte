<script lang="ts">
  import CFSMNetwork from '../visualizations/CFSMNetwork.svelte';
  import CFGSequence from '../visualizations/CFGSequence.svelte';

  let splitPos = 50; // percentage
</script>

<div class="simulation-tab">
  <div class="split-container" style="--split-pos: {splitPos}%">
    <div class="left-pane">
      <div class="pane-header">CFSM Network</div>
      <CFSMNetwork />
    </div>

    <div class="resize-handle" />

    <div class="right-pane">
      <div class="pane-header">CFG Sequence</div>
      <CFGSequence />
    </div>
  </div>
</div>

<style>
  .simulation-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
  }

  .split-container {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-pane {
    width: var(--split-pos);
    display: flex;
    flex-direction: column;
    border-right: 1px solid #333;
  }

  .right-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .pane-header {
    padding: 4px 12px;
    background: rgba(45, 45, 45, 0.5);
    border-bottom: 1px solid #1e1e1e;
    font-weight: 500;
    color: #ccc;
    font-size: 11px;
    width: 100%;
    box-sizing: border-box;
  }

  .resize-handle {
    width: 4px;
    background: #1e1e1e;
    cursor: col-resize;
    transition: background 0.2s;
  }

  .resize-handle:hover {
    background: #007acc;
  }
</style>
