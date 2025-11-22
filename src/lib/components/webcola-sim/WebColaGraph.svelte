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
   * - Role labels always visible
   * - Color coding by last action type with smooth transitions
   * - Message queue visualization on links
   * - Message tooltips (last message shown by default, hover for others)
   * - Animated message particles
   */
  import { onMount, onDestroy, tick } from 'svelte';
  import { webcolaSimStore, type GraphNode, type QueuedMessage } from '$lib/stores/webcola-simulation.store';
  import * as d3 from 'd3';
  import * as cola from 'webcola';

  let containerElement: HTMLDivElement;
  let svgElement: SVGSVGElement;
  let simulation: any = null;
  let zoomBehavior: any = null;

  // Tooltip state
  let hoveredMessage: QueuedMessage | null = null;
  let tooltipX = 0;
  let tooltipY = 0;

  // Layout constants
  const NODE_RADIUS = 40;
  const LINK_DISTANCE = 220;

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
   * Get the last event's message for tooltip display
   */
  function getLastMessage(): QueuedMessage | null {
    const state = webcolaSimStore.getState();
    const lastEvent = state.events[state.events.length - 1];
    if (!lastEvent || !lastEvent.messageLabel) return null;

    // Find the message in buffers
    for (const link of state.links) {
      for (const msg of link.messages) {
        if (msg.label === lastEvent.messageLabel) {
          return msg;
        }
      }
    }
    return null;
  }

  /**
   * Calculate point along curved path
   */
  function getPointOnArc(source: any, target: any, t: number): { x: number; y: number } {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Arc control point offset
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const perpX = -dy / dist * 30;
    const perpY = dx / dist * 30;
    const ctrlX = midX + perpX;
    const ctrlY = midY + perpY;

    // Quadratic bezier interpolation
    const x = (1-t)*(1-t)*source.x + 2*(1-t)*t*ctrlX + t*t*target.x;
    const y = (1-t)*(1-t)*source.y + 2*(1-t)*t*ctrlY + t*t*target.y;

    return { x, y };
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
      .scale(0.85);
    svg.call((zoomBehavior as any).transform, initialTransform);

    // Define gradients and markers
    const defs = svg.append('defs');

    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 50)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Active arrow marker
    defs.append('marker')
      .attr('id', 'arrowhead-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 50)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#4FC3F7');

    // Glow filter for active elements
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

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

    // Link path (curved)
    linkElements.append('path')
      .attr('class', 'link-path')
      .attr('stroke', (d: any) => d.messages.length > 0 ? '#4FC3F7' : '#444')
      .attr('stroke-width', (d: any) => Math.max(2, Math.min(5, 2 + d.messages.length * 0.5)))
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')
      .attr('marker-end', (d: any) => d.messages.length > 0 ? 'url(#arrowhead-active)' : 'url(#arrowhead)')
      .style('transition', 'stroke 0.3s ease, stroke-width 0.3s ease');

    // Message pills on links
    linkElements.each(function(d: any) {
      const group = d3.select(this);
      const msgs = d.messages.slice(0, 5);

      msgs.forEach((msg: QueuedMessage, i: number) => {
        const msgGroup = group.append('g')
          .attr('class', 'message-pill')
          .attr('data-msg-id', msg.id)
          .style('cursor', 'pointer');

        // Pill background
        msgGroup.append('rect')
          .attr('rx', 8)
          .attr('ry', 8)
          .attr('width', 16)
          .attr('height', 16)
          .attr('x', -8)
          .attr('y', -8)
          .attr('fill', '#4FC3F7')
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .style('filter', 'url(#glow)');

        // Message index
        msgGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', 4)
          .attr('font-size', 9)
          .attr('font-weight', 'bold')
          .attr('fill', '#fff')
          .text(i + 1);

        // Hover handlers
        msgGroup.on('mouseenter', function(event: MouseEvent) {
          hoveredMessage = msg;
          const rect = containerElement.getBoundingClientRect();
          tooltipX = event.clientX - rect.left;
          tooltipY = event.clientY - rect.top - 40;
        });

        msgGroup.on('mouseleave', function() {
          hoveredMessage = null;
        });
      });

      // "More" indicator
      if (d.messages.length > 5) {
        group.append('text')
          .attr('class', 'more-messages')
          .attr('font-size', 10)
          .attr('font-weight', 'bold')
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

    // Node outer ring (for active state)
    nodeElements.append('circle')
      .attr('class', 'node-ring')
      .attr('r', NODE_RADIUS + 4)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => d.state.isActive ? getActionColor(d.state.lastActionType) : 'transparent')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,2')
      .style('transition', 'stroke 0.3s ease');

    // Node circle with smooth color transition
    nodeElements.append('circle')
      .attr('class', 'node-circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d: any) => {
        const color = getActionColor(d.state.lastActionType);
        return d3.color(color)?.darker(0.6)?.toString() || '#333';
      })
      .attr('stroke', (d: any) => getActionColor(d.state.lastActionType))
      .attr('stroke-width', 3)
      .style('transition', 'fill 0.3s ease, stroke 0.3s ease');

    // State label (always visible, prominent)
    nodeElements.append('text')
      .attr('class', 'state-label')
      .attr('text-anchor', 'middle')
      .attr('dy', 6)
      .attr('font-size', 18)
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .text((d: any) => d.state.currentState);

    // Role label below node (always visible, more prominent)
    nodeElements.append('text')
      .attr('class', 'role-label')
      .attr('text-anchor', 'middle')
      .attr('dy', NODE_RADIUS + 20)
      .attr('font-size', 13)
      .attr('font-weight', '500')
      .attr('fill', '#bbb')
      .text((d: any) => d.role);

    // Update positions on tick
    simulation.on('tick', () => {
      // Update link paths with quadratic curves
      linkElements.select('.link-path')
        .attr('d', (d: any) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Control point offset perpendicular to line
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          const perpX = -dy / dist * 30;
          const perpY = dx / dist * 30;

          return `M${d.source.x},${d.source.y} Q${midX + perpX},${midY + perpY} ${d.target.x},${d.target.y}`;
        });

      // Update message pills along curved path
      linkElements.each(function(d: any) {
        const group = d3.select(this);
        const pills = group.selectAll('.message-pill');
        const total = Math.min(5, d.messages.length);

        pills.each(function(this: any, _: any, j: number) {
          // Position along path (0.25 to 0.75)
          const t = 0.25 + (j / Math.max(1, total - 1 || 1)) * 0.5;
          const pos = getPointOnArc(d.source, d.target, total === 1 ? 0.5 : t);

          d3.select(this)
            .attr('transform', `translate(${pos.x},${pos.y})`);
        });

        // Position "more" label
        group.select('.more-messages')
          .attr('x', (d.source.x + d.target.x) / 2 + 25)
          .attr('y', (d.source.y + d.target.y) / 2);
      });

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

    // Update node colors with transitions
    svg.selectAll('.node-circle')
      .data(state.nodes)
      .transition()
      .duration(300)
      .attr('fill', (d: any) => {
        const color = getActionColor(d.state.lastActionType);
        return d3.color(color)?.darker(0.6)?.toString() || '#333';
      })
      .attr('stroke', (d: any) => getActionColor(d.state.lastActionType));

    // Update active ring
    svg.selectAll('.node-ring')
      .data(state.nodes)
      .transition()
      .duration(300)
      .attr('stroke', (d: any) => d.state.isActive ? getActionColor(d.state.lastActionType) : 'transparent');

    // Update state labels
    svg.selectAll('.state-label')
      .data(state.nodes)
      .text((d: any) => d.state.currentState);

    // Update link styling
    svg.selectAll('.link-path')
      .data(state.links)
      .transition()
      .duration(300)
      .attr('stroke', (d: any) => d.messages.length > 0 ? '#4FC3F7' : '#444')
      .attr('stroke-width', (d: any) => Math.max(2, Math.min(5, 2 + d.messages.length * 0.5)))
      .attr('marker-end', (d: any) => d.messages.length > 0 ? 'url(#arrowhead-active)' : 'url(#arrowhead)');
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
      .scale(0.85);

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

  // Get display message (hovered or last)
  $: displayMessage = hoveredMessage || getLastMessage();
</script>

<div class="webcola-graph" bind:this={containerElement}>
  <svg bind:this={svgElement}></svg>

  <!-- Message tooltip -->
  {#if displayMessage}
    <div
      class="message-tooltip"
      class:hovered={hoveredMessage !== null}
      style="left: {hoveredMessage ? tooltipX : 50}%; top: {hoveredMessage ? tooltipY + 'px' : '12px'}; transform: {hoveredMessage ? 'translateX(-50%)' : 'none'};"
    >
      <div class="tooltip-header">
        {#if !hoveredMessage}
          <span class="tooltip-badge">Last Message</span>
        {/if}
        <span class="tooltip-label">{displayMessage.label}</span>
      </div>
      <div class="tooltip-details">
        <span class="tooltip-from">{displayMessage.from}</span>
        <span class="tooltip-arrow">→</span>
        <span class="tooltip-to">{displayMessage.to}</span>
      </div>
      {#if displayMessage.payloadType}
        <div class="tooltip-payload">({displayMessage.payloadType})</div>
      {/if}
    </div>
  {/if}

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
    background: linear-gradient(135deg, #1a1a1a 0%, #252525 100%);
    overflow: hidden;
  }

  svg {
    display: block;
    cursor: grab;
  }

  svg:active {
    cursor: grabbing;
  }

  /* Message tooltip */
  .message-tooltip {
    position: absolute;
    background: rgba(30, 30, 30, 0.95);
    border: 1px solid #4FC3F7;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    pointer-events: none;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    min-width: 120px;
  }

  .message-tooltip.hovered {
    animation: tooltipPop 0.2s ease;
  }

  @keyframes tooltipPop {
    0% { transform: translateX(-50%) scale(0.9); opacity: 0; }
    100% { transform: translateX(-50%) scale(1); opacity: 1; }
  }

  .tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .tooltip-badge {
    font-size: 9px;
    text-transform: uppercase;
    background: #4FC3F7;
    color: #000;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }

  .tooltip-label {
    font-weight: 600;
    color: #fff;
    font-size: 14px;
  }

  .tooltip-details {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #aaa;
  }

  .tooltip-from, .tooltip-to {
    font-weight: 500;
    color: #ccc;
  }

  .tooltip-arrow {
    color: #4FC3F7;
  }

  .tooltip-payload {
    margin-top: 4px;
    color: #888;
    font-size: 11px;
    font-style: italic;
  }

  .reset-zoom-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(50, 50, 50, 0.9);
    border: 1px solid #555;
    border-radius: 8px;
    color: #ccc;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-zoom-btn:hover {
    background: #444;
    border-color: #007acc;
    color: #fff;
    transform: scale(1.05);
  }

  .legend {
    position: absolute;
    bottom: 12px;
    left: 12px;
    background: rgba(30, 30, 30, 0.9);
    border: 1px solid #444;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 11px;
  }

  .legend-title {
    color: #888;
    margin-bottom: 8px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
  }

  .legend-items {
    display: flex;
    gap: 14px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #ccc;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    box-shadow: 0 0 4px currentColor;
  }

  .status-badge {
    position: absolute;
    top: 60px;
    left: 12px;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
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

  :global(.webcola-graph .node:hover .role-label) {
    fill: #fff;
  }

  :global(.webcola-graph .link-path) {
    pointer-events: none;
  }

  :global(.webcola-graph .message-pill) {
    transition: transform 0.1s ease;
  }

  :global(.webcola-graph .message-pill:hover) {
    transform: scale(1.2);
  }

  :global(.webcola-graph .message-pill:hover rect) {
    filter: brightness(1.3) url(#glow);
  }
</style>
