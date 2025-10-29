import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { html } from '../ht-element.js';

const FsmVisualizer = ({ graph, currentNodeId }) => {
    const ref = useRef(null);

    useEffect(() => {
        if (!ref.current || !graph || graph.nodes.length === 0) return;

        // ... (D3 logic remains the same)
        const ranks = {};
        let maxRank = 0;

        function calculateRank(nodeId, rank) {
            if (ranks[nodeId] === undefined || ranks[nodeId] < rank) {
                ranks[nodeId] = rank;
                maxRank = Math.max(maxRank, rank);
                const outgoingEdges = graph.edges.filter(e => e.source === nodeId);
                outgoingEdges.forEach(edge => calculateRank(edge.target, rank + 1));
            }
        }
        const startNode = graph.nodes.find(n => n.isStartState);
        if (startNode) calculateRank(startNode.id, 0);

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();
        const width = ref.current.parentElement?.clientWidth || 800;
        const height = ref.current.parentElement?.clientHeight || 600;
        const ySpacing = height / (maxRank + 1);
        svg.attr('width', width).attr('height', height);

        const nodes = graph.nodes.map(n => ({ ...n, y: ranks[n.id] * ySpacing + 20, fx: null, fy: ranks[n.id] * ySpacing + 20 }));

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(graph.edges).id((d) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("x", d3.forceX(width / 2).strength(0.1));

        const g = svg.append("g");
        svg.append("defs").append("marker").attr("id", "arrowhead").attr("viewBox", "-0 -5 10 10").attr("refX", 25).attr("refY", 0).attr("orient", "auto").attr("markerWidth", 8).attr("markerHeight", 8).append("path").attr("d", "M 0,-5 L 10 ,0 L 0,5").attr("fill", "#999");

        const link = g.append("g").selectAll("line").data(graph.edges).join("line").attr("stroke-width", 2).attr("stroke", "#999").attr("marker-end", "url(#arrowhead)");
        const linkText = g.append("g").selectAll("text").data(graph.edges).join("text").text((d) => d.label).attr('fill', '#aaa').style('font-size', '10px');
        const node = g.append("g").selectAll("g").data(nodes).join("g");

        node.append("circle").attr("r", (d) => d.isStartState || d.isEndState ? 8 : 5)
            .attr("fill", (d) => {
                if (d.id === currentNodeId) return '#facc15'; // Yellow for current state
                return d.isStartState ? '#22c55e' : (d.isEndState ? '#ef4444' : '#3b82f6');
            })
            .call(d3.drag().on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; }).on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; if (ranks[d.id] !== undefined) d.fy = ranks[d.id] * ySpacing + 20; }));
        node.append("text").text((d) => d.label).attr("x", 12).attr("y", 4).attr("fill", "white").style('font-size', '12px');

        simulation.on("tick", () => {
            node.each((d) => { d.y = d.fy; }); // Enforce y position
            link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
            linkText.attr("x", (d) => (d.source.x + d.target.x) / 2).attr("y", (d) => (d.source.y + d.target.y) / 2);
            node.attr("transform", (d) => `translate(${d.x},${d.y})`);
        });

        svg.call(d3.zoom().on("zoom", (e) => g.attr("transform", e.transform)));
    }, [graph, currentNodeId]);

    return html`<svg ref=${ref}></svg>`;
};

export default FsmVisualizer;
