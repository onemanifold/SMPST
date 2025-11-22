<script lang="ts">
  /**
   * App Root Component
   *
   * Sets up routing and global providers.
   * Uses hash-based routing for GitHub Pages compatibility.
   */
  import Router from 'svelte-spa-router';
  import MainLayout from '$lib/components/layouts/MainLayout.svelte';
  import { EditorPage, SimulationPage, SettingsPage } from '$lib/pages';
  import { appStore } from '$lib/stores/app.store';
  import { initializePersistence, forceSaveAll } from '$lib/stores/persistence.integration';
  import { onMount, onDestroy } from 'svelte';

  // Route definitions
  const routes = {
    '/': EditorPage,
    '/simulation': SimulationPage,
    '/simulation/*': SimulationPage,
    '/settings': SettingsPage,
    // Catch-all redirect to home
    '*': EditorPage,
  };

  // Handle route changes
  function handleRouteLoaded(event: CustomEvent) {
    const { route } = event.detail;
    appStore.setRoute(route || '/');
  }

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
  <Router {routes} on:routeLoaded={handleRouteLoaded} />
</MainLayout>
