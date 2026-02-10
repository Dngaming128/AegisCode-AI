import ts from "typescript";
import { Logger } from "../core/Logger";
import { FileUtils } from "../utils/FileUtils";
import { AppliedPatch, PatchApplicationResult, PatchProposal } from "./PatchTypes";

const textChanges = (ts as { textChanges?: unknown }).textChanges as any;
type ChangeTracker = any;

export class PatchApplier {
  constructor(private logger: Logger) {}

  previewPatches(patches: PatchProposal[]): AppliedPatch[] {
    const grouped = new Map<string, PatchProposal[]>();
    for (const patch of patches) {
      const list = grouped.get(patch.filePath) ?? [];
      list.push(patch);
      grouped.set(patch.filePath, list);
    }

    const previews: AppliedPatch[] = [];
    for (const [filePath, filePatches] of grouped.entries()) {
      const original = FileUtils.readFile(filePath);
      const sourceFile = ts.createSourceFile(
        filePath,
        original,
        ts.ScriptTarget.Latest,
        true
      );
      const edits = textChanges.ChangeTracker.with(
        { newLineCharacter: "\n" },
        (tracker: ChangeTracker) => {
          for (const patch of filePatches) {
            const node = findNodeByPos(sourceFile, patch.targetPos);
            if (!node) {
              continue;
            }
            applyPatch(tracker, sourceFile, node, patch);
          }
        }
      );
      const fileEdits = textChanges.getEditsForFile(edits, sourceFile);
      if (fileEdits.length === 0) {
        continue;
      }
      const updated = applyTextEdits(original, fileEdits);
      for (const patch of filePatches) {
        previews.push({
          proposal: patch,
          before: original,
          after: updated
        });
      }
    }
    return previews;
  }

  applyPatches(patches: PatchProposal[]): PatchApplicationResult {
    const grouped = new Map<string, PatchProposal[]>();
    for (const patch of patches) {
      const list = grouped.get(patch.filePath) ?? [];
      list.push(patch);
      grouped.set(patch.filePath, list);
    }

    const applied: AppliedPatch[] = [];
    const backups: Record<string, string> = {};

    for (const [filePath, filePatches] of grouped.entries()) {
      const original = FileUtils.readFile(filePath);
      backups[filePath] = original;
      const sourceFile = ts.createSourceFile(
        filePath,
        original,
        ts.ScriptTarget.Latest,
        true
      );

      const edits = textChanges.ChangeTracker.with(
        { newLineCharacter: "\n" },
        (tracker: ChangeTracker) => {
          for (const patch of filePatches) {
            const node = findNodeByPos(sourceFile, patch.targetPos);
            if (!node) {
              continue;
            }
            applyPatch(tracker, sourceFile, node, patch);
          }
        }
      );

      const fileEdits = textChanges.getEditsForFile(edits, sourceFile);
      if (fileEdits.length === 0) {
        continue;
      }
      const updated = applyTextEdits(original, fileEdits);
      FileUtils.writeFile(filePath, updated);

      for (const patch of filePatches) {
        applied.push({
          proposal: patch,
          before: original,
          after: updated
        });
      }
    }

    this.logger.info("Patches applied.", { count: applied.length });
    return {
      appliedCount: applied.length,
      patches: applied,
      backupFiles: backups
    };
  }

  rollback(result: PatchApplicationResult): void {
    for (const [filePath, content] of Object.entries(result.backupFiles)) {
      FileUtils.writeFile(filePath, content);
    }
    this.logger.warn("Rollback applied.");
  }
}

function applyPatch(
  tracker: ChangeTracker,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  patch: PatchProposal
): void {
  switch (patch.kind) {
    case "remove-unused-import":
      tracker.delete(sourceFile, node);
      return;
    case "remove-unused-variable":
      tracker.delete(sourceFile, node);
      return;
    case "mark-parameter-used": {
      if (!ts.isParameter(node)) {
        return;
      }
      const func = findFunctionContainer(node);
      if (!func || !func.body) {
        return;
      }
      const name = node.name.getText(sourceFile);
      const voidStatement = ts.factory.createExpressionStatement(
        ts.factory.createVoidExpression(ts.factory.createIdentifier(name))
      );
      tracker.insertNodeAtFunctionStart(sourceFile, func, voidStatement);
      return;
    }
    case "add-unknown-parameter-type": {
      if (!ts.isParameter(node)) {
        return;
      }
      const updated = ts.factory.updateParameterDeclaration(
        node,
        node.modifiers,
        node.dotDotDotToken,
        node.name,
        node.questionToken,
        node.type ?? ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        node.initializer
      );
      tracker.replaceNode(sourceFile, node, updated);
      return;
    }
    default:
      return;
  }
}

function applyTextEdits(text: string, edits: readonly ts.TextChange[]): string {
  const sorted = [...edits].sort((a, b) => b.span.start - a.span.start);
  let updated = text;
  for (const edit of sorted) {
    updated =
      updated.slice(0, edit.span.start) +
      edit.newText +
      updated.slice(edit.span.start + edit.span.length);
  }
  return updated;
}

function findNodeByPos(sourceFile: ts.SourceFile, pos: number): ts.Node | undefined {
  let result: ts.Node | undefined;
  function visit(node: ts.Node): void {
    if (pos >= node.getFullStart() && pos <= node.getEnd()) {
      result = node;
      ts.forEachChild(node, visit);
    }
  }
  visit(sourceFile);
  return result;
}

function findFunctionContainer(node: ts.Node): ts.FunctionLikeDeclarationBase | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}
