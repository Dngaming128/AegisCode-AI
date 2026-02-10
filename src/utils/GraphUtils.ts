export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
}

export interface Graph {
  nodes: string[];
  edges: GraphEdge[];
}

export function createGraph(): Graph {
  return { nodes: [], edges: [] };
}

export function addNode(graph: Graph, node: string): void {
  if (!graph.nodes.includes(node)) {
    graph.nodes.push(node);
  }
}

export function addEdge(graph: Graph, edge: GraphEdge): void {
  graph.edges.push(edge);
  addNode(graph, edge.from);
  addNode(graph, edge.to);
}
