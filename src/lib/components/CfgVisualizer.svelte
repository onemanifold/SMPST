<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import type { CFG, Node as CFGNode, Edge as CFGEdge } from '../../core/cfg/types';

  export let cfg: CFG | null = null;
  export let currentNode: string | string[] | undefined = undefined;
  export let visitedNodes: string[] = [];
  export let highlightPath: boolean = true;

  let svgElement: SVGSVGElement;
  let simulation: d3.Simulation<any, any>;

  function getNodeLabel(node: CFGNode): string {
    // ... (same helper function as in the React component)
    return '...';
  }

  function drawChart() {
    if (!svgElement || !cfg) return;

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();

    const width = svgElement.parentElement?.clientWidth || 800;
    const height = svgElement.parentElement?.clientHeight || 600;
    svg.attr('width', width).attr('height', height);

    const nodes = cfg.nodes.map(node => ({ ...node, id: node.id }));
    const links = cfg.edges.map(edge => ({ source: edge.from, target: edge.to, ...edge }));

    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const g = svg.append("g");

    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke-width", 2)
      .attr("stroke", "#999");

    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g");

    node.append("circle")
      .attr("r", 8)
      .attr("fill", "#6b7280");

    node.append("text")
      .text((d: any) => d.id)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', 'white')
      .style('font-size', '12px');

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  onMount(() => {
    drawChart();
  });

  afterUpdate(() => {
    // This is where we'll update the visualization when props change,
    // for now, we'll just redraw the whole thing.
    drawChart();
  });
</script>

<div class="w-full h-full">
  <svg bind:this={svgElement} class="w-full h-full"></svg>
</div>
