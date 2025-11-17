import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { FsmGraph } from '../types';

interface FsmVisualizerProps {
    graph: FsmGraph;
    currentState?: string; // Current state during execution
    visitedStates?: string[]; // All visited states
    highlightPath?: boolean; // Whether to highlight visited path
}

const FsmVisualizer: React.FC<FsmVisualizerProps> = ({
    graph,
    currentState,
    visitedStates = [],
    highlightPath = true
}) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!ref.current || !graph) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove(); // Clear previous render

        const width = ref.current.parentElement?.clientWidth || 800;
        const height = ref.current.parentElement?.clientHeight || 600;
        svg.attr('width', width).attr('height', height);

        const simulation = d3.forceSimulation(graph.nodes as any)
            .force("link", d3.forceLink(graph.edges).id((d: any) => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const g = svg.append("g");

        // Arrowhead markers
        const defs = svg.append("defs");

        defs.append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "-0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("xoverflow", "visible")
            .append("svg:path")
            .attr("d", "M 0,-5 L 10 ,0 L 0,5")
            .attr("fill", "#999")
            .style("stroke", "none");

        defs.append("marker")
            .attr("id", "arrowhead-highlight")
            .attr("viewBox", "-0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .append("svg:path")
            .attr("d", "M 0,-5 L 10 ,0 L 0,5")
            .attr("fill", "#3b82f6")
            .style("stroke", "none");

        defs.append("marker")
            .attr("id", "arrowhead-current")
            .attr("viewBox", "-0 -5 10 10")
            .attr("refX", 25)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .append("svg:path")
            .attr("d", "M 0,-5 L 10 ,0 L 0,5")
            .attr("fill", "#f59e0b")
            .style("stroke", "none");

        // Helper functions
        const isCurrentState = (stateId: string) => currentState === stateId;
        const isVisitedState = (stateId: string) => visitedStates.includes(stateId);
        const isExecutionEdge = (edge: any) => {
            if (!highlightPath) return false;
            const sourceIndex = visitedStates.indexOf(edge.source.id);
            const targetIndex = visitedStates.indexOf(edge.target.id);
            return sourceIndex >= 0 && targetIndex === sourceIndex + 1;
        };

        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.edges)
            .enter().append("line")
            .attr("stroke-width", (d: any) => {
                if (isCurrentState(d.target)) return 3;
                if (isExecutionEdge(d)) return 2.5;
                return 2;
            })
            .attr("stroke", (d: any) => {
                if (isCurrentState(d.target)) return '#f59e0b';
                if (isExecutionEdge(d)) return '#3b82f6';
                return '#999';
            })
            .attr("marker-end", (d: any) => {
                if (isCurrentState(d.target)) return 'url(#arrowhead-current)';
                if (isExecutionEdge(d)) return 'url(#arrowhead-highlight)';
                return 'url(#arrowhead)';
            })
            .attr("opacity", (d: any) => {
                if (isCurrentState(d.target) || isExecutionEdge(d)) return 1;
                if (highlightPath && visitedStates.length > 0) return 0.3;
                return 0.6;
            });

        const linkText = g.append("g")
            .attr("class", "link-labels")
            .selectAll("text")
            .data(graph.edges)
            .enter().append("text")
            .text((d: any) => d.label)
            .attr('fill', '#aaa')
            .style('font-size', '10px');

        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(graph.nodes)
            .enter().append("g");

        node.append("circle")
            .attr("r", (d: any) => {
                if (isCurrentState(d.id)) return 10;
                if (d.isStartState || d.isEndState) return 8;
                return 5;
            })
            .attr("fill", (d: any) => {
                if (isCurrentState(d.id)) return '#f59e0b'; // Amber for current
                if (d.isStartState) return '#22c55e'; // Green for start
                if (d.isEndState) return '#ef4444'; // Red for end
                if (isVisitedState(d.id)) return '#3b82f6'; // Blue for visited
                return '#6b7280'; // Gray for unvisited
            })
            .attr("stroke", (d: any) => isCurrentState(d.id) ? '#fbbf24' : 'none')
            .attr("stroke-width", 3)
            .attr("opacity", (d: any) => {
                if (isCurrentState(d.id) || d.isStartState || d.isEndState) return 1;
                if (highlightPath && visitedStates.length > 0 && !isVisitedState(d.id)) return 0.3;
                return 1;
            })
            .call(drag(simulation) as any);

        // Add pulsing animation for current state
        node.filter((d: any) => isCurrentState(d.id))
            .append("circle")
            .attr("r", 10)
            .attr("fill", "none")
            .attr("stroke", "#f59e0b")
            .attr("stroke-width", 2)
            .attr("opacity", 0)
            .transition()
            .duration(1500)
            .ease(d3.easeLinear)
            .attr("r", 18)
            .attr("opacity", 0.8)
            .attr("stroke-width", 0)
            .on("end", function repeat() {
                d3.select(this)
                    .attr("r", 10)
                    .attr("opacity", 0)
                    .attr("stroke-width", 2)
                    .transition()
                    .duration(1500)
                    .ease(d3.easeLinear)
                    .attr("r", 18)
                    .attr("opacity", 0.8)
                    .attr("stroke-width", 0)
                    .on("end", repeat);
            });

        node.append("text")
            .text((d: any) => d.label)
            .attr("x", 12)
            .attr("y", 4)
            .attr("fill", "white")
            .style('font-size', '12px')
            .attr("font-weight", (d: any) => isCurrentState(d.id) ? 'bold' : 'normal');

        simulation.on("tick", () => {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);

            linkText
                .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
                .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

            node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        // Pan and zoom
        const zoom = d3.zoom().on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
        svg.call(zoom as any);

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
            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }

        return () => {
            simulation.stop();
        };
    }, [graph, currentState, visitedStates, highlightPath]);

    return (
        <svg ref={ref}></svg>
    );
};

export default FsmVisualizer;
