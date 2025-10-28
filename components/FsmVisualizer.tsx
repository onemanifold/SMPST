import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { FsmGraph } from '../types';

interface FsmVisualizerProps {
    graph: FsmGraph;
}

const FsmVisualizer: React.FC<FsmVisualizerProps> = ({ graph }) => {
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

        // Arrowhead marker
        svg.append("defs").append("marker")
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

        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graph.edges)
            .enter().append("line")
            .attr("stroke-width", 2)
            .attr("stroke", "#999")
            .attr("marker-end", "url(#arrowhead)");

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
            .attr("r", (d: any) => d.isStartState || d.isEndState ? 8 : 5)
            .attr("fill", (d: any) => d.isStartState ? '#22c55e' : (d.isEndState ? '#ef4444' : '#3b82f6'))
            .call(drag(simulation) as any);

        node.append("text")
            .text((d: any) => d.label)
            .attr("x", 12)
            .attr("y", 4)
            .attr("fill", "white")
            .style('font-size', '12px');

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

    }, [graph]);

    return (
        <svg ref={ref}></svg>
    );
};

export default FsmVisualizer;
