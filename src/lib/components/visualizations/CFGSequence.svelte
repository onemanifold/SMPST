<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import * as d3 from 'd3';

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;

  // Visualization dimensions
  const LANE_WIDTH = 150;
  const LANE_MARGIN = 60;
  const MESSAGE_SPACING = 60;
  const LANE_TOP_MARGIN = 80;

  interface Message {
    from: string;
    to: string;
    label: string;
    step: number;
  }

  function extractMessages(): Message[] {
    const messages: Message[] = [];
    let step = 0;

    // Extract messages from projection transitions
    // This is a simplified extraction - ideally we'd traverse the CFG
    for (const projection of $projectionData) {
      for (const transition of projection.transitions) {
        const label = transition.label;

        // Parse send/receive transitions
        if (label.includes('send ')) {
          const msgName = label.replace('send ', '');
          // Find receiver (simplified - assumes binary protocol)
          const otherRole = $projectionData.find(p => p.role !== projection.role);
          if (otherRole) {
            messages.push({
              from: projection.role,
              to: otherRole.role,
              label: msgName,
              step: step++
            });
          }
        }
      }
    }

    return messages;
  }

  function renderSequenceDiagram() {
    if (!svgElement || !containerElement || $projectionData.length === 0) return;

    // Clear existing visualization
    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement);
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    svg.attr('width', width).attr('height', height);

    const roles = $projectionData.map(p => p.role);
    const messages = extractMessages();

    const numRoles = roles.length;
    const totalLaneWidth = numRoles * (LANE_WIDTH + LANE_MARGIN);
    const startX = Math.max(40, (width - totalLaneWidth) / 2);

    // Calculate lane positions
    const laneX = new Map<string, number>();
    roles.forEach((role, i) => {
      laneX.set(role, startX + i * (LANE_WIDTH + LANE_MARGIN) + LANE_WIDTH / 2);
    });

    const diagramHeight = LANE_TOP_MARGIN + messages.length * MESSAGE_SPACING + 40;

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', 18)
      .attr('font-weight', 'bold')
      .attr('fill', '#fff')
      .text('Message Sequence Diagram');

    // Draw swimming lanes
    roles.forEach(role => {
      const x = laneX.get(role)!;

      // Role label at top
      svg
        .append('text')
        .attr('x', x)
        .attr('y', LANE_TOP_MARGIN - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('font-weight', 'bold')
        .attr('fill', '#4EC9B0')
        .text(role);

      // Lifeline
      svg
        .append('line')
        .attr('x1', x)
        .attr('y1', LANE_TOP_MARGIN)
        .attr('x2', x)
        .attr('y2', diagramHeight)
        .attr('stroke', '#666')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    });

    // Draw messages
    messages.forEach((msg, index) => {
      const fromX = laneX.get(msg.from)!;
      const toX = laneX.get(msg.to)!;
      const y = LANE_TOP_MARGIN + index * MESSAGE_SPACING + MESSAGE_SPACING / 2;

      // Message arrow
      svg
        .append('line')
        .attr('x1', fromX)
        .attr('y1', y)
        .attr('x2', toX)
        .attr('y2', y)
        .attr('stroke', '#007acc')
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead-blue)');

      // Message label
      const labelX = (fromX + toX) / 2;
      const labelY = y - 8;

      svg
        .append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#9CDCFE')
        .attr('background', '#1e1e1e')
        .text(msg.label);
    });

    // Define arrowhead marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead-blue')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 9)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#007acc');
  }

  // Re-render on data change or window resize
  $: if ($projectionData) {
    renderSequenceDiagram();
  }

  onMount(() => {
    renderSequenceDiagram();
    window.addEventListener('resize', renderSequenceDiagram);
  });

  onDestroy(() => {
    window.removeEventListener('resize', renderSequenceDiagram);
  });
</script>

<div class="sequence-diagram" bind:this={containerElement}>
  {#if $parseStatus !== 'success' || $projectionData.length === 0}
    <div class="placeholder">
      <h3>📊 CFG Sequence Diagram</h3>
      <p>Parse a protocol to see the message sequence diagram</p>
      <p class="note">Messages flow from top to bottom over time</p>
    </div>
  {:else}
    <svg bind:this={svgElement}></svg>
  {/if}
</div>

<style>
  .sequence-diagram {
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

  .placeholder .note {
    margin-top: 12px;
    font-size: 13px;
    font-style: italic;
  }

  svg {
    display: block;
  }
</style>
