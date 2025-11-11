<script lang="ts">
  import { parseStatus, clearEditor, mockParse, editorContent, simulationState, projectionData } from '../stores/editor';
  import { protocolExamples, type ProtocolExample } from '../data/examples';
  import { loadExample } from '../stores/editor';
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

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

<header class="flex items-center justify-between px-6 py-3 bg-gradient-to-br from-dark-800 to-dark-900 border-b border-dark-700 gap-8">
  <!-- Left Section -->
  <div class="flex items-center gap-3">
    <h1 class="text-lg font-bold m-0 bg-gradient-to-br from-primary-500 to-primary-600 bg-clip-text text-transparent">
      Scribble MPST IDE
    </h1>
    <span class="text-[0.7rem] text-dark-500 px-2 py-1 bg-dark-800 rounded">v0.1.0</span>

    <!-- Protocol Dropdown with shadcn DropdownMenu -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="secondary" class="gap-2">
          📚 Protocols ▾
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-80">
        <DropdownMenu.Label>Example Protocols</DropdownMenu.Label>
        <DropdownMenu.Separator />
        {#each protocolExamples as example}
          <DropdownMenu.Item on:click={() => handleLoadProtocol(example)}>
            <div class="flex flex-col gap-0.5">
              <span class="font-semibold text-sm">{example.name}</span>
              <span class="text-xs text-dark-400">{example.description}</span>
            </div>
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <Button variant="secondary" on:click={handleNew}>
      ✚ New
    </Button>
  </div>

  <!-- Center Section: Simulation Controls -->
  <div class="flex items-center gap-3 flex-1 justify-center">
    <div class="flex gap-1 p-1 bg-dark-700 rounded-md">
      <Button
        variant="simulation"
        on:click={handleStart}
        disabled={$simulationState.running || !canSimulate}
        title="Start simulation"
        class="{$simulationState.running ? 'bg-primary-500 text-white' : ''}"
      >
        ▶
      </Button>
      <Button
        variant="simulation"
        on:click={handlePause}
        disabled={!$simulationState.running}
        title="Pause simulation"
      >
        ⏸
      </Button>
      <Button
        variant="simulation"
        on:click={handleStep}
        disabled={$simulationState.running || !canSimulate}
        title="Step forward"
      >
        ⏭
      </Button>
      <Button
        variant="simulation"
        on:click={handleReset}
        title="Reset simulation"
      >
        ↻
      </Button>
    </div>

    <div class="flex items-center gap-2 px-3 py-2 bg-dark-700 rounded-md">
      <span class="text-xs text-dark-300 font-semibold tabular-nums">
        Step {$simulationState.step}/{$simulationState.maxSteps}
      </span>
      <span class="w-1.5 h-1.5 rounded-full {$simulationState.running ? 'bg-success animate-pulse' : 'bg-dark-500'}"></span>
    </div>
  </div>

  <!-- Right Section -->
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style="background-color: {statusColor}"></div>
      <span class="text-sm text-dark-300 font-medium">{statusText}</span>
    </div>

    <Button
      variant="default"
      on:click={handleParse}
      disabled={$parseStatus === 'parsing'}
      class="hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)]"
    >
      ▶ Parse & Verify
    </Button>
  </div>
</header>

<style>
  /* Animation for pulse */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .animate-pulse {
    animation: pulse 2s ease-in-out infinite;
  }
</style>
