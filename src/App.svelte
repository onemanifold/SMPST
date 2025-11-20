<script lang="ts">
  import { onMount } from 'svelte';
  import { editorStore, simulationStore, uiStore } from '$lib/stores';
  import SimulatorControls from '$lib/components/SimulatorControls.svelte';
  import CallStackDisplay from '$lib/components/CallStackDisplay.svelte';
  import FsmVisualizer from '$lib/components/FsmVisualizer.svelte';
  import CfgVisualizer from '$lib/components/CfgVisualizer.svelte';
  import { examples } from '../examples';

  let editorCode = examples[0].code;

  onMount(() => {
    editorStore.updateCode(editorCode);
  });

  function loadExample(code: string) {
    editorCode = code;
    editorStore.updateCode(code);
    simulationStore.actions.reset();
  }
</script>

<div class="flex flex-col h-screen bg-gray-900 text-gray-300 font-sans">
  <header class="bg-gray-800 shadow-md flex-shrink-0">
    <div class="max-w-full mx-auto py-3 px-4 sm:px-6 lg:px-8">
      <h1 class="text-xl font-bold text-white">Secure Scribble IDE (Svelte Edition)</h1>
    </div>
  </header>
  <div class="flex flex-1 overflow-hidden">
    <aside class="w-1/5 bg-gray-800 p-4 overflow-y-auto">
      <h2 class="text-lg font-semibold mb-2 text-white">Examples</h2>
      <div class="max-h-96 overflow-y-auto">
        {#each examples as ex}
          <div on:click={() => loadExample(ex.code)} class="p-3 bg-gray-700 rounded-lg mb-2 cursor-pointer hover:bg-gray-600">
            <h3 class="font-bold text-white">{ex.name}</h3>
            <p class="text-sm text-gray-400">{ex.description}</p>
          </div>
        {/each}
      </div>
    </aside>
    <main class="flex-1 flex flex-col p-4 overflow-hidden">
      <div class="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        <div class="flex flex-col overflow-hidden">
          <h2 class="text-xl font-semibold mb-2 text-white">Protocol Editor</h2>
          <textarea
            bind:value={editorCode}
            on:input={(e) => editorStore.updateCode(e.currentTarget.value)}
            class="flex-1 bg-gray-800 border border-gray-600 rounded-lg p-4 font-mono text-sm resize-none overflow-auto"
            spellCheck="false"
          />
          <div class="mt-4">
            <h3 class="text-lg font-semibold text-white">Errors & Validation</h3>
            <div class="h-24 bg-gray-800 border border-gray-600 rounded-lg p-2 overflow-y-auto text-sm">
              {#if $editorStore.errors.length === 0}
                <p class="text-green-400">No errors detected.</p>
              {:else}
                {#each $editorStore.errors as e}
                  <p class="text-red-400">{e.message}</p>
                {/each}
              {/if}
            </div>
          </div>
        </div>
        <div class="flex flex-col overflow-hidden">
          <h2 class="text-xl font-semibold text-white">Visualization</h2>
          {#if $editorStore.cfg}
            <CfgVisualizer
              cfg={$editorStore.cfg}
              currentNode={$simulationStore.cfgExecutionState?.currentNode}
            />
          {/if}
        </div>
      </div>
      <div class="mt-4">
        <SimulatorControls
          onStepForward={simulationStore.actions.stepForward}
          onStepBackward={simulationStore.actions.stepBackward}
          onStepInto={simulationStore.actions.stepInto}
          onStepOut={simulationStore.actions.stepOut}
          onStepOver={simulationStore.actions.stepOver}
          onReset={simulationStore.actions.reset}
          onRun={simulationStore.actions.run}
          onPause={simulationStore.actions.pause}
          isRunning={$simulationStore.isRunning}
          isCompleted={$simulationStore.cfgExecutionState?.completed ?? false}
          canStepBackward={$simulationStore.canStepBackward}
          canStepOut={$simulationStore.callStack.length > 0}
          stepCount={$simulationStore.cfgExecutionState?.stepCount ?? 0}
        />
      </div>
      {#if $simulationStore.callStack.length > 0}
        <div class="mt-4">
          <CallStackDisplay frames={$simulationStore.callStack} />
        </div>
      {/if}
    </main>
  </div>
</div>
