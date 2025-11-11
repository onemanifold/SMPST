<script lang="ts">
  import { activeTab, parseStatus, verificationResult, projectionData, parseError } from '../stores/editor';

  let isCollapsed = false;

  function selectTab(tab: typeof $activeTab) {
    activeTab.set(tab);
  }

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }
</script>

<div class="output-panel" class:collapsed={isCollapsed}>
  <div class="tabs-header">
    <div class="tabs-group">
      <button
        class="tab"
        class:active={$activeTab === 'verification'}
        on:click={() => selectTab('verification')}
      >
        ✓ Verification
      </button>
      <button
        class="tab"
        class:active={$activeTab === 'projection'}
        on:click={() => selectTab('projection')}
      >
        ⚙ Projection
      </button>
      <button
        class="tab"
        class:active={$activeTab === 'errors'}
        on:click={() => selectTab('errors')}
      >
        ⚠ Errors
        {#if $parseError}
          <span class="error-badge">1</span>
        {/if}
      </button>
    </div>
    <button class="collapse-btn" on:click={toggleCollapse} title={isCollapsed ? 'Expand panel' : 'Collapse panel'}>
      {isCollapsed ? '▲' : '▼'}
    </button>
  </div>

  {#if !isCollapsed}
  <div class="tab-content">
    {#if $activeTab === 'verification'}
      <div class="content-section">
        <h3 class="section-title">Verification Results</h3>
        {#if $parseStatus === 'success' && $verificationResult}
          <div class="result-grid">
            <div class="result-item" class:success={$verificationResult.deadlockFree}>
              <span class="result-icon">{$verificationResult.deadlockFree ? '✓' : '✗'}</span>
              <span class="result-label">Deadlock-Free</span>
            </div>
            <div class="result-item" class:success={$verificationResult.livenessSatisfied}>
              <span class="result-icon">{$verificationResult.livenessSatisfied ? '✓' : '✗'}</span>
              <span class="result-label">Liveness</span>
            </div>
            <div class="result-item" class:success={$verificationResult.safetySatisfied}>
              <span class="result-icon">{$verificationResult.safetySatisfied ? '✓' : '✗'}</span>
              <span class="result-label">Safety</span>
            </div>
          </div>
          {#if $verificationResult.warnings.length > 0}
            <div class="warnings-section">
              <h4 class="subsection-title">Warnings</h4>
              {#each $verificationResult.warnings as warning}
                <div class="warning-item">{warning}</div>
              {/each}
            </div>
          {/if}
        {:else}
          <p class="empty-message">Parse a protocol to see verification results</p>
        {/if}
      </div>
    {:else if $activeTab === 'projection'}
      <div class="content-section">
        <h3 class="section-title">Projected CFSMs</h3>
        {#if $parseStatus === 'success' && $projectionData.length > 0}
          {#each $projectionData as projection}
            <div class="projection-card">
              <h4 class="projection-role">{projection.role}</h4>
              <div class="projection-details">
                <div class="detail-item">
                  <span class="detail-label">States:</span>
                  <span class="detail-value">{projection.states.join(', ')}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Transitions:</span>
                  <div class="transitions-list">
                    {#each projection.transitions as transition}
                      <div class="transition-item">
                        {transition.from} → {transition.to}: <code>{transition.label}</code>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        {:else}
          <p class="empty-message">Parse a protocol to see projections</p>
        {/if}
      </div>
    {:else if $activeTab === 'errors'}
      <div class="content-section">
        <h3 class="section-title">Parse Errors</h3>
        {#if $parseError}
          <div class="error-card">
            <div class="error-icon">⚠</div>
            <div class="error-message">{$parseError}</div>
          </div>
        {:else}
          <p class="empty-message success">✓ No errors</p>
        {/if}
      </div>
    {/if}
  </div>
  {/if}
</div>

<style>
  .output-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1f2937;
    border-top: 1px solid #374151;
    transition: height 0.3s ease;
  }

  .output-panel.collapsed {
    height: auto;
    min-height: 0;
  }

  .tabs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #111827;
    border-bottom: 1px solid #374151;
    padding: 0.5rem 1rem 0;
  }

  .tabs-group {
    display: flex;
    gap: 0;
  }

  .collapse-btn {
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 4px;
  }

  .collapse-btn:hover {
    color: #d1d5db;
    background: rgba(102, 126, 234, 0.1);
  }

  .tab {
    padding: 0.625rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #9ca3af;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .tab:hover {
    color: #d1d5db;
  }

  .tab.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .error-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: #ef4444;
    color: white;
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .content-section {
    max-width: 900px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0 0 1rem 0;
  }

  .result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
  }

  .result-item.success {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }

  .result-icon {
    font-size: 1.25rem;
    color: #9ca3af;
  }

  .result-item.success .result-icon {
    color: #10b981;
  }

  .result-label {
    font-size: 0.875rem;
    color: #d1d5db;
    font-weight: 500;
  }

  .empty-message {
    color: #6b7280;
    font-size: 0.875rem;
    text-align: center;
    padding: 2rem;
  }

  .empty-message.success {
    color: #10b981;
  }

  .projection-card {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .projection-role {
    font-size: 1rem;
    font-weight: 600;
    color: #667eea;
    margin: 0 0 0.75rem 0;
  }

  .projection-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.75rem;
    color: #9ca3af;
    font-weight: 600;
    text-transform: uppercase;
  }

  .detail-value {
    font-size: 0.875rem;
    color: #d1d5db;
  }

  .transitions-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .transition-item {
    font-size: 0.875rem;
    color: #d1d5db;
    padding: 0.5rem;
    background: #1f2937;
    border-radius: 4px;
  }

  .transition-item code {
    color: #667eea;
    font-family: 'Fira Code', monospace;
    font-size: 0.8125rem;
  }

  .error-card {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid #ef4444;
    border-radius: 6px;
  }

  .error-icon {
    font-size: 1.5rem;
    color: #ef4444;
  }

  .error-message {
    flex: 1;
    font-size: 0.875rem;
    color: #fca5a5;
    line-height: 1.5;
  }

  .warnings-section {
    margin-top: 1rem;
  }

  .subsection-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f59e0b;
    margin: 0 0 0.5rem 0;
  }

  .warning-item {
    padding: 0.75rem;
    background: rgba(245, 158, 11, 0.05);
    border: 1px solid #f59e0b;
    border-radius: 4px;
    color: #fcd34d;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  /* Scrollbar styling */
  .tab-content::-webkit-scrollbar {
    width: 8px;
  }

  .tab-content::-webkit-scrollbar-track {
    background: #1f2937;
  }

  .tab-content::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 4px;
  }

  .tab-content::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
</style>
