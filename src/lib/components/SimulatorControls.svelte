<script lang="ts">
  export let onStepForward: () => void;
  export let onStepBackward: () => void;
  export let onStepInto: () => void;
  export let onStepOut: () => void;
  export let onStepOver: () => void;
  export let onReset: () => void;
  export let onRun: () => void;
  export let onPause: () => void;
  export let isRunning: boolean;
  export let isCompleted: boolean;
  export let canStepBackward: boolean;
  export let canStepOut: boolean;
  export let stepCount: number;
</script>

<div class="bg-gray-800 border border-gray-600 rounded-lg p-4">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold text-white">Simulation Controls</h3>
    <div class="text-sm text-gray-400">
      Step: <span class="font-mono text-blue-400">{stepCount}</span>
    </div>
  </div>

  <!-- Main Control Buttons -->
  <div class="grid grid-cols-3 gap-2 mb-4">
    <!-- Play/Pause -->
    {#if !isRunning}
      <button
        on:click={onRun}
        disabled={isCompleted}
        class="flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
        title="Run to completion"
      >
        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
        Run
      </button>
    {:else}
      <button
        on:click={onPause}
        class="flex items-center justify-center bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition-colors"
        title="Pause execution"
      >
        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        Pause
      </button>
    {/if}

    <!-- Reset -->
    <button
      on:click={onReset}
      class="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
      title="Reset simulation"
    >
      <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
      </svg>
      Reset
    </button>

    <!-- Status indicator -->
    <div class="flex items-center justify-center">
      {#if isCompleted}
        <span class="text-green-400 font-semibold flex items-center">
          <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          Complete
        </span>
      {:else if isRunning}
        <span class="text-yellow-400 font-semibold flex items-center">
          <svg class="w-5 h-5 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Running
        </span>
      {:else}
        <span class="text-gray-400 font-semibold">Ready</span>
      {/if}
    </div>
  </div>

  <!-- Stepping Controls -->
  <div class="border-t border-gray-600 pt-4">
    <h4 class="text-sm font-semibold text-gray-300 mb-2">Step Controls</h4>
    <div class="grid grid-cols-2 gap-2">
      <!-- Step Backward -->
      <button
        on:click={onStepBackward}
        disabled={!canStepBackward || isRunning}
        class="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
        title="Step backward (undo)"
      >
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        Step Back
      </button>

      <!-- Step Forward -->
      <button
        on:click={onStepForward}
        disabled={isCompleted || isRunning}
        class="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
        title="Step forward"
      >
        Step Forward
        <svg class="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          <path fill-rule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Step Into -->
      <button
        on:click={onStepInto}
        disabled={isCompleted || isRunning}
        class="flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
        title="Step into sub-protocol"
      >
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        Step Into
      </button>

      <!-- Step Over -->
      <button
        on:click={onStepOver}
        disabled={isCompleted || isRunning}
        class="flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
        title="Step over sub-protocol"
      >
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        Step Over
      </button>

      <!-- Step Out -->
      <button
        on:click={onStepOut}
        disabled={!canStepOut || isCompleted || isRunning}
        class="col-span-2 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-3 rounded transition-colors text-sm"
        title="Step out of current sub-protocol"
      >
        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        Step Out
      </button>
    </div>
  </div>
</div>
