<script lang="ts">
  /**
   * Editor Page
   *
   * Main code editing view with:
   * - Scribble protocol editor (Monaco)
   * - Verification panel
   * - Projection results
   * - CFSM visualization
   */
  import CodeTab from '$lib/components/tabs/CodeTab.svelte';
  import { appStore } from '$lib/stores/app.store';
  import { onMount } from 'svelte';

  onMount(() => {
    appStore.setRoute('/');
  });
</script>

<div class="editor-page">
  <CodeTab />
</div>

<style>
  .editor-page {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }
</style>
