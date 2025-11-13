<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import * as d3 from 'd3';

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;

  // Visualization dimensions
  const CFSM_WIDTH = 250;
  const CFSM_HEIGHT = 400;
  const CFSM_MARGIN = 40;
  const STATE_RADIUS = 20;

  function renderCFSMNetwork() {
    if (!svgElement || !containerElement || $projectionData.length === 0) return;

    // Clear existing visualization
    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement);
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    svg.attr('width', width).attr('height', height);

    // Calculate layout
    const numCFSMs = $projectionData.length;
    const totalWidth = numCFSMs * (CFSM_WIDTH + CFSM_MARGIN);
    const startX = Math.max(CFSM_MARGIN, (width - totalWidth) / 2);

    // Render each CFSM
    $projectionData.forEach((projection, index) => {
      const cfsmX = startX + index * (CFSM_WIDTH + CFSM_MARGIN);
      const cfsmY = 60;

      renderCFSM(svg, projection, cfsmX, cfsmY);
    });
  }

  function renderCFSM(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    projection: typeof $projectionData[0],
    x: number,
    y: number
  ) {
    const g = svg.append('g').attr('transform', `translate(${x}, ${y})`);

    // Title
    g.append('text')
      .attr('x', CFSM_WIDTH / 2)
      .attr('y', -20)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .attr('font-weight', 'bold')
      .attr('fill', '#4EC9B0')
      .text(projection.role);

    // Border
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', CFSM_WIDTH)
      .attr('height', CFSM_HEIGHT)
      .attr('fill', 'none')
      .attr('stroke', '#4EC9B0')
      .attr('stroke-width', 2)
      .attr('rx', 4);

    // Layout states vertically
    const states = projection.states;
    const stateY = new Map<string, number>();
    const stateSpacing = states.length > 1 ? CFSM_HEIGHT / (states.length + 1) : CFSM_HEIGHT / 2;

    states.forEach((state, i) => {
      const yPos = (i + 1) * stateSpacing;
      stateY.set(state, yPos);
    });

    // Render transitions
    const transitionsGroup = g.append('g').attr('class', 'transitions');

    projection.transitions.forEach(t => {
      const y1 = stateY.get(t.from) || 0;
      const y2 = stateY.get(t.to) || 0;
      const x1 = CFSM_WIDTH / 2;
      const x2 = CFSM_WIDTH / 2;

      if (t.from === t.to) {
        // Self-loop
        const loopRadius = 30;
        const path = `M ${x1},${y1 - STATE_RADIUS}
                      C ${x1 + loopRadius},${y1 - loopRadius}
                        ${x1 + loopRadius},${y1 + loopRadius}
                        ${x1},${y1 + STATE_RADIUS}`;

        transitionsGroup
          .append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', '#666')
          .attr('stroke-width', 1.5)
          .attr('marker-end', 'url(#arrowhead)');

        // Label for self-loop
        transitionsGroup
          .append('text')
          .attr('x', x1 + loopRadius + 10)
          .attr('y', y1)
          .attr('font-size', 11)
          .attr('fill', '#9CDCFE')
          .text(truncateLabel(t.label));
      } else {
        // Regular transition
        const dy = y2 - y1;
        const dx = x2 - x1;
        const angle = Math.atan2(dy, dx);

        // Adjust start and end points to be on circle edge
        const startX = x1 + STATE_RADIUS * Math.cos(angle);
        const startY = y1 + STATE_RADIUS * Math.sin(angle);
        const endX = x2 - STATE_RADIUS * Math.cos(angle);
        const endY = y2 - STATE_RADIUS * Math.sin(angle);

        // Draw line
        transitionsGroup
          .append('line')
          .attr('x1', startX)
          .attr('y1', startY)
          .attr('x2', endX)
          .attr('y2', endY)
          .attr('stroke', '#666')
          .attr('stroke-width', 1.5)
          .attr('marker-end', 'url(#arrowhead)');

        // Label
        transitionsGroup
          .append('text')
          .attr('x', (startX + endX) / 2 + 10)
          .attr('y', (startY + endY) / 2)
          .attr('font-size', 11)
          .attr('fill', '#9CDCFE')
          .text(truncateLabel(t.label));
      }
    });

    // Render states on top
    const statesGroup = g.append('g').attr('class', 'states');

    states.forEach((state, i) => {
      const yPos = stateY.get(state) || 0;
      const xPos = CFSM_WIDTH / 2;
      const isInitial = i === 0;
      const isFinal = i === states.length - 1;

      // State circle
      statesGroup
        .append('circle')
        .attr('cx', xPos)
        .attr('cy', yPos)
        .attr('r', STATE_RADIUS)
        .attr('fill', isInitial ? '#2d5f2d' : isFinal ? '#5f2d2d' : '#2d2d2d')
        .attr('stroke', isInitial ? '#90ee90' : isFinal ? '#ff6b6b' : '#666')
        .attr('stroke-width', 2);

      // State label
      statesGroup
        .append('text')
        .attr('x', xPos)
        .attr('y', yPos + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#fff')
        .text(state);
    });

    // Define arrowhead marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#666');
  }

  function truncateLabel(label: string, maxLength = 15): string {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 3) + '...';
  }

  // Re-render on data change or window resize
  $: if ($projectionData) {
    renderCFSMNetwork();
  }

  onMount(() => {
    renderCFSMNetwork();
    window.addEventListener('resize', renderCFSMNetwork);
  });

  onDestroy(() => {
    window.removeEventListener('resize', renderCFSMNetwork);
  });
</script>

<div class="cfsm-network" bind:this={containerElement}>
  {#if $parseStatus !== 'success' || $projectionData.length === 0}
    <div class="placeholder">
      <h3>🔄 CFSM Network</h3>
      <p>Parse a protocol to see the network of Communicating Finite State Machines</p>
    </div>
  {:else}
    <svg bind:this={svgElement}></svg>
  {/if}
</div>

<style>
  .cfsm-network {
    width: 100%;
    height: 100%;
    background: #1e1e1e;
    overflow: auto;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    text-align: center;
    padding: 40px;
  }

  .placeholder h3 {
    color: #fff;
    margin-bottom: 16px;
  }

  svg {
    display: block;
  }
</style>
