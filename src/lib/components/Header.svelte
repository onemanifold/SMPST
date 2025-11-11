<script lang="ts">
  import { parseStatus, clearEditor, mockParse, editorContent, simulationState, projectionData } from '../stores/editor';
  import { protocolExamples, type ProtocolExample } from '../data/examples';
  import { loadExample } from '../stores/editor';

  let showProtocolMenu = false;

  function handleNew() {
    if (confirm('Clear current protocol?')) {
      clearEditor();
    }
  }

  function handleParse() {
    mockParse($editorContent);
  }

  function handleLoadProtocol(example: ProtocolExample) {
    loadExample(example);
    showProtocolMenu = false;
  }

  // Simulation controls
  function handleStart() {
    simulationState.update(s => ({ ...s, running: true }));
  }

  function handlePause() {
    simulationState.update(s => ({ ...s, running: false }));
  }

  function handleStep() {
    simulationState.update(s => ({ ...s, step: s.step + 1 }));
  }

  function handleReset() {
    simulationState.set({
      running: false,
      step: 0,
      maxSteps: 100,
      currentRoleStates: {},
      messageQueue: []
    });
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

  $: canSimulate = $parseStatus === 'success' && $projectionData.length > 0;
</script>

<header class="header">
  <div class="header-section">
    <h1 class="title">Scribble MPST IDE</h1>
    <span class="version">v0.1.0</span>

    <div class="protocol-dropdown">
      <button class="dropdown-btn" on:click={() => showProtocolMenu = !showProtocolMenu}>
        📚 Protocols ▾
      </button>
      {#if showProtocolMenu}
        <div class="dropdown-menu">
          <div class="menu-header">Example Protocols</div>
          {#each protocolExamples as example}
            <button class="menu-item" on:click={() => handleLoadProtocol(example)}>
              <div class="menu-item-title">{example.name}</div>
              <div class="menu-item-desc">{example.description}</div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <button class="btn btn-secondary" on:click={handleNew}>
      ✚ New
    </button>
  </div>

  <div class="header-section simulation-section">
    <div class="sim-controls">
      <button
        class="sim-btn"
        class:active={$simulationState.running}
        on:click={handleStart}
        disabled={$simulationState.running || !canSimulate}
        title="Start simulation"
      >
        ▶
      </button>
      <button
        class="sim-btn"
        on:click={handlePause}
        disabled={!$simulationState.running}
        title="Pause simulation"
      >
        ⏸
      </button>
      <button
        class="sim-btn"
        on:click={handleStep}
        disabled={$simulationState.running || !canSimulate}
        title="Step forward"
      >
        ⏭
      </button>
      <button
        class="sim-btn"
        on:click={handleReset}
        title="Reset simulation"
      >
        ↻
      </button>
    </div>
    <div class="sim-info">
      <span class="info-text">Step {$simulationState.step}/{$simulationState.maxSteps}</span>
      <span class="status-dot" class:running={$simulationState.running}></span>
    </div>
  </div>

  <div class="header-section">
    <div class="status-group">
      <div class="status-indicator" style="background-color: {statusColor}"></div>
      <span class="status-text">{statusText}</span>
    </div>

    <button
      class="btn btn-primary"
      on:click={handleParse}
      disabled={$parseStatus === 'parsing'}
    >
      ▶ Parse & Verify
    </button>
  </div>
</header>

<!-- Close dropdown when clicking outside -->
<svelte:window on:click={(e) => {
  if (!e.target.closest('.protocol-dropdown')) {
    showProtocolMenu = false;
  }
}} />

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    border-bottom: 1px solid #374151;
    gap: 2rem;
  }

  .header-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .title {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .version {
    font-size: 0.7rem;
    color: #6b7280;
    padding: 0.2rem 0.4rem;
    background: #1f2937;
    border-radius: 3px;
  }

  .protocol-dropdown {
    position: relative;
  }

  .dropdown-btn {
    padding: 0.5rem 0.75rem;
    background: #374151;
    color: #d1d5db;
    border: 1px solid #4b5563;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dropdown-btn:hover {
    background: #4b5563;
    border-color: #6b7280;
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    min-width: 320px;
    max-height: 400px;
    overflow-y: auto;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 6px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }

  .menu-header {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    border-bottom: 1px solid #374151;
  }

  .menu-item {
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid #374151;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .menu-item:last-child {
    border-bottom: none;
  }

  .menu-item:hover {
    background: #374151;
  }

  .menu-item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f3f4f6;
    margin-bottom: 0.25rem;
  }

  .menu-item-desc {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .simulation-section {
    flex: 1;
    justify-content: center;
  }

  .sim-controls {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: #374151;
    border-radius: 6px;
  }

  .sim-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #d1d5db;
    font-size: 0.875rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .sim-btn:hover:not(:disabled) {
    background: #4b5563;
  }

  .sim-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sim-btn.active {
    background: #667eea;
    color: white;
  }

  .sim-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #374151;
    border-radius: 6px;
  }

  .info-text {
    font-size: 0.75rem;
    color: #d1d5db;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6b7280;
  }

  .status-dot.running {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .status-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentColor;
  }

  .status-text {
    font-size: 0.875rem;
    color: #d1d5db;
    font-weight: 500;
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
