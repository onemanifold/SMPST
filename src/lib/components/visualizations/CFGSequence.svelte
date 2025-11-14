<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { parseStatus } from '$lib/stores/editor';
  import { currentCFG, executionState } from '$lib/stores/simulation';
  import * as d3 from 'd3';
  import type { CFGNode, MessageAction } from '../../../core/cfg/types';

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;
  let zoomBehavior: any = null;
  let currentTransform = d3.zoomIdentity;

  // Visualization dimensions
  const LANE_WIDTH = 150;
  const LANE_MARGIN = 60;
  const MESSAGE_SPACING = 60;
  const LANE_TOP_MARGIN = 80;

  interface Message {
    from: string;
    to: string | string[];
    label: string;
    nodeId: string;
    visited: boolean;
    isCurrent: boolean;
  }

  function extractMessages(): Message[] {
    if (!$currentCFG) return [];

    const messages: Message[] = [];
    const visitedNodes = new Set($executionState?.visitedNodes || []);
    const currentNodeId = $executionState
      ? (typeof $executionState.currentNode === 'string'
          ? $executionState.currentNode
          : $executionState.currentNode[0])
      : null;

    // Extract messages from CFG action nodes
    for (const node of $currentCFG.nodes) {
      if (node.type === 'action' && node.action.kind === 'message') {
        const action = node.action as MessageAction;
        messages.push({
          from: action.from,
          to: action.to,
          label: action.message.label,
          nodeId: node.id,
          visited: visitedNodes.has(node.id),
          isCurrent: node.id === currentNodeId
        });
      }
    }

    return messages;
  }

  function renderSequenceDiagram() {
    if (!svgElement || !containerElement || !$currentCFG) return;

    // Clear existing visualization
    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement);
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    svg.attr('width', width).attr('height', height);

    // Create a container group for pan/zoom
    const container = svg.append('g').attr('class', 'zoom-container');

    // Set up zoom behavior
    zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4]) // Allow zoom from 10% to 400%
      .on('zoom', (event) => {
        currentTransform = event.transform;
        container.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);

    // Apply current transform (preserves zoom/pan between re-renders)
    container.attr('transform', currentTransform);

    const roles = $currentCFG.roles;
    const messages = extractMessages();

    // Use fixed starting position for consistent sizing
    // Don't cram lanes into viewport; use pan/zoom to navigate
    const startX = 100;

    // Calculate lane positions
    const laneX = new Map<string, number>();
    roles.forEach((role, i) => {
      laneX.set(role, startX + i * (LANE_WIDTH + LANE_MARGIN) + LANE_WIDTH / 2);
    });

    const diagramHeight = LANE_TOP_MARGIN + messages.length * MESSAGE_SPACING + 40;

    // Title
    container
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
      container
        .append('text')
        .attr('x', x)
        .attr('y', LANE_TOP_MARGIN - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('font-weight', 'bold')
        .attr('fill', '#4EC9B0')
        .text(role);

      // Lifeline
      container
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
      const y = LANE_TOP_MARGIN + index * MESSAGE_SPACING + MESSAGE_SPACING / 2;

      // Color based on status: current > visited > unvisited
      let strokeColor, strokeWidth, arrowMarker, labelColor, labelWeight, opacity;

      if (msg.isCurrent) {
        // Current message: bright yellow/orange with pulsing
        strokeColor = '#FFA500';
        strokeWidth = 4;
        arrowMarker = 'url(#arrowhead-current)';
        labelColor = '#FFA500';
        labelWeight = 'bold';
        opacity = 1;
      } else if (msg.visited) {
        // Visited message: green
        strokeColor = '#4EC9B0';
        strokeWidth = 3;
        arrowMarker = 'url(#arrowhead-visited)';
        labelColor = '#4EC9B0';
        labelWeight = 'bold';
        opacity = 1;
      } else {
        // Unvisited message: blue, dimmed
        strokeColor = '#007acc';
        strokeWidth = 2;
        arrowMarker = 'url(#arrowhead-blue)';
        labelColor = '#9CDCFE';
        labelWeight = 'normal';
        opacity = 0.6;
      }

      // Handle multicast: draw arrow to each recipient
      const recipients = Array.isArray(msg.to) ? msg.to : [msg.to];

      recipients.forEach(recipient => {
        const toX = laneX.get(recipient)!;

        // Message arrow
        const line = container
          .append('line')
          .attr('x1', fromX)
          .attr('y1', y)
          .attr('x2', toX)
          .attr('y2', y)
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('marker-end', arrowMarker)
          .attr('opacity', opacity);

        // Add pulsing animation for current message
        if (msg.isCurrent) {
          line
            .append('animate')
            .attr('attributeName', 'opacity')
            .attr('values', '1;0.5;1')
            .attr('dur', '1.5s')
            .attr('repeatCount', 'indefinite');
        }
      });

      // Message label (show once, centered)
      const firstRecipient = recipients[0];
      const toX = laneX.get(firstRecipient)!;
      const labelX = (fromX + toX) / 2;
      const labelY = y - 8;

      const label = container
        .append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('font-size', msg.isCurrent ? 13 : 12)
        .attr('fill', labelColor)
        .attr('font-weight', labelWeight)
        .text(msg.label);

      // Add pulsing animation for current message label
      if (msg.isCurrent) {
        label
          .append('animate')
          .attr('attributeName', 'opacity')
          .attr('values', '1;0.7;1')
          .attr('dur', '1.5s')
          .attr('repeatCount', 'indefinite');
      }
    });

    // Define arrowhead markers
    const defs = svg.append('defs');

    // Blue arrowhead for unvisited
    defs
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

    // Green arrowhead for visited
    defs
      .append('marker')
      .attr('id', 'arrowhead-visited')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 9)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#4EC9B0');

    // Orange arrowhead for current
    defs
      .append('marker')
      .attr('id', 'arrowhead-current')
      .attr('markerWidth', 12)
      .attr('markerHeight', 12)
      .attr('refX', 10)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 12 3, 0 6')
      .attr('fill', '#FFA500');
  }

  // Reset zoom to identity
  function resetZoom() {
    if (svgElement && zoomBehavior) {
      d3.select(svgElement)
        .transition()
        .duration(750)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    }
  }

  // Re-render on CFG or execution state change
  $: if ($currentCFG || $executionState) {
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
  {#if $parseStatus !== 'success' || !$currentCFG}
    <div class="placeholder">
      <h3>📊 CFG Sequence Diagram</h3>
      <p>Parse a protocol to see the message sequence diagram</p>
      <p class="note">Messages flow from top to bottom over time</p>
      <p class="note">🟠 Orange: Current message | 🟢 Green: Executed | 🔵 Blue: Pending</p>
    </div>
  {:else}
    <button class="reset-zoom-btn" on:click={resetZoom} title="Reset zoom">
      ⟲
    </button>
    <svg bind:this={svgElement}></svg>
  {/if}
</div>

<style>
  .sequence-diagram {
    width: 100%;
    height: 100%;
    background: #1e1e1e;
    overflow: hidden;
    position: relative;
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

  .reset-zoom-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    width: 32px;
    height: 32px;
    background: #3d3d3d;
    color: #ccc;
    border: 1px solid #555;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .reset-zoom-btn:hover {
    background: #4d4d4d;
    border-color: #007acc;
    color: #fff;
  }

  svg {
    display: block;
    cursor: grab;
  }

  svg:active {
    cursor: grabbing;
  }
</style>
