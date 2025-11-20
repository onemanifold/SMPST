<script lang="ts">
  import type { ProtocolCallFrame } from '../../core/simulation/call-stack-types';

  export let frames: ProtocolCallFrame[];
  export let onFrameClick: (frame: ProtocolCallFrame) => void = () => {};
</script>

<div class="bg-gray-800 border border-gray-600 rounded-lg p-4">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-lg font-semibold text-white">Call Stack</h3>
    <div class="text-xs text-gray-400">
      Depth: <span class="font-mono text-blue-400">{frames.length}</span>
    </div>
  </div>

  {#if frames.length === 0}
    <div class="text-gray-400 text-sm italic">No sub-protocols active</div>
  {:else}
    <!-- Breadcrumb navigation -->
    <div class="mb-3 flex items-center flex-wrap gap-1 text-sm">
      <span class="text-gray-400">Root</span>
      {#each frames as frame, index}
        <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
        <button
          on:click={() => onFrameClick(frame)}
          class="hover:text-blue-400 transition-colors {index === frames.length - 1 ? 'text-blue-400 font-semibold' : 'text-gray-300'}"
        >
          {frame.metadata?.displayName || frame.name}
        </button>
      {/each}
    </div>

    <!-- Stack frames list -->
    <div class="space-y-2 max-h-64 overflow-y-auto">
      {#each [...frames].reverse() as frame, reverseIndex}
        {@const index = frames.length - 1 - reverseIndex}
        {@const isActive = index === frames.length - 1}
        <div
          on:click={() => onFrameClick(frame)}
          class="p-3 rounded border cursor-pointer transition-all {isActive ? 'bg-blue-900 border-blue-600 shadow-md' : 'bg-gray-700 border-gray-600 hover:bg-gray-650 hover:border-gray-500'}"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold px-2 py-0.5 rounded {frame.type === 'recursion' ? 'bg-yellow-600 text-yellow-100' : 'bg-purple-600 text-purple-100'}">
                  {frame.type === 'recursion' ? 'REC' : 'SUB'}
                </span>
                <h4 class="font-semibold text-white">{frame.metadata?.displayName || frame.name}</h4>
                {#if isActive}
                  <span class="ml-auto text-xs text-blue-300 font-semibold">ACTIVE</span>
                {/if}
              </div>
              {#if frame.metadata?.description}
                <p class="text-xs text-gray-400 mt-1">{frame.metadata.description}</p>
              {/if}
              <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-gray-400">Current Node:</span>{' '}
                  <span class="font-mono text-blue-300">{frame.currentNode}</span>
                </div>
                <div>
                  <span class="text-gray-400">Steps:</span>{' '}
                  <span class="font-mono text-green-300">{frame.stepCount}</span>
                </div>
                {#if frame.iterations !== undefined}
                  <div>
                    <span class="text-gray-400">Iterations:</span>{' '}
                    <span class="font-mono text-yellow-300">{frame.iterations}</span>
                  </div>
                {/if}
                {#if frame.roleMapping}
                  <div class="col-span-2">
                    <span class="text-gray-400">Role Mapping:</span>{' '}
                    <span class="font-mono text-purple-300 text-xs">
                      {Object.entries(frame.roleMapping).map(([formal, actual]) => `${formal}→${actual}`).join(', ')}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
