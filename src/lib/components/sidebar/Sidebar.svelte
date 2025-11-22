<script lang="ts">
  import { protocolExamples, categories, getExamplesByCategory } from '$lib/data/examples';
  import { loadExample, editorContent } from '$lib/stores/editor';
  import { protocolDB, type SavedProtocol } from '$lib/stores/protocol-db';
  import { onMount } from 'svelte';

  export let collapsed = false;

  let activeView: 'examples' | 'saved' | null = 'examples';
  let selectedCategory = 'All';
  let savedProtocols: SavedProtocol[] = [];
  let newProtocolName = '';
  let showSaveDialog = false;

  // Load saved protocols from Dexie
  onMount(() => {
    loadSavedProtocols();
  });

  async function loadSavedProtocols() {
    try {
      savedProtocols = await protocolDB.getAll();
    } catch (error) {
      console.error('Failed to load saved protocols:', error);
    }
  }

  async function handleLoadExample(exampleId: string) {
    const example = protocolExamples.find(ex => ex.id === exampleId);
    if (example) {
      await loadExample(example);
    }
  }

  async function handleSaveProtocol() {
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

    try {
      await protocolDB.add({
        name: newProtocolName.trim(),
        code: currentContent,
        timestamp: Date.now()
      });

      // Reload protocols from DB
      await loadSavedProtocols();

      newProtocolName = '';
      showSaveDialog = false;
    } catch (error) {
      console.error('Failed to save protocol:', error);
      alert('Failed to save protocol');
    }
  }

  async function handleLoadSaved(id: number | undefined) {
    if (!id) return;
    const protocol = savedProtocols.find(p => p.id === id);
    if (protocol) {
      editorContent.set(protocol.code);
      // Trigger parsing for saved protocols too
      const { parseProtocol } = await import('$lib/stores/editor');
      await parseProtocol(protocol.code);
    }
  }

  async function handleDeleteSaved(id: number | undefined) {
    if (!id) return;
    if (confirm('Are you sure you want to delete this protocol?')) {
      try {
        await protocolDB.delete(id);
        // Reload protocols from DB
        await loadSavedProtocols();
      } catch (error) {
        console.error('Failed to delete protocol:', error);
        alert('Failed to delete protocol');
      }
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
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-bg-primary);
  }

  .icon-bar {
    width: var(--sidebar-collapsed-width);
    background: var(--color-bg-elevated);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-bg-primary);
  }

  .icon-btn {
    width: var(--sidebar-collapsed-width);
    height: var(--sidebar-collapsed-width);
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    color: var(--color-text-primary);
    font-size: var(--font-size-2xl);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-normal);
    position: relative;
  }

  .icon-btn:hover {
    background: var(--color-bg-tertiary);
  }

  .icon-btn.active {
    border-left-color: var(--color-accent);
    background: var(--color-bg-secondary);
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
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-bg-primary);
  }

  .sidebar-title {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: var(--font-size-lg);
    line-height: 1;
    padding: 2px var(--spacing-1);
    border-radius: var(--radius-md);
  }

  .btn-close:hover {
    background: var(--color-bg-hover);
  }

  .category-filter {
    padding: var(--spacing-1) var(--spacing-2);
    border-bottom: 1px solid var(--color-bg-primary);
  }

  .category-select {
    width: 100%;
    padding: 3px var(--spacing-1);
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    cursor: pointer;
  }

  .category-select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .item-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-1);
  }

  .list-item {
    width: 100%;
    padding: var(--spacing-1) var(--spacing-1);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    margin-bottom: 2px;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-normal);
  }

  .list-item:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-bg-hover);
  }

  .item-name {
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--spacing-1);
  }

  .item-meta {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .saved-actions {
    padding: var(--spacing-1) var(--spacing-2);
    border-bottom: 1px solid var(--color-bg-primary);
  }

  .btn-save {
    width: 100%;
    padding: var(--spacing-1) var(--spacing-1);
    background: var(--color-accent);
    color: var(--color-text-inverse);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
  }

  .btn-save:hover {
    background: var(--color-accent-active);
  }

  .save-dialog {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-bg-primary);
  }

  .save-input {
    width: 100%;
    padding: var(--spacing-1);
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-1);
  }

  .save-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .dialog-actions {
    display: flex;
    gap: var(--spacing-1);
  }

  .btn-dialog-save,
  .btn-dialog-cancel {
    flex: 1;
    padding: 3px var(--spacing-1);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .btn-dialog-save {
    background: var(--color-accent);
    color: var(--color-text-inverse);
  }

  .btn-dialog-save:hover {
    background: var(--color-accent-active);
  }

  .btn-dialog-cancel {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }

  .btn-dialog-cancel:hover {
    background: var(--color-bg-active);
  }

  .empty-message {
    padding: var(--spacing-5);
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-base);
    font-style: italic;
    margin: 0;
  }

  .saved-item {
    display: flex;
    align-items: stretch;
    margin-bottom: var(--spacing-1);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: all var(--transition-normal);
  }

  .saved-item:hover {
    border-color: var(--color-bg-hover);
  }

  .saved-item-load {
    flex: 1;
    padding: var(--spacing-1) var(--spacing-1);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-normal);
  }

  .saved-item-load:hover {
    background: var(--color-bg-tertiary);
  }

  .saved-item-delete {
    width: 24px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--color-bg-hover);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: var(--font-size-xl);
    line-height: 1;
    transition: all var(--transition-normal);
  }

  .saved-item-delete:hover {
    background: var(--color-error-bg);
    color: var(--color-error);
  }
</style>
