<script lang="ts">
  import { parseStatus, clearEditor, mockParse, editorContent, libraryOpen } from '../stores/editor';

  function handleNew() {
    if (confirm('Clear current protocol?')) {
      clearEditor();
    }
  }

  function handleParse() {
    mockParse($editorContent);
  }

  function toggleLibrary() {
    libraryOpen.update(v => !v);
  }

  $: statusColor = {
    idle: '#6b7280',
    parsing: '#f59e0b',
    success: '#10b981',
    error: '#ef4444'
  }[$parseStatus];

  $: statusText = {
    idle: 'Ready',
    parsing: 'Parsing...',
    success: 'Valid Protocol',
    error: 'Parse Error'
  }[$parseStatus];
</script>

<header class="header">
  <div class="header-left">
    <h1 class="title">Scribble MPST IDE</h1>
    <span class="version">v0.1.0</span>
  </div>

  <div class="header-center">
    <div class="status-indicator" style="background-color: {statusColor}"></div>
    <span class="status-text">{statusText}</span>
  </div>

  <div class="header-right">
    <button class="btn btn-secondary" on:click={toggleLibrary}>
      {$libraryOpen ? '◀' : '▶'} Library
    </button>
    <button class="btn btn-secondary" on:click={handleNew}>
      ✚ New
    </button>
    <button
      class="btn btn-primary"
      on:click={handleParse}
      disabled={$parseStatus === 'parsing'}
    >
      ▶ Parse & Verify
    </button>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    border-bottom: 1px solid #374151;
    height: 64px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .version {
    font-size: 0.75rem;
    color: #6b7280;
    padding: 0.25rem 0.5rem;
    background: #1f2937;
    border-radius: 4px;
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentColor;
  }

  .status-text {
    font-size: 0.875rem;
    color: #d1d5db;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-secondary {
    background: #374151;
    color: #d1d5db;
    border: 1px solid #4b5563;
  }

  .btn-secondary:hover {
    background: #4b5563;
    border-color: #6b7280;
  }
</style>
