"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraph = createGraph;
exports.addNode = addNode;
exports.addEdge = addEdge;
function createGraph() {
    return { nodes: [], edges: [] };
}
function addNode(graph, node) {
    if (!graph.nodes.includes(node)) {
        graph.nodes.push(node);
    }
}
function addEdge(graph, edge) {
    graph.edges.push(edge);
    addNode(graph, edge.from);
    addNode(graph, edge.to);
}
