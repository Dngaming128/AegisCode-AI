import ts from "typescript";
import path from "path";
import { Logger } from "../core/Logger";
import { RepoSnapshot } from "../analysis/RepoScanner";
import { Graph, addEdge, createGraph } from "../utils/GraphUtils";

export class DependencyGraphBuilder {
  constructor(private logger: Logger) {}

  build(snapshot: RepoSnapshot): Graph {
    const graph = createGraph();
    const { program, compilerOptions } = snapshot;
    const host = ts.createCompilerHost(compilerOptions, true);

    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      const from = sourceFile.fileName;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const moduleName = node.moduleSpecifier.text;
          const resolved = ts.resolveModuleName(
            moduleName,
            sourceFile.fileName,
            compilerOptions,
            host
          ).resolvedModule;
          const to = resolved?.resolvedFileName
            ? path.resolve(resolved.resolvedFileName)
            : moduleName;
          addEdge(graph, { from, to, kind: "import" });
        }
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require" &&
          node.arguments.length === 1 &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const moduleName = node.arguments[0].text;
          const resolved = ts.resolveModuleName(
            moduleName,
            sourceFile.fileName,
            compilerOptions,
            host
          ).resolvedModule;
          const to = resolved?.resolvedFileName
            ? path.resolve(resolved.resolvedFileName)
            : moduleName;
          addEdge(graph, { from, to, kind: "require" });
        }
      });
    }

    this.logger.info("Dependency graph built.", {
      edges: graph.edges.length
    });
    return graph;
  }
}
