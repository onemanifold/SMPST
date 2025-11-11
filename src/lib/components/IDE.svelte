<script lang="ts">
  import Header from './Header.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import Visualizer from './Visualizer.svelte';
  import OutputPanel from './OutputPanel.svelte';
  import { viewMode, projectionData, outputPanelCollapsed } from '../stores/editor';

  let editorWidth = 45; // percentage
  let outputHeight = 30; // percentage

  $: effectiveOutputHeight = $outputPanelCollapsed ? 'auto' : `${outputHeight}%`;
  let isDraggingHorizontal = false;
  let isDraggingVertical = false;

  $: roles = $projectionData.map(p => p.role);

  function selectView(view: string) {
    viewMode.set(view);
  }

  function handleHorizontalDragStart() {
    isDraggingHorizontal = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleVerticalDragStart() {
    isDraggingVertical = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDraggingHorizontal) {
      const container = document.querySelector('.main-content');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
        editorWidth = Math.max(20, Math.min(80, newWidth));
      }
    }
    if (isDraggingVertical) {
      const container = document.querySelector('.workspace');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newHeight = ((rect.bottom - e.clientY) / rect.height) * 100;
        outputHeight = Math.max(20, Math.min(60, newHeight));
      }
    }
  }

  function handleMouseUp() {
    isDraggingHorizontal = false;
    isDraggingVertical = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div class="ide">
  <Header />

  <div class="main-content">
    <div class="workspace">
      <div class="workspace-tabs">
        <button
          class="workspace-tab"
          class:active={$viewMode === 'global'}
          on:click={() => selectView('global')}
        >
          Global Protocol
        </button>
        {#each roles as role}
          <button
            class="workspace-tab"
            class:active={$viewMode === role}
            on:click={() => selectView(role)}
          >
            {role}
          </button>
        {/each}
      </div>

      <div class="top-section">
        <div class="editor-section" style="width: {editorWidth}%">
          <CodeEditor />
        </div>

        <div
          class="horizontal-resizer"
          on:mousedown={handleHorizontalDragStart}
          role="separator"
          aria-orientation="vertical"
        ></div>

        <div class="visualizer-section" style="width: {100 - editorWidth}%">
          <Visualizer />
        </div>
      </div>

      <div
        class="vertical-resizer"
        on:mousedown={handleVerticalDragStart}
        role="separator"
        aria-orientation="horizontal"
      ></div>

      <div class="bottom-section" style="height: {effectiveOutputHeight}">
        <OutputPanel />
      </div>
    </div>
  </div>
</div>

<style>
  .ide {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    overflow: hidden;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  .workspace-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem 0;
    background: #1f2937;
    border-bottom: 1px solid #374151;
  }

  .workspace-tab {
    padding: 0.5rem 1.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #9ca3af;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .workspace-tab:hover {
    color: #d1d5db;
  }

  .workspace-tab.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .top-section {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .editor-section {
    min-width: 200px;
    overflow: hidden;
  }

  .visualizer-section {
    min-width: 200px;
    overflow: hidden;
  }

  .bottom-section {
    min-height: 150px;
    overflow: hidden;
  }

  .horizontal-resizer {
    width: 4px;
    background: #374151;
    cursor: col-resize;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .horizontal-resizer:hover,
  .horizontal-resizer:focus {
    background: #667eea;
    outline: none;
  }

  .vertical-resizer {
    height: 4px;
    background: #374151;
    cursor: row-resize;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .vertical-resizer:hover,
  .vertical-resizer:focus {
    background: #667eea;
    outline: none;
  }
</style>
