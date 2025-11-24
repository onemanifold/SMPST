<script lang="ts">
  /**
   * App Root Component
   *
   * SPA with View Persistence:
   * - All views mount once and stay in DOM
   * - Navigation toggles visibility with CSS (no remounting)
   * - Preserves state, scroll position, and form inputs across navigation
   * - Hash-based routing for GitHub Pages compatibility
   */
  import MainLayout from '$lib/components/layouts/MainLayout.svelte';
  import { EditorPage, SimulationPage, SettingsPage } from '$lib/pages';
  import { appStore, currentRoute } from '$lib/stores/app.store';
  import { initializePersistence, forceSaveAll } from '$lib/stores/persistence.integration';
  import { onMount, onDestroy } from 'svelte';

  // Save state before page unload
  function handleBeforeUnload() {
    forceSaveAll();
  }

  // Initialize app on mount
  onMount(async () => {
    // Initialize persistence (loads and applies persisted state)
    await initializePersistence();

    // Mark as initialized
    appStore.setInitialized();

    // Save state before page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<MainLayout>
  <!-- All views exist in DOM, toggled by CSS -->
  <!-- This prevents remounting and preserves state -->

  <div class="view editor-view" class:active={$currentRoute === '/'}>
    <EditorPage />
  </div>

  <div class="view simulation-view" class:active={$currentRoute === '/simulation' || $currentRoute.startsWith('/simulation/')}>
    <SimulationPage />
  </div>

  <div class="view settings-view" class:active={$currentRoute === '/settings'}>
    <SettingsPage />
  </div>
</MainLayout>

<style>
  .view {
    display: none;
    width: 100%;
    height: 100%;
  }

  .view.active {
    display: block;
  }
</style>
