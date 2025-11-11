<script lang="ts">
  import { protocolExamples, categories, getExamplesByCategory } from '../data/examples';
  import { loadExample, libraryOpen } from '../stores/editor';
  import type { ProtocolExample } from '../data/examples';

  let selectedCategory = 'All';
  let filteredExamples: ProtocolExample[] = protocolExamples;

  function handleCategoryChange(category: string) {
    selectedCategory = category;
    filteredExamples = getExamplesByCategory(category);
  }

  function handleLoadExample(example: ProtocolExample) {
    if (confirm(`Load "${example.name}" protocol?\n\nThis will replace your current editor content.`)) {
      loadExample(example);
    }
  }
</script>

{#if $libraryOpen}
  <aside class="library">
    <div class="library-header">
      <h2 class="library-title">Protocol Library</h2>
      <button class="close-btn" on:click={() => libraryOpen.set(false)}>×</button>
    </div>

    <div class="category-tabs">
      {#each categories as category}
        <button
          class="category-tab"
          class:active={selectedCategory === category}
          on:click={() => handleCategoryChange(category)}
        >
          {category}
        </button>
      {/each}
    </div>

    <div class="examples-list">
      {#each filteredExamples as example (example.id)}
        <div class="example-card">
          <div class="example-header">
            <h3 class="example-name">{example.name}</h3>
            <span class="example-category">{example.category}</span>
          </div>
          <p class="example-description">{example.description}</p>
          <button class="load-btn" on:click={() => handleLoadExample(example)}>
            Load Protocol →
          </button>
        </div>
      {/each}
    </div>
  </aside>
{/if}

<style>
  .library {
    width: 280px;
    background: #1f2937;
    border-right: 1px solid #374151;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #374151;
  }

  .library-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: #f3f4f6;
  }

  .category-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.75rem;
    background: #111827;
    border-bottom: 1px solid #374151;
    overflow-x: auto;
  }

  .category-tab {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid #374151;
    border-radius: 4px;
    color: #9ca3af;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .category-tab:hover {
    background: #1f2937;
    color: #d1d5db;
  }

  .category-tab.active {
    background: #667eea;
    border-color: #667eea;
    color: white;
  }

  .examples-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
  }

  .example-card {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    transition: all 0.2s;
  }

  .example-card:hover {
    border-color: #4b5563;
    transform: translateY(-1px);
  }

  .example-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .example-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0;
  }

  .example-category {
    font-size: 0.625rem;
    color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    padding: 0.125rem 0.5rem;
    border-radius: 3px;
    font-weight: 600;
  }

  .example-description {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .load-btn {
    width: 100%;
    padding: 0.5rem;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .load-btn:hover {
    background: #4b5563;
    border-color: #667eea;
    color: #f3f4f6;
  }

  /* Scrollbar styling */
  .examples-list::-webkit-scrollbar {
    width: 6px;
  }

  .examples-list::-webkit-scrollbar-track {
    background: #1f2937;
  }

  .examples-list::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }

  .examples-list::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
</style>
