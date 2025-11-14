<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import * as monaco from 'monaco-editor';

  let selectedRole = '';
  let editorContainer: HTMLDivElement;
  let editor: monaco.editor.IStandaloneCodeEditor | null = null;

  // Auto-select first role when projection data updates
  $: if ($projectionData.length > 0 && !selectedRole) {
    selectedRole = $projectionData[0].role;
  }

  // Get serialized local protocol from projection data
  $: currentProjection = $projectionData.find(p => p.role === selectedRole);
  $: localScribble = currentProjection?.localProtocol || '';

  // Update editor content when selected role changes
  $: if (editor && localScribble !== editor.getValue()) {
    editor.setValue(localScribble);
  }

  onMount(() => {
    if (!editorContainer) return;

    // Create read-only Monaco editor
    editor = monaco.editor.create(editorContainer, {
      value: localScribble,
      language: 'scribble',
      theme: 'scribble-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      readOnly: true,
      domReadOnly: true,
      contextmenu: false,
      folding: false,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
    });
  });

  onDestroy(() => {
    editor?.dispose();
  });
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
      <div class="editor-container" bind:this={editorContainer}></div>
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
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .editor-container {
    flex: 1;
    overflow: hidden;
  }
</style>
