<script lang="ts">
  import IDE from './lib/components/IDE.svelte';
  import { loadExample } from './lib/stores/editor';
  import { protocolExamples } from './lib/data/examples';
  import { onMount } from 'svelte';

  // Load example on mount
  onMount(() => {
    loadExample(protocolExamples[0]); // Load Request-Response example
  });
</script>

<IDE />

<style global>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
  }
</style>
