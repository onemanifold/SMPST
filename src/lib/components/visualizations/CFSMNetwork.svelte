<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import { currentCFG, executionState } from '$lib/stores/simulation';
  import * as d3 from 'd3';
  import type { MessageAction } from '../../../core/cfg/types';

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;

  // Visualization dimensions
  const CFSM_WIDTH = 250;
  const CFSM_HEIGHT = 400;
  const CFSM_MARGIN = 40;
  const STATE_RADIUS = 20;

  // Get currently active message from execution state
  function getCurrentMessage(): { from: string; to: string | string[]; label: string } | null {
    if (!$currentCFG || !$executionState) return null;

    const currentNodeId = typeof $executionState.currentNode === 'string'
      ? $executionState.currentNode
      : $executionState.currentNode[0];

    const node = $currentCFG.nodes.find(n => n.id === currentNodeId);
    if (!node || node.type !== 'action' || node.action.kind !== 'message') {
      return null;
    }

    const action = node.action as MessageAction;
    return {
      from: action.from,
      to: action.to,
      label: action.message.label
    };
  }

  // Check if a transition is currently active
  function isTransitionActive(projection: typeof $projectionData[0], transition: any): boolean {
    const currentMsg = getCurrentMessage();
    if (!currentMsg) return false;

    // Check if this transition matches the current message
    const transitionLabel = transition.label;

    // For send transitions
    if (transitionLabel.includes('send ') && currentMsg.from === projection.role) {
      const msgName = transitionLabel.replace('send ', '');
      return msgName === currentMsg.label;
    }

    // For receive transitions
    if (transitionLabel.includes('recv ') && (
      currentMsg.to === projection.role ||
      (Array.isArray(currentMsg.to) && currentMsg.to.includes(projection.role))
    )) {
      const msgName = transitionLabel.replace('recv ', '');
      return msgName === currentMsg.label;
    }

    return false;
  }

  // Check if a state has been visited
  function isStateVisited(stateId: string): boolean {
    if (!$executionState) return false;
    return $executionState.visitedNodes.some(nodeId => nodeId.includes(stateId));
  }

  // Check if a state is currently active
  function isStateCurrent(stateId: string): boolean {
    if (!$executionState) return false;
    const currentNodeId = typeof $executionState.currentNode === 'string'
      ? $executionState.currentNode
      : $executionState.currentNode[0];
    return currentNodeId.includes(stateId);
  }

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

      // Check if this transition is currently active
      const isActive = isTransitionActive(projection, t);
      const strokeColor = isActive ? '#4EC9B0' : '#666';
      const strokeWidth = isActive ? 2.5 : 1.5;
      const labelColor = isActive ? '#4EC9B0' : '#9CDCFE';
      const labelWeight = isActive ? 'bold' : 'normal';

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
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('marker-end', 'url(#arrowhead)');

        // Label for self-loop
        transitionsGroup
          .append('text')
          .attr('x', x1 + loopRadius + 10)
          .attr('y', y1)
          .attr('font-size', 11)
          .attr('fill', labelColor)
          .attr('font-weight', labelWeight)
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
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('marker-end', 'url(#arrowhead)');

        // Label
        transitionsGroup
          .append('text')
          .attr('x', (startX + endX) / 2 + 10)
          .attr('y', (startY + endY) / 2)
          .attr('font-size', 11)
          .attr('fill', labelColor)
          .attr('font-weight', labelWeight)
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
      const isVisited = isStateVisited(state);
      const isCurrent = isStateCurrent(state);

      // Determine state styling
      let fillColor = '#2d2d2d';
      let strokeColor = '#666';
      let strokeWidth = 2;

      if (isCurrent) {
        // Current state: pulsing green
        fillColor = '#2d5f2d';
        strokeColor = '#4EC9B0';
        strokeWidth = 3;
      } else if (isVisited) {
        // Visited state: darker with green tint
        fillColor = '#2d4d3d';
        strokeColor = '#4EC9B0';
        strokeWidth = 2;
      } else if (isInitial) {
        fillColor = '#2d5f2d';
        strokeColor = '#90ee90';
      } else if (isFinal) {
        fillColor = '#5f2d2d';
        strokeColor = '#ff6b6b';
      }

      // State circle
      const circle = statesGroup
        .append('circle')
        .attr('cx', xPos)
        .attr('cy', yPos)
        .attr('r', STATE_RADIUS)
        .attr('fill', fillColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth);

      // Add pulsing animation for current state
      if (isCurrent) {
        circle
          .append('animate')
          .attr('attributeName', 'stroke-width')
          .attr('values', `${strokeWidth};${strokeWidth + 2};${strokeWidth}`)
          .attr('dur', '1.5s')
          .attr('repeatCount', 'indefinite');
      }

      // State label
      statesGroup
        .append('text')
        .attr('x', xPos)
        .attr('y', yPos + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', isCurrent ? '#4EC9B0' : '#fff')
        .attr('font-weight', isCurrent ? 'bold' : 'normal')
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

  // Re-render on data change, execution state change, or window resize
  $: if ($projectionData || $executionState) {
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
