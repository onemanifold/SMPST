<script lang="ts">
  import { projectionData, parseStatus } from '$lib/stores/editor';

  let selectedRole = '';

  // Auto-select first role when projection data updates
  $: if ($projectionData.length > 0 && !selectedRole) {
    selectedRole = $projectionData[0].role;
  }

  // Format local Scribble from CFSM transitions
  function formatLocalScribble(projection: typeof $projectionData[0]): string {
    if (!projection || projection.transitions.length === 0) {
      return `// No transitions for role ${projection.role}\n// This role may not participate in the protocol`;
    }

    const lines: string[] = [];
    lines.push(`// Local protocol for role: ${projection.role}`);
    lines.push('');

    // Group transitions by source state
    const stateTransitions = new Map<string, typeof projection.transitions>();
    for (const t of projection.transitions) {
      if (!stateTransitions.has(t.from)) {
        stateTransitions.set(t.from, []);
      }
      stateTransitions.get(t.from)!.push(t);
    }

    // Format as local Scribble notation
    let currentState = projection.states[0];
    const visited = new Set<string>();

    function formatState(state: string, indent = 0) {
      if (visited.has(state)) return;
      visited.add(state);

      const transitions = stateTransitions.get(state) || [];
      const indentStr = '  '.repeat(indent);

      for (const t of transitions) {
        const label = t.label;

        // Parse label to determine send/receive
        if (label.includes('send ')) {
          const msg = label.replace('send ', '');
          lines.push(`${indentStr}// Send ${msg}`);
          lines.push(`${indentStr}!${msg};`);
        } else if (label.includes('recv ')) {
          const msg = label.replace('recv ', '');
          lines.push(`${indentStr}// Receive ${msg}`);
          lines.push(`${indentStr}?${msg};`);
        } else if (label === 'τ' || label === 'tau') {
          lines.push(`${indentStr}// Internal action`);
        } else {
          lines.push(`${indentStr}// ${label}`);
        }

        if (t.to !== state && !visited.has(t.to)) {
          formatState(t.to, indent);
        }
      }
    }

    formatState(currentState);

    return lines.join('\n');
  }

  $: currentProjection = $projectionData.find(p => p.role === selectedRole);
  $: localScribble = currentProjection ? formatLocalScribble(currentProjection) : '';
</script>

<div class="local-projection-panel">
  {#if $parseStatus !== 'success' || $projectionData.length === 0}
    <div class="placeholder">
      <p>Parse a protocol to see local projections</p>
    </div>
  {:else}
    <div class="role-tabs">
      {#each $projectionData as projection}
        <button
          class="role-tab"
          class:active={selectedRole === projection.role}
          on:click={() => selectedRole = projection.role}
        >
          {projection.role}
        </button>
      {/each}
    </div>

    <div class="projection-content">
      <pre class="scribble-code">{localScribble}</pre>
    </div>
  {/if}
</div>

<style>
  .local-projection-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    color: #ccc;
  }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-style: italic;
  }

  .role-tabs {
    display: flex;
    background: #2d2d2d;
    border-bottom: 1px solid #1e1e1e;
    overflow-x: auto;
  }

  .role-tab {
    padding: 8px 16px;
    background: transparent;
    color: #ccc;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .role-tab:hover {
    background: #3d3d3d;
  }

  .role-tab.active {
    color: #fff;
    border-bottom-color: #4EC9B0;
  }

  .projection-content {
    flex: 1;
    overflow: auto;
    padding: 16px;
  }

  .scribble-code {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #d4d4d4;
    margin: 0;
  }
</style>
