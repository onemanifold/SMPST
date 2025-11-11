<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { parseStatus, projectionData } from '../stores/editor';

  let svgContainer: HTMLDivElement;
  let viewMode: 'cfg' | 'cfsm' = 'cfg';
  let selectedRole = 'Client';

  // Mock CFG data
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

  // Mock CFSM data
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

    const data = viewMode === 'cfg' ? mockCFGData : mockCFSMData[selectedRole];

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

  $: if (viewMode || selectedRole) {
    renderGraph();
  }
</script>

<div class="visualizer">
  <div class="visualizer-header">
    <div class="header-left">
      <span class="visualizer-title">Visualization</span>
    </div>
    <div class="header-right">
      <div class="view-toggle">
        <button
          class="toggle-btn"
          class:active={viewMode === 'cfg'}
          on:click={() => viewMode = 'cfg'}
        >
          CFG
        </button>
        <button
          class="toggle-btn"
          class:active={viewMode === 'cfsm'}
          on:click={() => viewMode = 'cfsm'}
        >
          CFSM
        </button>
      </div>
      {#if viewMode === 'cfsm'}
        <select class="role-select" bind:value={selectedRole}>
          <option value="Client">Client</option>
          <option value="Server">Server</option>
        </select>
      {/if}
    </div>
  </div>

  <div class="graph-container" bind:this={svgContainer}>
    {#if $parseStatus !== 'success'}
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Parse a protocol to view visualization</p>
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #1f2937;
    border-bottom: 1px solid #374151;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .visualizer-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f3f4f6;
  }

  .header-right {
    display: flex;
    gap: 0.5rem;
  }

  .view-toggle {
    display: flex;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 4px;
    overflow: hidden;
  }

  .toggle-btn {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    color: #d1d5db;
  }

  .toggle-btn.active {
    background: #667eea;
    color: white;
  }

  .role-select {
    padding: 0.375rem 0.75rem;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
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
