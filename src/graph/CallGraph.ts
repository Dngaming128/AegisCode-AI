import ts from "typescript";
import { Logger } from "../core/Logger";
import { RepoSnapshot } from "../analysis/RepoScanner";
import { Graph, addEdge, createGraph } from "../utils/GraphUtils";

export class CallGraphBuilder {
  constructor(private logger: Logger) {}

  build(snapshot: RepoSnapshot): Graph {
    const graph = createGraph();
    const checker = snapshot.program.getTypeChecker();

    const getSymbolId = (symbol: ts.Symbol | undefined, fallback: string): string => {
      if (!symbol) {
        return fallback;
      }
      const declarations = symbol.getDeclarations();
      const first = declarations?.[0];
      if (first) {
        return `${first.getSourceFile().fileName}:${first.pos}`;
      }
      return fallback;
    };

    for (const sourceFile of snapshot.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      ts.forEachChild(sourceFile, function visit(node) {
        if (ts.isCallExpression(node)) {
          const signature = checker.getResolvedSignature(node);
          const decl = signature?.getDeclaration();
          const calleeSymbol = checker.getSymbolAtLocation(node.expression);
          const from = `${sourceFile.fileName}:${node.pos}`;
          const to = decl
            ? `${decl.getSourceFile().fileName}:${decl.pos}`
            : getSymbolId(calleeSymbol, node.expression.getText(sourceFile));
          addEdge(graph, { from, to, kind: "call" });
        }
        ts.forEachChild(node, visit);
      });
    }

    this.logger.info("Call graph built.", {
      edges: graph.edges.length
    });
    return graph;
  }
}
