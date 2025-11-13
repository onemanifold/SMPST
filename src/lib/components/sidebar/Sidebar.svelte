<script lang="ts">
  import { protocolExamples, categories, getExamplesByCategory } from '$lib/data/examples';
  import { loadExample, editorContent } from '$lib/stores/editor';
  import { onMount } from 'svelte';

  export let collapsed = false;

  let activeView: 'examples' | 'saved' | null = 'examples';
  let selectedCategory = 'All';
  let savedProtocols: Array<{ id: string; name: string; code: string; timestamp: number }> = [];
  let newProtocolName = '';
  let showSaveDialog = false;

  // Load saved protocols from localStorage
  onMount(() => {
    loadSavedProtocols();
  });

  function loadSavedProtocols() {
    try {
      const saved = localStorage.getItem('smpst-saved-protocols');
      if (saved) {
        savedProtocols = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load saved protocols:', error);
    }
  }

  function saveSavedProtocols() {
    try {
      localStorage.setItem('smpst-saved-protocols', JSON.stringify(savedProtocols));
    } catch (error) {
      console.error('Failed to save protocols:', error);
    }
  }

  function handleLoadExample(exampleId: string) {
    const example = protocolExamples.find(ex => ex.id === exampleId);
    if (example) {
      loadExample(example);
    }
  }

  function handleSaveProtocol() {
    // Get current editor content
    let currentContent = '';
    const unsubscribe = editorContent.subscribe(value => {
      currentContent = value;
    });
    unsubscribe();

    if (!currentContent.trim()) {
      alert('No content to save');
      return;
    }

    if (!newProtocolName.trim()) {
      alert('Please enter a name for the protocol');
      return;
    }

    const newProtocol = {
      id: Date.now().toString(),
      name: newProtocolName.trim(),
      code: currentContent,
      timestamp: Date.now()
    };

    savedProtocols = [newProtocol, ...savedProtocols];
    saveSavedProtocols();

    newProtocolName = '';
    showSaveDialog = false;
  }

  function handleLoadSaved(id: string) {
    const protocol = savedProtocols.find(p => p.id === id);
    if (protocol) {
      editorContent.set(protocol.code);
    }
  }

  function handleDeleteSaved(id: string) {
    if (confirm('Are you sure you want to delete this protocol?')) {
      savedProtocols = savedProtocols.filter(p => p.id !== id);
      saveSavedProtocols();
    }
  }

  function handleIconClick(view: 'examples' | 'saved') {
    if (activeView === view) {
      // Toggle sidebar if clicking the same view
      collapsed = !collapsed;
      if (collapsed) {
        activeView = null;
      }
    } else {
      // Switch to new view and expand
      activeView = view;
      collapsed = false;
    }
  }

  function toggleCollapse() {
    collapsed = !collapsed;
    if (collapsed) {
      activeView = null;
    } else {
      activeView = 'examples';
    }
  }

  $: filteredExamples = getExamplesByCategory(selectedCategory);
  $: sortedSaved = savedProtocols.sort((a, b) => b.timestamp - a.timestamp);
</script>

<div class="sidebar-container">
  <!-- Icon bar (activity bar) -->
  <div class="icon-bar">
    <button
      class="icon-btn"
      class:active={activeView === 'examples' && !collapsed}
      on:click={() => handleIconClick('examples')}
      title="Protocol Examples"
    >
      📚
    </button>
    <button
      class="icon-btn"
      class:active={activeView === 'saved' && !collapsed}
      on:click={() => handleIconClick('saved')}
      title="Saved Protocols ({savedProtocols.length})"
    >
      💾
    </button>
  </div>

  <!-- Main sidebar content -->
  {#if !collapsed && activeView}
    <div class="sidebar-content">
      {#if activeView === 'examples'}
        <div class="sidebar-header">
          <h3 class="sidebar-title">Examples</h3>
          <button class="btn-close" on:click={toggleCollapse} title="Close sidebar">×</button>
        </div>

        <div class="category-filter">
          <select bind:value={selectedCategory} class="category-select">
            {#each categories as category}
              <option value={category}>{category}</option>
            {/each}
          </select>
        </div>

        <div class="item-list">
          {#each filteredExamples as example}
            <button
              class="list-item"
              on:click={() => handleLoadExample(example.id)}
              title={example.description}
            >
              <div class="item-name">{example.name}</div>
              <div class="item-meta">{example.category}</div>
            </button>
          {/each}
        </div>

      {:else if activeView === 'saved'}
        <div class="sidebar-header">
          <h3 class="sidebar-title">Saved Protocols</h3>
          <button class="btn-close" on:click={toggleCollapse} title="Close sidebar">×</button>
        </div>

        <div class="saved-actions">
          <button class="btn-save" on:click={() => showSaveDialog = true}>
            + Save Current Protocol
          </button>
        </div>

        {#if showSaveDialog}
          <div class="save-dialog">
            <input
              type="text"
              bind:value={newProtocolName}
              placeholder="Protocol name..."
              class="save-input"
              on:keydown={(e) => e.key === 'Enter' && handleSaveProtocol()}
              autofocus
            />
            <div class="dialog-actions">
              <button class="btn-dialog-save" on:click={handleSaveProtocol}>Save</button>
              <button class="btn-dialog-cancel" on:click={() => { showSaveDialog = false; newProtocolName = ''; }}>Cancel</button>
            </div>
          </div>
        {/if}

        <div class="item-list">
          {#if sortedSaved.length === 0}
            <p class="empty-message">No saved protocols yet</p>
          {:else}
            {#each sortedSaved as protocol}
              <div class="saved-item">
                <button
                  class="saved-item-load"
                  on:click={() => handleLoadSaved(protocol.id)}
                  title="Load protocol"
                >
                  <div class="item-name">{protocol.name}</div>
                  <div class="item-meta">
                    {new Date(protocol.timestamp).toLocaleDateString()}
                  </div>
                </button>
                <button
                  class="saved-item-delete"
                  on:click={() => handleDeleteSaved(protocol.id)}
                  title="Delete protocol"
                >
                  ×
                </button>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sidebar-container {
    display: flex;
    background: #252526;
    border-right: 1px solid #1e1e1e;
  }

  .icon-bar {
    width: 48px;
    background: #333333;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #1e1e1e;
  }

  .icon-btn {
    width: 48px;
    height: 48px;
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    color: #ccc;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    position: relative;
  }

  .icon-btn:hover {
    background: #2d2d2d;
  }

  .icon-btn.active {
    border-left-color: #007acc;
    background: #252526;
  }

  .sidebar-content {
    width: 250px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
  }

  .sidebar-title {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    color: #ccc;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .btn-close:hover {
    background: #3d3d3d;
  }

  .category-filter {
    padding: 6px 8px;
    border-bottom: 1px solid #1e1e1e;
  }

  .category-select {
    width: 100%;
    padding: 3px 4px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .category-select:focus {
    outline: none;
    border-color: #007acc;
  }

  .item-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }

  .list-item {
    width: 100%;
    padding: 5px 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    margin-bottom: 2px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .list-item:hover {
    background: #2d2d2d;
    border-color: #3d3d3d;
  }

  .item-name {
    font-size: 13px;
    color: #ccc;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .item-meta {
    font-size: 11px;
    color: #888;
  }

  .saved-actions {
    padding: 6px 8px;
    border-bottom: 1px solid #1e1e1e;
  }

  .btn-save {
    width: 100%;
    padding: 4px 6px;
    background: #007acc;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
  }

  .btn-save:hover {
    background: #005a9e;
  }

  .save-dialog {
    padding: 6px 8px;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
  }

  .save-input {
    width: 100%;
    padding: 4px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .save-input:focus {
    outline: none;
    border-color: #007acc;
  }

  .dialog-actions {
    display: flex;
    gap: 4px;
  }

  .btn-dialog-save,
  .btn-dialog-cancel {
    flex: 1;
    padding: 3px 6px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }

  .btn-dialog-save {
    background: #007acc;
    color: #fff;
  }

  .btn-dialog-save:hover {
    background: #005a9e;
  }

  .btn-dialog-cancel {
    background: #3d3d3d;
    color: #ccc;
  }

  .btn-dialog-cancel:hover {
    background: #4d4d4d;
  }

  .empty-message {
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 13px;
    font-style: italic;
    margin: 0;
  }

  .saved-item {
    display: flex;
    align-items: stretch;
    margin-bottom: 4px;
    border: 1px solid transparent;
    border-radius: 4px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .saved-item:hover {
    border-color: #3d3d3d;
  }

  .saved-item-load {
    flex: 1;
    padding: 5px 6px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .saved-item-load:hover {
    background: #2d2d2d;
  }

  .saved-item-delete {
    width: 24px;
    background: transparent;
    border: none;
    border-left: 1px solid #3d3d3d;
    color: #888;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: all 0.2s;
  }

  .saved-item-delete:hover {
    background: #5f2d2d;
    color: #ff6b6b;
  }
</style>
