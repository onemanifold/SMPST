<script lang="ts">
  import GlobalEditor from '../editors/GlobalEditor.svelte';
  import LocalProjectionPanel from '../panels/LocalProjectionPanel.svelte';
  import VerificationPanel from '../panels/VerificationPanel.svelte';
  import { outputPanelCollapsed } from '$lib/stores/editor';

  let splitPos = 50; // percentage
</script>

<div class="code-tab">
  <div class="split-container" style="--split-pos: {splitPos}%">
    <div class="left-pane">
      <div class="pane-header">Global Scribble</div>
      <GlobalEditor />
    </div>

    <div class="resize-handle" />

    <div class="right-pane">
      <div class="pane-header">Local Scribble</div>
      <LocalProjectionPanel />
    </div>
  </div>

  <div class="bottom-panel" class:collapsed={$outputPanelCollapsed}>
    <VerificationPanel />
  </div>
</div>

<style>
  .code-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
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
    position: relative;
  }

  .right-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .pane-header {
    position: absolute;
    top: 0;
    right: 0;
    padding: 4px 12px;
    background: rgba(45, 45, 45, 0.5);
    border-bottom-left-radius: 4px;
    font-weight: 500;
    color: #ccc;
    font-size: 11px;
    z-index: 10;
    backdrop-filter: blur(4px);
    width: auto;
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

  .bottom-panel {
    height: 200px;
    border-top: 1px solid #333;
    background: #1e1e1e;
    transition: height 0.3s ease;
    overflow: hidden;
  }

  .bottom-panel.collapsed {
    height: 40px;
  }
</style>
