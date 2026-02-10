import ts from "typescript";
import { Logger } from "../core/Logger";
import { RepoSnapshot } from "../analysis/RepoScanner";
import { Graph, addEdge, createGraph } from "../utils/GraphUtils";

export class DataFlowGraphBuilder {
  constructor(private logger: Logger) {}

  build(snapshot: RepoSnapshot): Graph {
    const graph = createGraph();
    const checker = snapshot.program.getTypeChecker();
    const declarationMap = new Map<ts.Symbol, ts.Node>();

    for (const sourceFile of snapshot.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
          const symbol = checker.getSymbolAtLocation(node.name);
          if (symbol) {
            declarationMap.set(symbol, node);
          }
        }
        if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
          const symbol = checker.getSymbolAtLocation(node.name);
          if (symbol) {
            declarationMap.set(symbol, node);
          }
        }
        ts.forEachChild(node, visit);
      });
    }

    for (const sourceFile of snapshot.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isIdentifier(node)) {
          const symbol = checker.getSymbolAtLocation(node);
          const decl = symbol ? declarationMap.get(symbol) : undefined;
          if (decl) {
            const from = `${decl.getSourceFile().fileName}:${decl.pos}`;
            const to = `${sourceFile.fileName}:${node.pos}`;
            addEdge(graph, { from, to, kind: "data-flow" });
          }
        }
        ts.forEachChild(node, visit);
      });
    }

    this.logger.info("Data-flow graph built.", {
      edges: graph.edges.length
    });
    return graph;
  }
}
