import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { CFG, Node as CFGNode, Edge as CFGEdge } from '../src/core/cfg/types';

interface CfgVisualizerProps {
  cfg: CFG;
  currentNode?: string | string[]; // Current node(s) during execution
  visitedNodes?: string[]; // All visited nodes
  highlightPath?: boolean; // Whether to highlight visited path
}

const CfgVisualizer: React.FC<CfgVisualizerProps> = ({
  cfg,
  currentNode,
  visitedNodes = [],
  highlightPath = true,
}) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !cfg) return;

    const svg = d3.select(ref.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = ref.current.parentElement?.clientWidth || 800;
    const height = ref.current.parentElement?.clientHeight || 600;
    svg.attr('width', width).attr('height', height);

    // Prepare nodes for D3
    const nodes = cfg.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: getNodeLabel(node),
      ...node,
    }));

    // Prepare edges for D3
    const edges = cfg.edges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      type: edge.type,
      label: edge.label || '',
    }));

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        'link',
        d3
          .forceLink(edges)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const g = svg.append('g');

    // Add zoom and pan
    const zoom = d3.zoom().on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    svg.call(zoom as any);

    // Define arrowhead markers for different states
    const defs = svg.append('defs');

    // Normal arrowhead
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#999');

    // Highlighted arrowhead
    defs
      .append('marker')
      .attr('id', 'arrowhead-highlight')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#3b82f6');

    // Current execution arrowhead
    defs
      .append('marker')
      .attr('id', 'arrowhead-current')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#f59e0b');

    // Helper to check if node is current
    const isCurrentNode = (nodeId: string): boolean => {
      if (!currentNode) return false;
      if (Array.isArray(currentNode)) {
        return currentNode.includes(nodeId);
      }
      return currentNode === nodeId;
    };

    // Helper to check if node is visited
    const isVisitedNode = (nodeId: string): boolean => {
      return visitedNodes.includes(nodeId);
    };

    // Helper to check if edge is in execution path
    const isExecutionEdge = (edge: any): boolean => {
      if (!highlightPath) return false;
      const sourceIndex = visitedNodes.indexOf(edge.source.id);
      const targetIndex = visitedNodes.indexOf(edge.target.id);
      return sourceIndex >= 0 && targetIndex === sourceIndex + 1;
    };

    // Draw edges
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke-width', (d: any) => {
        if (isCurrentNode(d.target)) return 3;
        if (isExecutionEdge(d)) return 2.5;
        return 2;
      })
      .attr('stroke', (d: any) => {
        if (isCurrentNode(d.target)) return '#f59e0b';
        if (isExecutionEdge(d)) return '#3b82f6';
        return '#999';
      })
      .attr('marker-end', (d: any) => {
        if (isCurrentNode(d.target)) return 'url(#arrowhead-current)';
        if (isExecutionEdge(d)) return 'url(#arrowhead-highlight)';
        return 'url(#arrowhead)';
      })
      .attr('opacity', (d: any) => {
        if (isCurrentNode(d.target) || isExecutionEdge(d)) return 1;
        if (highlightPath && visitedNodes.length > 0) return 0.3;
        return 0.6;
      });

    // Draw edge labels
    const linkText = g
      .append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(edges)
      .enter()
      .append('text')
      .text((d: any) => d.label)
      .attr('fill', '#aaa')
      .attr('font-size', '10px')
      .attr('text-anchor', 'middle');

    // Draw nodes
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(drag(simulation) as any);

    // Node circles
    node
      .append('circle')
      .attr('r', (d: any) => {
        if (d.type === 'initial' || d.type === 'terminal') return 10;
        if (isCurrentNode(d.id)) return 12;
        return 8;
      })
      .attr('fill', (d: any) => {
        if (isCurrentNode(d.id)) return '#f59e0b'; // Amber for current
        if (d.type === 'initial') return '#22c55e'; // Green for start
        if (d.type === 'terminal') return '#ef4444'; // Red for end
        if (d.type === 'branch') return '#a855f7'; // Purple for branch
        if (d.type === 'merge') return '#8b5cf6'; // Purple for merge
        if (d.type === 'fork') return '#06b6d4'; // Cyan for fork
        if (d.type === 'join') return '#0891b2'; // Cyan for join
        if (d.type === 'recursive') return '#f97316'; // Orange for recursion
        if (isVisitedNode(d.id)) return '#3b82f6'; // Blue for visited
        return '#6b7280'; // Gray for unvisited
      })
      .attr('stroke', (d: any) => {
        if (isCurrentNode(d.id)) return '#fbbf24';
        return 'none';
      })
      .attr('stroke-width', 3)
      .attr('opacity', (d: any) => {
        if (isCurrentNode(d.id) || d.type === 'initial' || d.type === 'terminal') return 1;
        if (highlightPath && visitedNodes.length > 0 && !isVisitedNode(d.id)) return 0.3;
        return 1;
      });

    // Pulsing animation for current node
    node
      .filter((d: any) => isCurrentNode(d.id))
      .append('circle')
      .attr('r', 12)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('opacity', 0)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr('r', 20)
      .attr('opacity', 0.8)
      .attr('stroke-width', 0)
      .on('end', function repeat() {
        d3.select(this)
          .attr('r', 12)
          .attr('opacity', 0)
          .attr('stroke-width', 2)
          .transition()
          .duration(1500)
          .ease(d3.easeLinear)
          .attr('r', 20)
          .attr('opacity', 0.8)
          .attr('stroke-width', 0)
          .on('end', repeat);
      });

    // Node labels
    node
      .append('text')
      .text((d: any) => d.label)
      .attr('x', 15)
      .attr('y', 4)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .attr('font-weight', (d: any) => (isCurrentNode(d.id) ? 'bold' : 'normal'));

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkText
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag handler
    function drag(simulation: any) {
      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [cfg, currentNode, visitedNodes, highlightPath]);

  return <svg ref={ref}></svg>;
};

// Helper function to get node label
function getNodeLabel(node: CFGNode): string {
  switch (node.type) {
    case 'initial':
      return 'START';
    case 'terminal':
      return 'END';
    case 'action':
      if ('action' in node) {
        const action = node.action;
        if (action.kind === 'message') {
          return `${action.from}→${action.to}`;
        }
        if (action.kind === 'subprotocol') {
          return `do ${action.protocol}`;
        }
        return action.kind;
      }
      return 'action';
    case 'branch':
      return 'choice' in node ? `choice@${(node as any).at}` : 'branch';
    case 'merge':
      return 'merge';
    case 'fork':
      return 'fork';
    case 'join':
      return 'join';
    case 'recursive':
      return 'label' in node ? `rec ${(node as any).label}` : 'rec';
    default:
      return node.type;
  }
}

export default CfgVisualizer;
