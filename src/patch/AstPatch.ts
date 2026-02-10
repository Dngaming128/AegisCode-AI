import ts from "typescript";
import { Logger } from "../core/Logger";
import { DiagnosticInfo } from "../compiler/TscIngest";
import { PatchProposal } from "./PatchTypes";

export class AstPatchGenerator {
  constructor(private logger: Logger) {}

  propose(program: ts.Program, diagnostics: DiagnosticInfo[]): PatchProposal[] {
    const proposals: PatchProposal[] = [];
    const sourceFiles = new Map<string, ts.SourceFile>();
    for (const file of program.getSourceFiles()) {
      sourceFiles.set(file.fileName, file);
    }

    for (const diag of diagnostics) {
      if (!diag.filePath || diag.position === undefined) {
        continue;
      }
      const sourceFile = sourceFiles.get(diag.filePath);
      if (!sourceFile) {
        continue;
      }

      if (diag.source === "tsc" && diag.code === 6133) {
        const node = getNodeAtPosition(sourceFile, diag.position);
        const proposal = this.proposeUnusedNode(node, sourceFile);
        if (proposal) {
          proposals.push(proposal);
        }
      }

      if (diag.source === "tsc" && diag.code === 7006) {
        const node = getNodeAtPosition(sourceFile, diag.position);
        if (node && ts.isParameter(node)) {
          proposals.push({
            id: `add-unknown-${diag.filePath}-${diag.position}`,
            filePath: diag.filePath,
            kind: "add-unknown-parameter-type",
            description: "Add unknown type annotation to parameter.",
            confidence: 0.8,
            targetPos: node.pos
          });
        }
      }
    }

    this.logger.info("AST patch proposals generated.", {
      count: proposals.length
    });
    return proposals;
  }

  private proposeUnusedNode(
    node: ts.Node | undefined,
    sourceFile: ts.SourceFile
  ): PatchProposal | null {
    if (!node) {
      return null;
    }

    if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportClause(node)) {
      return {
        id: `remove-unused-import-${sourceFile.fileName}-${node.pos}`,
        filePath: sourceFile.fileName,
        kind: "remove-unused-import",
        description: "Remove unused import.",
        confidence: 0.9,
        targetPos: node.pos
      };
    }

    if (ts.isVariableDeclaration(node)) {
      return {
        id: `remove-unused-var-${sourceFile.fileName}-${node.pos}`,
        filePath: sourceFile.fileName,
        kind: "remove-unused-variable",
        description: "Remove unused variable declaration.",
        confidence: 0.82,
        targetPos: node.pos
      };
    }

    if (ts.isParameter(node)) {
      return {
        id: `mark-unused-param-${sourceFile.fileName}-${node.pos}`,
        filePath: sourceFile.fileName,
        kind: "mark-parameter-used",
        description: "Mark unused parameter as used inside function body.",
        confidence: 0.76,
        targetPos: node.pos
      };
    }

    return null;
  }
}

function getNodeAtPosition(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
  let found: ts.Node | undefined;
  function visit(node: ts.Node): void {
    if (position >= node.getFullStart() && position <= node.getEnd()) {
      found = node;
      ts.forEachChild(node, visit);
    }
  }
  visit(sourceFile);
  return found;
}
