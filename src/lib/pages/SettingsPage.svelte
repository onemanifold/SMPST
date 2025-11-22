<script lang="ts">
  /**
   * Settings Page
   *
   * Application preferences and configuration:
   * - Theme selection
   * - Editor settings
   * - Simulation defaults
   * - Data management (clear storage, export)
   */
  import { appStore, isDarkMode } from '$lib/stores/app.store';
  import { persistenceStore } from '$lib/stores/persistence.store';
  import { platform } from '$lib/platform';
  import { push } from 'svelte-spa-router';
  import { onMount } from 'svelte';

  let persistedState = persistenceStore.getState();

  // Local state for form
  let editorFontSize = persistedState.ui.editorFontSize;
  let editorWordWrap = persistedState.ui.editorWordWrap;
  let editorMinimap = persistedState.ui.editorMinimap;
  let playbackSpeed = persistedState.simulation.playbackSpeed;
  let maxSteps = persistedState.simulation.maxSteps;

  onMount(() => {
    appStore.setRoute('/settings');
  });

  function saveSettings() {
    persistenceStore.updateUI({
      editorFontSize,
      editorWordWrap,
      editorMinimap,
    });
    persistenceStore.updateSimulation({
      playbackSpeed,
      maxSteps,
    });
    appStore.addNotification({
      type: 'success',
      message: 'Settings saved',
      dismissible: true,
      duration: 3000,
    });
  }

  function resetSettings() {
    persistenceStore.reset();
    const newState = persistenceStore.getState();
    editorFontSize = newState.ui.editorFontSize;
    editorWordWrap = newState.ui.editorWordWrap;
    editorMinimap = newState.ui.editorMinimap;
    playbackSpeed = newState.simulation.playbackSpeed;
    maxSteps = newState.simulation.maxSteps;
    appStore.addNotification({
      type: 'info',
      message: 'Settings reset to defaults',
      dismissible: true,
      duration: 3000,
    });
  }

  async function clearAllData() {
    if (confirm('This will clear all saved protocols and settings. Continue?')) {
      persistenceStore.reset();
      appStore.addNotification({
        type: 'warning',
        message: 'All data cleared',
        dismissible: true,
        duration: 3000,
      });
    }
  }

  function goBack() {
    push('/');
  }

  function setTheme(newTheme: 'dark' | 'light') {
    appStore.setTheme(newTheme);
    persistenceStore.updateUI({ theme: newTheme });
  }

  const platformInfo = platform.getInfo();
</script>

<div class="settings-page">
  <header class="settings-header">
    <button class="back-button" on:click={goBack}>
      ← Back
    </button>
    <h1>Settings</h1>
  </header>

  <div class="settings-content">
    <!-- Appearance -->
    <section class="settings-section">
      <h2>Appearance</h2>

      <div class="setting-item">
        <label>
          <span class="setting-label">Theme</span>
          <div class="setting-control">
            <button
              class="theme-button"
              class:active={$isDarkMode}
              on:click={() => setTheme('dark')}
            >
              Dark
            </button>
            <button
              class="theme-button"
              class:active={!$isDarkMode}
              on:click={() => setTheme('light')}
            >
              Light
            </button>
          </div>
        </label>
      </div>
    </section>

    <!-- Editor -->
    <section class="settings-section">
      <h2>Editor</h2>

      <div class="setting-item">
        <label>
          <span class="setting-label">Font Size</span>
          <input
            type="number"
            bind:value={editorFontSize}
            min="10"
            max="24"
            class="setting-input"
          />
        </label>
      </div>

      <div class="setting-item">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={editorWordWrap} />
          <span>Word Wrap</span>
        </label>
      </div>

      <div class="setting-item">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={editorMinimap} />
          <span>Show Minimap</span>
        </label>
      </div>
    </section>

    <!-- Simulation -->
    <section class="settings-section">
      <h2>Simulation</h2>

      <div class="setting-item">
        <label>
          <span class="setting-label">Playback Speed (ms)</span>
          <input
            type="number"
            bind:value={playbackSpeed}
            min="50"
            max="2000"
            step="50"
            class="setting-input"
          />
        </label>
      </div>

      <div class="setting-item">
        <label>
          <span class="setting-label">Max Steps</span>
          <input
            type="number"
            bind:value={maxSteps}
            min="100"
            max="10000"
            step="100"
            class="setting-input"
          />
        </label>
      </div>
    </section>

    <!-- Data -->
    <section class="settings-section">
      <h2>Data</h2>

      <div class="setting-item">
        <button class="danger-button" on:click={clearAllData}>
          Clear All Data
        </button>
        <span class="setting-hint">Removes all saved protocols and preferences</span>
      </div>
    </section>

    <!-- About -->
    <section class="settings-section">
      <h2>About</h2>

      <div class="about-info">
        <p><strong>SMPST IDE</strong> - Multiparty Session Types Verification</p>
        <p>Platform: {platformInfo.name} ({platformInfo.os})</p>
        <p>Version: 0.1.0-alpha</p>
      </div>
    </section>

    <!-- Actions -->
    <div class="settings-actions">
      <button class="secondary-button" on:click={resetSettings}>
        Reset to Defaults
      </button>
      <button class="primary-button" on:click={saveSettings}>
        Save Settings
      </button>
    </div>
  </div>
</div>

<style>
  .settings-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary, #1e1e1e);
    color: var(--color-text-primary, #ccc);
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-4, 16px);
    padding: var(--spacing-4, 16px);
    background: var(--color-bg-secondary, #252526);
    border-bottom: 1px solid var(--color-border, #3c3c3c);
  }

  .settings-header h1 {
    margin: 0;
    font-size: var(--font-size-lg, 16px);
    font-weight: var(--font-weight-medium, 500);
  }

  .back-button {
    padding: var(--spacing-1, 4px) var(--spacing-2, 8px);
    background: transparent;
    color: var(--color-text-secondary, #9d9d9d);
    border: 1px solid var(--color-border, #3c3c3c);
    border-radius: var(--radius-md, 4px);
    cursor: pointer;
    font-size: var(--font-size-sm, 12px);
  }

  .back-button:hover {
    background: var(--color-bg-hover, #3d3d3d);
    color: var(--color-text-primary, #ccc);
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-6, 24px);
    max-width: 600px;
  }

  .settings-section {
    margin-bottom: var(--spacing-8, 32px);
  }

  .settings-section h2 {
    margin: 0 0 var(--spacing-4, 16px);
    font-size: var(--font-size-md, 14px);
    font-weight: var(--font-weight-semibold, 600);
    color: var(--color-text-primary, #ccc);
    border-bottom: 1px solid var(--color-border-subtle, #2d2d2d);
    padding-bottom: var(--spacing-2, 8px);
  }

  .setting-item {
    margin-bottom: var(--spacing-4, 16px);
  }

  .setting-label {
    display: block;
    margin-bottom: var(--spacing-1, 4px);
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text-secondary, #9d9d9d);
  }

  .setting-input {
    width: 120px;
    padding: var(--spacing-1, 4px) var(--spacing-2, 8px);
    background: var(--color-bg-tertiary, #2d2d2d);
    color: var(--color-text-primary, #ccc);
    border: 1px solid var(--color-border, #3c3c3c);
    border-radius: var(--radius-md, 4px);
    font-size: var(--font-size-base, 13px);
  }

  .setting-input:focus {
    outline: none;
    border-color: var(--color-accent, #007acc);
  }

  .setting-control {
    display: flex;
    gap: var(--spacing-2, 8px);
  }

  .theme-button {
    padding: var(--spacing-1, 4px) var(--spacing-3, 12px);
    background: var(--color-bg-tertiary, #2d2d2d);
    color: var(--color-text-secondary, #9d9d9d);
    border: 1px solid var(--color-border, #3c3c3c);
    border-radius: var(--radius-md, 4px);
    cursor: pointer;
    font-size: var(--font-size-sm, 12px);
    transition: all var(--transition-fast, 100ms);
  }

  .theme-button:hover {
    background: var(--color-bg-hover, #3d3d3d);
  }

  .theme-button.active {
    background: var(--color-accent, #007acc);
    color: white;
    border-color: var(--color-accent, #007acc);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 8px);
    cursor: pointer;
    font-size: var(--font-size-base, 13px);
  }

  .checkbox-label input {
    width: 16px;
    height: 16px;
  }

  .setting-hint {
    display: block;
    margin-top: var(--spacing-1, 4px);
    font-size: var(--font-size-xs, 11px);
    color: var(--color-text-muted, #6d6d6d);
  }

  .about-info {
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text-secondary, #9d9d9d);
  }

  .about-info p {
    margin: var(--spacing-1, 4px) 0;
  }

  .settings-actions {
    display: flex;
    gap: var(--spacing-3, 12px);
    padding-top: var(--spacing-4, 16px);
    border-top: 1px solid var(--color-border-subtle, #2d2d2d);
  }

  .primary-button,
  .secondary-button,
  .danger-button {
    padding: var(--spacing-2, 8px) var(--spacing-4, 16px);
    border: none;
    border-radius: var(--radius-md, 4px);
    cursor: pointer;
    font-size: var(--font-size-sm, 12px);
    transition: background var(--transition-fast, 100ms);
  }

  .primary-button {
    background: var(--color-accent, #007acc);
    color: white;
  }

  .primary-button:hover {
    background: var(--color-accent-hover, #1a8ad4);
  }

  .secondary-button {
    background: var(--color-bg-tertiary, #2d2d2d);
    color: var(--color-text-primary, #ccc);
    border: 1px solid var(--color-border, #3c3c3c);
  }

  .secondary-button:hover {
    background: var(--color-bg-hover, #3d3d3d);
  }

  .danger-button {
    background: var(--color-error-bg, rgba(241, 76, 76, 0.15));
    color: var(--color-error, #f14c4c);
    border: 1px solid var(--color-error, #f14c4c);
  }

  .danger-button:hover {
    background: var(--color-error, #f14c4c);
    color: white;
  }
</style>
