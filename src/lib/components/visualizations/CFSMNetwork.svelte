<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { projectionData, parseStatus } from '$lib/stores/editor';
  import { currentCFG, executionState } from '$lib/stores/simulation';
  import * as d3 from 'd3';
  import type { MessageAction } from '../../../core/cfg/types';

  let svgElement: SVGSVGElement;
  let containerElement: HTMLDivElement;
  let zoomBehavior: any = null;
  let currentTransform = d3.zoomIdentity;

  // Visualization dimensions
  const CFSM_WIDTH = 300;
  const CFSM_HEIGHT = 500;
  const CFSM_MARGIN = 100;
  const STATE_RADIUS = 20;
  const LAYER_SPACING = 80;
  const NODE_SPACING = 60;

  // Track state positions across all CFSMs for channel rendering
  const statePositions = new Map<string, { x: number; y: number; role: string }>();

  // Get currently active message from execution state
  function getCurrentMessage(): { from: string; to: string | string[]; label: string; nodeId: string } | null {
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
      label: action.message.label,
      nodeId: currentNodeId
    };
  }

  // Check if a specific transition matches the current execution point
  function isExactTransitionActive(projection: typeof $projectionData[0], transition: any): boolean {
    const currentMsg = getCurrentMessage();
    if (!currentMsg) return false;

    const transitionLabel = transition.label;
    const msgName = transitionLabel.replace(/^(send|recv) /, '');

    // Must match message name
    if (msgName !== currentMsg.label) return false;

    // For send transitions: must be from this role and FROM the transition's source state
    if (transitionLabel.startsWith('send ') && currentMsg.from === projection.role) {
      // Check if we're currently at the source state of this transition
      const currentNodeId = typeof $executionState.currentNode === 'string'
        ? $executionState.currentNode
        : $executionState.currentNode[0];
      // The transition should match if its "from" state is part of the current node ID
      return currentNodeId.includes(transition.from);
    }

    // For receive transitions: must be to this role and TO the transition's target state
    if (transitionLabel.startsWith('recv ')) {
      const isReceiver = currentMsg.to === projection.role ||
        (Array.isArray(currentMsg.to) && currentMsg.to.includes(projection.role));

      if (isReceiver) {
        // Similar check for receive side
        const currentNodeId = typeof $executionState.currentNode === 'string'
          ? $executionState.currentNode
          : $executionState.currentNode[0];
        return currentNodeId.includes(transition.from);
      }
    }

    return false;
  }

  // Check if a state has been visited
  function isStateVisited(stateId: string): boolean {
    if (!$executionState) return false;
    return $executionState.visitedNodes.some(nodeId => nodeId.includes(stateId));
  }

  // Check if currently AT a state (not executing FROM it)
  function isStateAtCurrent(stateId: string): boolean {
    if (!$executionState) return false;

    const currentNodeId = typeof $executionState.currentNode === 'string'
      ? $executionState.currentNode
      : $executionState.currentNode[0];

    return currentNodeId.includes(stateId);
  }

  // Check if state is the SOURCE of an active transition
  function isStateSource(projection: typeof $projectionData[0], stateId: string): boolean {
    if (!$executionState) return false;

    for (const transition of projection.transitions) {
      if (isExactTransitionActive(projection, transition) && transition.from === stateId) {
        return true;
      }
    }

    return false;
  }

  // Check if state is the TARGET of an active transition
  function isStateTarget(projection: typeof $projectionData[0], stateId: string): boolean {
    if (!$executionState) return false;

    for (const transition of projection.transitions) {
      if (isExactTransitionActive(projection, transition) && transition.to === stateId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compute hierarchical layout for CFSM states
   * Uses layer assignment based on longest path from initial state
   */
  function computeHierarchicalLayout(projection: typeof $projectionData[0]) {
    const states = projection.states;
    const transitions = projection.transitions;

    // Build adjacency graph
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();

    states.forEach(s => {
      outgoing.set(s, []);
      incoming.set(s, []);
    });

    transitions.forEach(t => {
      outgoing.get(t.from)?.push(t.to);
      incoming.get(t.to)?.push(t.from);
    });

    // Assign layers using BFS from initial state
    const layers = new Map<string, number>();
    const queue: Array<{ state: string; layer: number }> = [];
    const visited = new Set<string>(); // Track visited states to prevent infinite loops

    if (states.length > 0) {
      queue.push({ state: states[0], layer: 0 });
      layers.set(states[0], 0);
      visited.add(states[0]);
    }

    while (queue.length > 0) {
      const { state, layer } = queue.shift()!;

      for (const next of outgoing.get(state) || []) {
        if (!visited.has(next)) {
          // First time visiting this state
          layers.set(next, layer + 1);
          visited.add(next);
          queue.push({ state: next, layer: layer + 1 });
        } else {
          // Already visited - just update layer if we found a longer path
          const currentLayer = layers.get(next)!;
          const newLayer = layer + 1;
          if (newLayer > currentLayer) {
            layers.set(next, newLayer);
          }
        }
      }
    }

    // Handle unreachable states (shouldn't happen in verified protocols)
    states.forEach((s, i) => {
      if (!layers.has(s)) {
        layers.set(s, i);
      }
    });

    // Group states by layer
    const layerGroups = new Map<number, string[]>();
    layers.forEach((layer, state) => {
      if (!layerGroups.has(layer)) {
        layerGroups.set(layer, []);
      }
      layerGroups.get(layer)!.push(state);
    });

    // Compute positions
    const positions = new Map<string, { x: number; y: number }>();
    const maxLayer = Math.max(...Array.from(layers.values()));

    layerGroups.forEach((statesInLayer, layer) => {
      const layerY = layer * LAYER_SPACING;
      const layerWidth = statesInLayer.length * NODE_SPACING;
      const startX = (CFSM_WIDTH - layerWidth) / 2 + NODE_SPACING / 2;

      statesInLayer.forEach((state, i) => {
        positions.set(state, {
          x: startX + i * NODE_SPACING,
          y: layerY
        });
      });
    });

    return positions;
  }

  function renderCFSMNetwork() {
    if (!svgElement || !containerElement || $projectionData.length === 0) return;

    // Clear existing visualization
    d3.select(svgElement).selectAll('*').remove();
    statePositions.clear();

    const svg = d3.select(svgElement);
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    svg.attr('width', width).attr('height', height);

    // Create a container group for pan/zoom
    const container = svg.append('g').attr('class', 'zoom-container');

    // Set up zoom behavior
    zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        currentTransform = event.transform;
        container.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    container.attr('transform', currentTransform);

    const startX = CFSM_MARGIN;

    // Define markers
    const defs = svg.append('defs');

    // Standard arrowhead
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#666');

    // Active transition arrowhead (green)
    defs.append('marker')
      .attr('id', 'arrowhead-active')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#4EC9B0');

    // Channel arrowhead (purple)
    defs.append('marker')
      .attr('id', 'arrowhead-channel')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 8)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', '#C586C0');

    // Render message channels FIRST (behind CFSMs)
    renderChannels(container);

    // Render each CFSM
    $projectionData.forEach((projection, index) => {
      const cfsmX = startX + index * (CFSM_WIDTH + CFSM_MARGIN);
      const cfsmY = 60;

      renderCFSM(container, projection, cfsmX, cfsmY, index);
    });
  }

  function renderCFSM(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    projection: typeof $projectionData[0],
    x: number,
    y: number,
    cfsmIndex: number
  ) {
    const g = container.append('g').attr('transform', `translate(${x}, ${y})`);

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

    // Compute hierarchical layout
    const localStatePositions = computeHierarchicalLayout(projection);

    // Store global positions for channel rendering
    localStatePositions.forEach((pos, state) => {
      statePositions.set(`${projection.role}:${state}`, {
        x: x + pos.x,
        y: y + pos.y,
        role: projection.role
      });
    });

    // Render transitions
    const transitionsGroup = g.append('g').attr('class', 'transitions');

    projection.transitions.forEach(t => {
      const from = localStatePositions.get(t.from);
      const to = localStatePositions.get(t.to);
      if (!from || !to) return;

      const isActive = isExactTransitionActive(projection, t);
      const strokeColor = isActive ? '#4EC9B0' : '#666';
      const strokeWidth = isActive ? 2.5 : 1.5;
      const labelColor = isActive ? '#4EC9B0' : '#9CDCFE';
      const labelWeight = isActive ? 'bold' : 'normal';
      const marker = isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)';

      if (t.from === t.to) {
        // Self-loop
        const loopRadius = 30;
        const path = `M ${from.x},${from.y - STATE_RADIUS}
                      C ${from.x + loopRadius},${from.y - loopRadius}
                        ${from.x + loopRadius},${from.y + loopRadius}
                        ${from.x},${from.y + STATE_RADIUS}`;

        transitionsGroup
          .append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('marker-end', marker);

        transitionsGroup
          .append('text')
          .attr('x', from.x + loopRadius + 10)
          .attr('y', from.y)
          .attr('font-size', 11)
          .attr('fill', labelColor)
          .attr('font-weight', labelWeight)
          .text(truncateLabel(t.label));
      } else {
        // Regular transition
        const dy = to.y - from.y;
        const dx = to.x - from.x;
        const angle = Math.atan2(dy, dx);

        const startX = from.x + STATE_RADIUS * Math.cos(angle);
        const startY = from.y + STATE_RADIUS * Math.sin(angle);
        const endX = to.x - STATE_RADIUS * Math.cos(angle);
        const endY = to.y - STATE_RADIUS * Math.sin(angle);

        // Use curved path for better layout
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        // Add curve offset for parallel edges
        const curveOffset = 20;
        const perpAngle = angle + Math.PI / 2;
        const ctrlX = midX + curveOffset * Math.cos(perpAngle);
        const ctrlY = midY + curveOffset * Math.sin(perpAngle);

        const path = `M ${startX},${startY} Q ${ctrlX},${ctrlY} ${endX},${endY}`;

        transitionsGroup
          .append('path')
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', strokeColor)
          .attr('stroke-width', strokeWidth)
          .attr('marker-end', marker);

        transitionsGroup
          .append('text')
          .attr('x', ctrlX)
          .attr('y', ctrlY)
          .attr('font-size', 11)
          .attr('fill', labelColor)
          .attr('font-weight', labelWeight)
          .attr('text-anchor', 'middle')
          .text(truncateLabel(t.label));
      }
    });

    // Render states on top
    const statesGroup = g.append('g').attr('class', 'states');

    projection.states.forEach((state, i) => {
      const pos = localStatePositions.get(state);
      if (!pos) return;

      const isInitial = i === 0;
      const isFinal = i === projection.states.length - 1;
      const isVisited = isStateVisited(state);
      const isAtState = isStateAtCurrent(state);
      const isSource = isStateSource(projection, state);
      const isTarget = isStateTarget(projection, state);

      // Determine state styling based on separate concerns
      let fillColor = '#2d2d2d';
      let strokeColor = '#666';
      let strokeWidth = 2;

      if (isAtState) {
        // Currently AT this state (idle here)
        fillColor = '#2d5f2d';
        strokeColor = '#90ee90';
        strokeWidth = 3;
      } else if (isSource || isTarget) {
        // Executing FROM or TO this state
        fillColor = '#2d5f5f';
        strokeColor = '#4EC9B0';
        strokeWidth = 3;
      } else if (isVisited) {
        // Visited but not current
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
        .attr('cx', pos.x)
        .attr('cy', pos.y)
        .attr('r', STATE_RADIUS)
        .attr('fill', fillColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth);

      // Pulse animation for active state
      if (isAtState || isSource || isTarget) {
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
        .attr('x', pos.x)
        .attr('y', pos.y + 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', (isAtState || isSource || isTarget) ? '#4EC9B0' : '#fff')
        .attr('font-weight', (isAtState || isSource || isTarget) ? 'bold' : 'normal')
        .text(state);
    });
  }

  /**
   * Render message channels between CFSMs
   * Only shows channels for the EXACT active send/receive transitions
   */
  function renderChannels(container: d3.Selection<SVGGElement, unknown, null, undefined>) {
    if (!$currentCFG) return;

    const currentMsg = getCurrentMessage();
    if (!currentMsg) return;

    // Find the exact send transition that's active
    const senderProj = $projectionData.find(p => p.role === currentMsg.from);
    if (!senderProj) return;

    const sendTransition = senderProj.transitions.find(t =>
      t.label === `send ${currentMsg.label}` &&
      isExactTransitionActive(senderProj, t)
    );

    if (!sendTransition) return;

    // Get sender state position
    const sendFromPos = statePositions.get(`${currentMsg.from}:${sendTransition.from}`);
    if (!sendFromPos) return;

    // For each receiver
    const receivers = Array.isArray(currentMsg.to) ? currentMsg.to : [currentMsg.to];

    receivers.forEach(receiver => {
      const recvProj = $projectionData.find(p => p.role === receiver);
      if (!recvProj) return;

      // Find the exact receive transition
      const recvTransition = recvProj.transitions.find(t =>
        t.label === `recv ${currentMsg.label}` &&
        isExactTransitionActive(recvProj, t)
      );

      if (!recvTransition) return;

      // Get receiver state position
      const recvToPos = statePositions.get(`${receiver}:${recvTransition.to}`);
      if (!recvToPos) return;

      // Draw channel with message in transit
      drawMessageChannel(container, sendFromPos, recvToPos, currentMsg.label);
    });
  }

  /**
   * Draw a message channel showing FIFO buffer visualization
   */
  function drawMessageChannel(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    from: { x: number; y: number },
    to: { x: number; y: number },
    label: string
  ) {
    const channelGroup = container.append('g').attr('class', 'channel');

    // Calculate channel line position
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    // Draw dashed line representing the channel/buffer
    channelGroup
      .append('line')
      .attr('x1', from.x)
      .attr('y1', from.y)
      .attr('x2', to.x)
      .attr('y2', to.y)
      .attr('stroke', '#C586C0')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.7);

    // Channel label
    channelGroup
      .append('text')
      .attr('x', midX)
      .attr('y', midY - 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#C586C0')
      .attr('font-weight', 'bold')
      .text(label);

    // Message in buffer (static for now, represents message in FIFO queue)
    channelGroup
      .append('circle')
      .attr('cx', midX)
      .attr('cy', midY)
      .attr('r', 6)
      .attr('fill', '#C586C0')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    // Pulsing animation on the message
    channelGroup
      .append('circle')
      .attr('cx', midX)
      .attr('cy', midY)
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', '#C586C0')
      .attr('stroke-width', 2)
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', '6;12;6')
      .attr('dur', '1.5s')
      .attr('repeatCount', 'indefinite');
  }

  function truncateLabel(label: string, maxLength = 15): string {
    if (label.length <= maxLength) return label;
    return label.substring(0, maxLength - 3) + '...';
  }

  function resetZoom() {
    if (svgElement && zoomBehavior) {
      d3.select(svgElement)
        .transition()
        .duration(750)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    }
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
    <button class="reset-zoom-btn" on:click={resetZoom} title="Reset zoom">
      ⟲
    </button>
    <svg bind:this={svgElement}></svg>
  {/if}
</div>

<style>
  .cfsm-network {
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
