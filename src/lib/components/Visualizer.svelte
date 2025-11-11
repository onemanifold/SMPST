<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { parseStatus, projectionData, simulationState, viewMode } from '../stores/editor';

  let svgContainer: HTMLDivElement;
  let roles: string[] = [];

  $: roles = $projectionData.map(p => p.role);

  // Mock CFG data (global protocol view)
  const mockCFGData = {
    nodes: [
      { id: 'start', label: 'Start', type: 'start' },
      { id: 'n1', label: 'Request', type: 'interaction' },
      { id: 'n2', label: 'Response', type: 'interaction' },
      { id: 'end', label: 'End', type: 'end' }
    ],
    links: [
      { source: 'start', target: 'n1', label: 'Client → Server' },
      { source: 'n1', target: 'n2', label: '' },
      { source: 'n2', target: 'end', label: 'Server → Client' }
    ]
  };

  // Mock CFSM data (local protocol views)
  const mockCFSMData = {
    Client: {
      nodes: [
        { id: 's0', label: 'S0', type: 'initial' },
        { id: 's1', label: 'S1', type: 'intermediate' },
        { id: 's2', label: 'S2', type: 'final' }
      ],
      links: [
        { source: 's0', target: 's1', label: '!Request' },
        { source: 's1', target: 's2', label: '?Response' }
      ]
    },
    Server: {
      nodes: [
        { id: 's0', label: 'S0', type: 'initial' },
        { id: 's1', label: 'S1', type: 'intermediate' },
        { id: 's2', label: 'S2', type: 'final' }
      ],
      links: [
        { source: 's0', target: 's1', label: '?Request' },
        { source: 's1', target: 's2', label: '!Response' }
      ]
    }
  };

  // Simulation controls
  function handleStart() {
    simulationState.update(s => ({ ...s, running: true }));
    // Integration point: start simulation
  }

  function handlePause() {
    simulationState.update(s => ({ ...s, running: false }));
    // Integration point: pause simulation
  }

  function handleStep() {
    simulationState.update(s => ({ ...s, step: s.step + 1 }));
    // Integration point: step simulation
  }

  function handleReset() {
    simulationState.set({
      running: false,
      step: 0,
      maxSteps: 100,
      currentRoleStates: {},
      messageQueue: []
    });
    // Integration point: reset simulation
  }

  function selectView(view: string) {
    viewMode.set(view);
  }

  function renderGraph() {
    if (!svgContainer || $parseStatus !== 'success') return;

    // Clear previous graph
    d3.select(svgContainer).selectAll('*').remove();

    const width = svgContainer.clientWidth;
    const height = svgContainer.clientHeight;

    const svg = d3
      .select(svgContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    const data = $viewMode === 'global' ? mockCFGData : mockCFSMData[$viewMode];
    if (!data) return;

    // Create force simulation
    const simulation = d3
      .forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Add links
    const link = svg
      .append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    // Add link labels
    const linkLabel = svg
      .append('g')
      .selectAll('text')
      .data(data.links)
      .join('text')
      .text((d: any) => d.label)
      .attr('font-size', 10)
      .attr('fill', '#9ca3af')
      .attr('text-anchor', 'middle');

    // Add arrow marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#4b5563');

    // Add nodes
    const node = svg
      .append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', (d: any) => {
        const colors = {
          start: '#10b981',
          initial: '#10b981',
          end: '#ef4444',
          final: '#ef4444',
          interaction: '#667eea',
          intermediate: '#667eea'
        };
        return colors[d.type] || '#667eea';
      })
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2)
      .call(
        d3.drag<any, any>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      );

    // Add node labels
    const nodeLabel = svg
      .append('g')
      .selectAll('text')
      .data(data.nodes)
      .join('text')
      .text((d: any) => d.label)
      .attr('font-size', 12)
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Update positions
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 5);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      nodeLabel
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }

  onMount(() => {
    renderGraph();
  });

  $: if (svgContainer && $parseStatus === 'success') {
    renderGraph();
  }

  $: if ($viewMode) {
    renderGraph();
  }
</script>

<div class="visualizer">
  <div class="visualizer-header">
    <div class="view-tabs">
      <button
        class="view-tab"
        class:active={$viewMode === 'global'}
        on:click={() => selectView('global')}
      >
        Global Protocol
      </button>
      {#each roles as role}
        <button
          class="view-tab"
          class:active={$viewMode === role}
          on:click={() => selectView(role)}
        >
          {role}
        </button>
      {/each}
    </div>
  </div>

  <div class="simulation-controls">
    <div class="control-group">
      <button
        class="sim-btn"
        class:active={$simulationState.running}
        on:click={handleStart}
        disabled={$simulationState.running || $parseStatus !== 'success'}
      >
        ▶ Start
      </button>
      <button
        class="sim-btn"
        on:click={handlePause}
        disabled={!$simulationState.running}
      >
        ⏸ Pause
      </button>
      <button
        class="sim-btn"
        on:click={handleStep}
        disabled={$simulationState.running || $parseStatus !== 'success'}
      >
        ⏭ Step
      </button>
      <button
        class="sim-btn"
        on:click={handleReset}
      >
        ↻ Reset
      </button>
    </div>

    <div class="sim-info">
      <span class="info-label">Step:</span>
      <span class="info-value">{$simulationState.step} / {$simulationState.maxSteps}</span>
      <span class="divider">|</span>
      <span class="info-label">Status:</span>
      <span class="info-value" class:running={$simulationState.running}>
        {$simulationState.running ? 'Running' : 'Idle'}
      </span>
    </div>
  </div>

  <div class="graph-container" bind:this={svgContainer}>
    {#if $parseStatus !== 'success'}
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Parse a protocol to view {$viewMode === 'global' ? 'CFG' : 'CFSM'}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .visualizer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #111827;
  }

  .visualizer-header {
    background: #1f2937;
    border-bottom: 1px solid #374151;
  }

  .view-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem 0;
  }

  .view-tab {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #9ca3af;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-tab:hover {
    color: #d1d5db;
  }

  .view-tab.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .simulation-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #1f2937;
    border-bottom: 1px solid #374151;
  }

  .control-group {
    display: flex;
    gap: 0.5rem;
  }

  .sim-btn {
    padding: 0.5rem 1rem;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sim-btn:hover:not(:disabled) {
    background: #4b5563;
    border-color: #667eea;
  }

  .sim-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sim-btn.active {
    background: #667eea;
    border-color: #667eea;
    color: white;
  }

  .sim-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .info-label {
    color: #9ca3af;
    font-weight: 500;
  }

  .info-value {
    color: #d1d5db;
    font-weight: 600;
  }

  .info-value.running {
    color: #10b981;
  }

  .divider {
    color: #4b5563;
  }

  .graph-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  :global(.visualizer svg) {
    display: block;
  }
</style>
