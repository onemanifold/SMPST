<script lang="ts">
  /**
   * WebColaGraph - Force-directed graph visualization using WebCola
   *
   * Displays:
   * - Nodes: Role CFSMs as circles with current state index
   * - Links: Message buffers between roles with queued messages
   * - Animations: Messages traveling between nodes
   *
   * Features:
   * - State index visible on nodes
   * - Role label on hover (tooltip)
   * - Color coding by last action type
   * - Message queue visualization on links
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import { webcolaSimStore, type GraphNode } from '$lib/stores/webcola-simulation.store';
  import * as d3 from 'd3';
  import * as cola from 'webcola';

  let containerElement: HTMLDivElement;
  let svgElement: SVGSVGElement;
  let simulation: any = null;
  let zoomBehavior: any = null;

  // Layout constants
  const NODE_RADIUS = 35;
  const LINK_DISTANCE = 200;

  // Action type colors
  const ACTION_COLORS: Record<string, string> = {
    send: '#4FC3F7',      // Blue
    receive: '#81C784',   // Green
    tau: '#9E9E9E',       // Gray
    choice: '#FFD54F',    // Yellow
    idle: '#757575',      // Dark gray
  };

  /**
   * Get color for action type
   */
  function getActionColor(actionType: string): string {
    return ACTION_COLORS[actionType] || ACTION_COLORS.idle;
  }

  /**
   * Render the graph using D3 + WebCola
   */
  function renderGraph() {
    if (!svgElement || !containerElement) return;

    const state = webcolaSimStore.getState();
    if (state.nodes.length === 0) return;

    // Clear previous content
    d3.select(svgElement).selectAll('*').remove();

    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height);

    // Create container group for pan/zoom
    const container = svg.append('g').attr('class', 'zoom-container');

    // Setup zoom behavior
    zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: any) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoomBehavior as any);

    // Initial zoom to center
    const initialTransform = d3.zoomIdentity
      .translate(width / 2 - 100, height / 2 - 100)
      .scale(0.9);
    svg.call((zoomBehavior as any).transform, initialTransform);

    // Define arrow markers
    const defs = svg.append('defs');

    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 45)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Prepare nodes and links for WebCola
    const nodes: any[] = state.nodes.map((n, i) => ({
      ...n,
      index: i,
      x: width / 2 + Math.cos(i * 2 * Math.PI / state.nodes.length) * 150,
      y: height / 2 + Math.sin(i * 2 * Math.PI / state.nodes.length) * 150,
    }));

    const links: any[] = state.links.map(l => ({
      ...l,
      source: typeof l.source === 'number' ? l.source : nodes.findIndex(n => n.id === (l.source as GraphNode).id),
      target: typeof l.target === 'number' ? l.target : nodes.findIndex(n => n.id === (l.target as GraphNode).id),
    }));

    // Create WebCola layout
    simulation = cola.d3adaptor(d3)
      .size([width, height])
      .nodes(nodes)
      .links(links)
      .linkDistance(LINK_DISTANCE)
      .avoidOverlaps(true)
      .handleDisconnected(true)
      .start(30, 20, 20);

    // Draw links (buffers)
    const linkGroup = container.append('g').attr('class', 'links');

    const linkElements = linkGroup.selectAll('.link')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'link');

    // Link line
    linkElements.append('path')
      .attr('class', 'link-path')
      .attr('stroke', (d: any) => d.messages.length > 0 ? '#4FC3F7' : '#555')
      .attr('stroke-width', (d: any) => Math.max(2, Math.min(6, 2 + d.messages.length)))
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrowhead)');

    // Message count label
    linkElements.append('text')
      .attr('class', 'link-label')
      .attr('font-size', 11)
      .attr('fill', '#aaa')
      .attr('text-anchor', 'middle')
      .text((d: any) => d.messages.length > 0 ? `${d.messages.length} msg${d.messages.length > 1 ? 's' : ''}` : '');

    // Message indicators on links
    linkElements.each(function(d: any) {
      const group = d3.select(this);
      const msgs = d.messages.slice(0, 5); // Show max 5 messages

      msgs.forEach((_msg: any, i: number) => {
        group.append('circle')
          .attr('class', 'message-indicator')
          .attr('r', 6)
          .attr('fill', '#4FC3F7')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .attr('data-index', i);
      });

      if (d.messages.length > 5) {
        group.append('text')
          .attr('class', 'more-messages')
          .attr('font-size', 10)
          .attr('fill', '#4FC3F7')
          .text(`+${d.messages.length - 5}`);
      }
    });

    // Draw nodes (roles)
    const nodeGroup = container.append('g').attr('class', 'nodes');

    const nodeElements = nodeGroup.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(simulation.drag() as any);

    // Node circle
    nodeElements.append('circle')
      .attr('class', 'node-circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d: any) => {
        const color = getActionColor(d.state.lastActionType);
        return d3.color(color)?.darker(0.5)?.toString() || '#333';
      })
      .attr('stroke', (d: any) => getActionColor(d.state.lastActionType))
      .attr('stroke-width', 3);

    // State label (always visible)
    nodeElements.append('text')
      .attr('class', 'state-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', 16)
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .text((d: any) => d.state.currentState);

    // Role label (shown on hover via title)
    nodeElements.append('title')
      .text((d: any) => `${d.role}\nState: ${d.state.currentState}\nLast action: ${d.state.lastActionType}`);

    // Role label below node
    nodeElements.append('text')
      .attr('class', 'role-label')
      .attr('text-anchor', 'middle')
      .attr('dy', NODE_RADIUS + 18)
      .attr('font-size', 12)
      .attr('fill', '#888')
      .text((d: any) => d.role);

    // Update positions on tick
    simulation.on('tick', () => {
      // Update link paths
      linkElements.select('.link-path')
        .attr('d', (d: any) => {
          const sourceX = d.source.x;
          const sourceY = d.source.y;
          const targetX = d.target.x;
          const targetY = d.target.y;

          // Curved path
          const dx = targetX - sourceX;
          const dy = targetY - sourceY;
          const dr = Math.sqrt(dx * dx + dy * dy) * 0.8;

          return `M${sourceX},${sourceY}A${dr},${dr} 0 0,1 ${targetX},${targetY}`;
        });

      // Update link labels position
      linkElements.select('.link-label')
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2 - 15);

      // Update message indicators along path
      linkElements.each(function(d: any) {
        const group = d3.select(this);
        const indicators = group.selectAll('.message-indicator');
        const total = Math.min(5, d.messages.length);

        indicators.each(function(this: any, _: any, j: number) {
          const t = 0.3 + (j / Math.max(1, total)) * 0.4;
          const cx = d.source.x + (d.target.x - d.source.x) * t;
          const midY = d.source.y + (d.target.y - d.source.y) * t;
          const offset = (j - total / 2) * 12;

          d3.select(this)
            .attr('cx', cx)
            .attr('cy', midY + offset);
        });
      });

      // Update more-messages label
      linkElements.select('.more-messages')
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2 + 20)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      // Update node positions
      nodeElements.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  /**
   * Update graph with new state (without full re-render)
   */
  function updateGraph() {
    if (!svgElement) return;

    const state = webcolaSimStore.getState();
    const svg = d3.select(svgElement);

    // Update node colors based on state
    svg.selectAll('.node-circle')
      .data(state.nodes)
      .attr('fill', (d: any) => {
        const color = getActionColor(d.state.lastActionType);
        return d3.color(color)?.darker(0.5)?.toString() || '#333';
      })
      .attr('stroke', (d: any) => getActionColor(d.state.lastActionType));

    // Update state labels
    svg.selectAll('.state-label')
      .data(state.nodes)
      .text((d: any) => d.state.currentState);

    // Update link styling based on message count
    svg.selectAll('.link-path')
      .data(state.links)
      .attr('stroke', (d: any) => d.messages.length > 0 ? '#4FC3F7' : '#555')
      .attr('stroke-width', (d: any) => Math.max(2, Math.min(6, 2 + d.messages.length)));

    // Update link labels
    svg.selectAll('.link-label')
      .data(state.links)
      .text((d: any) => d.messages.length > 0 ? `${d.messages.length} msg${d.messages.length > 1 ? 's' : ''}` : '');
  }

  /**
   * Reset zoom to initial position
   */
  function resetZoom() {
    if (!svgElement || !zoomBehavior) return;

    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    const resetTransform = d3.zoomIdentity
      .translate(width / 2 - 100, height / 2 - 100)
      .scale(0.9);

    d3.select(svgElement)
      .transition()
      .duration(500)
      .call(zoomBehavior.transform, resetTransform);
  }

  // Subscribe to store changes
  let unsubscribe: () => void;
  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    tick().then(() => {
      renderGraph();
    });

    // Subscribe to updates
    unsubscribe = webcolaSimStore.subscribe(() => {
      updateGraph();
    });

    // Handle resize
    resizeObserver = new ResizeObserver(() => {
      renderGraph();
    });
    resizeObserver.observe(containerElement);
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
    if (simulation) simulation.stop();
    if (resizeObserver) resizeObserver.disconnect();
  });

  // Re-render when store reinitializes
  $: if ($webcolaSimStore.nodes.length > 0 && svgElement) {
    tick().then(renderGraph);
  }
</script>

<div class="webcola-graph" bind:this={containerElement}>
  <svg bind:this={svgElement}></svg>

  <button class="reset-zoom-btn" on:click={resetZoom} title="Reset zoom">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  </button>

  <div class="legend">
    <div class="legend-title">Action Types</div>
    <div class="legend-items">
      <div class="legend-item">
        <span class="legend-color" style="background: {ACTION_COLORS.send}"></span>
        <span>Send</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: {ACTION_COLORS.receive}"></span>
        <span>Receive</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: {ACTION_COLORS.tau}"></span>
        <span>Tau</span>
      </div>
      <div class="legend-item">
        <span class="legend-color" style="background: {ACTION_COLORS.choice}"></span>
        <span>Choice</span>
      </div>
    </div>
  </div>

  {#if $webcolaSimStore.isComplete}
    <div class="status-badge complete">Complete</div>
  {:else if $webcolaSimStore.isDeadlocked}
    <div class="status-badge deadlock">Deadlock</div>
  {/if}
</div>

<style>
  .webcola-graph {
    width: 100%;
    height: 100%;
    position: relative;
    background: #1a1a1a;
    overflow: hidden;
  }

  svg {
    display: block;
    cursor: grab;
  }

  svg:active {
    cursor: grabbing;
  }

  .reset-zoom-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    border: 1px solid #555;
    border-radius: 6px;
    color: #ccc;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-zoom-btn:hover {
    background: #444;
    border-color: #007acc;
    color: #fff;
  }

  .legend {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(30, 30, 30, 0.9);
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
  }

  .legend-title {
    color: #888;
    margin-bottom: 6px;
    font-weight: 500;
    text-transform: uppercase;
    font-size: 10px;
  }

  .legend-items {
    display: flex;
    gap: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #ccc;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .status-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-badge.complete {
    background: rgba(76, 175, 80, 0.2);
    color: #81C784;
    border: 1px solid #81C784;
  }

  .status-badge.deadlock {
    background: rgba(244, 67, 54, 0.2);
    color: #EF5350;
    border: 1px solid #EF5350;
  }

  /* Graph element styles (applied via D3) */
  :global(.webcola-graph .node) {
    cursor: pointer;
  }

  :global(.webcola-graph .node:hover .node-circle) {
    filter: brightness(1.2);
  }

  :global(.webcola-graph .link-path) {
    pointer-events: none;
  }
</style>
