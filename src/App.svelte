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
  import { persistenceStore } from '$lib/stores/persistence.store';
  import { onMount } from 'svelte';

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

  // Initialize app on mount
  onMount(async () => {
    // Hydrate persisted state
    persistenceStore.hydrate();

    // Apply persisted theme
    const state = persistenceStore.getState();
    appStore.setTheme(state.ui.theme);

    // Mark as initialized
    appStore.setInitialized();
  });
</script>

<MainLayout>
  <Router {routes} on:routeLoaded={handleRouteLoaded} />
</MainLayout>
