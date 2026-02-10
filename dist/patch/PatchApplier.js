"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchApplier = void 0;
const typescript_1 = __importDefault(require("typescript"));
const FileUtils_1 = require("../utils/FileUtils");
const textChanges = typescript_1.default.textChanges;
class PatchApplier {
    constructor(logger) {
        this.logger = logger;
    }
    previewPatches(patches) {
        const grouped = new Map();
        for (const patch of patches) {
            const list = grouped.get(patch.filePath) ?? [];
            list.push(patch);
            grouped.set(patch.filePath, list);
        }
        const previews = [];
        for (const [filePath, filePatches] of grouped.entries()) {
            const original = FileUtils_1.FileUtils.readFile(filePath);
            const sourceFile = typescript_1.default.createSourceFile(filePath, original, typescript_1.default.ScriptTarget.Latest, true);
            const edits = textChanges.ChangeTracker.with({ newLineCharacter: "\n" }, (tracker) => {
                for (const patch of filePatches) {
                    const node = findNodeByPos(sourceFile, patch.targetPos);
                    if (!node) {
                        continue;
                    }
                    applyPatch(tracker, sourceFile, node, patch);
                }
            });
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
    applyPatches(patches) {
        const grouped = new Map();
        for (const patch of patches) {
            const list = grouped.get(patch.filePath) ?? [];
            list.push(patch);
            grouped.set(patch.filePath, list);
        }
        const applied = [];
        const backups = {};
        for (const [filePath, filePatches] of grouped.entries()) {
            const original = FileUtils_1.FileUtils.readFile(filePath);
            backups[filePath] = original;
            const sourceFile = typescript_1.default.createSourceFile(filePath, original, typescript_1.default.ScriptTarget.Latest, true);
            const edits = textChanges.ChangeTracker.with({ newLineCharacter: "\n" }, (tracker) => {
                for (const patch of filePatches) {
                    const node = findNodeByPos(sourceFile, patch.targetPos);
                    if (!node) {
                        continue;
                    }
                    applyPatch(tracker, sourceFile, node, patch);
                }
            });
            const fileEdits = textChanges.getEditsForFile(edits, sourceFile);
            if (fileEdits.length === 0) {
                continue;
            }
            const updated = applyTextEdits(original, fileEdits);
            FileUtils_1.FileUtils.writeFile(filePath, updated);
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
    rollback(result) {
        for (const [filePath, content] of Object.entries(result.backupFiles)) {
            FileUtils_1.FileUtils.writeFile(filePath, content);
        }
        this.logger.warn("Rollback applied.");
    }
}
exports.PatchApplier = PatchApplier;
function applyPatch(tracker, sourceFile, node, patch) {
    switch (patch.kind) {
        case "remove-unused-import":
            tracker.delete(sourceFile, node);
            return;
        case "remove-unused-variable":
            tracker.delete(sourceFile, node);
            return;
        case "mark-parameter-used": {
            if (!typescript_1.default.isParameter(node)) {
                return;
            }
            const func = findFunctionContainer(node);
            if (!func || !func.body) {
                return;
            }
            const name = node.name.getText(sourceFile);
            const voidStatement = typescript_1.default.factory.createExpressionStatement(typescript_1.default.factory.createVoidExpression(typescript_1.default.factory.createIdentifier(name)));
            tracker.insertNodeAtFunctionStart(sourceFile, func, voidStatement);
            return;
        }
        case "add-unknown-parameter-type": {
            if (!typescript_1.default.isParameter(node)) {
                return;
            }
            const updated = typescript_1.default.factory.updateParameterDeclaration(node, node.modifiers, node.dotDotDotToken, node.name, node.questionToken, node.type ?? typescript_1.default.factory.createKeywordTypeNode(typescript_1.default.SyntaxKind.UnknownKeyword), node.initializer);
            tracker.replaceNode(sourceFile, node, updated);
            return;
        }
        default:
            return;
    }
}
function applyTextEdits(text, edits) {
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
function findNodeByPos(sourceFile, pos) {
    let result;
    function visit(node) {
        if (pos >= node.getFullStart() && pos <= node.getEnd()) {
            result = node;
            typescript_1.default.forEachChild(node, visit);
        }
    }
    visit(sourceFile);
    return result;
}
function findFunctionContainer(node) {
    let current = node.parent;
    while (current) {
        if (typescript_1.default.isFunctionDeclaration(current) ||
            typescript_1.default.isMethodDeclaration(current) ||
            typescript_1.default.isArrowFunction(current) ||
            typescript_1.default.isFunctionExpression(current)) {
            return current;
        }
        current = current.parent;
    }
    return null;
}
