"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstPatchGenerator = void 0;
const typescript_1 = __importDefault(require("typescript"));
class AstPatchGenerator {
    constructor(logger) {
        this.logger = logger;
    }
    propose(program, diagnostics) {
        const proposals = [];
        const sourceFiles = new Map();
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
                if (node && typescript_1.default.isParameter(node)) {
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
    proposeUnusedNode(node, sourceFile) {
        if (!node) {
            return null;
        }
        if (typescript_1.default.isImportSpecifier(node) || typescript_1.default.isNamespaceImport(node) || typescript_1.default.isImportClause(node)) {
            return {
                id: `remove-unused-import-${sourceFile.fileName}-${node.pos}`,
                filePath: sourceFile.fileName,
                kind: "remove-unused-import",
                description: "Remove unused import.",
                confidence: 0.9,
                targetPos: node.pos
            };
        }
        if (typescript_1.default.isVariableDeclaration(node)) {
            return {
                id: `remove-unused-var-${sourceFile.fileName}-${node.pos}`,
                filePath: sourceFile.fileName,
                kind: "remove-unused-variable",
                description: "Remove unused variable declaration.",
                confidence: 0.82,
                targetPos: node.pos
            };
        }
        if (typescript_1.default.isParameter(node)) {
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
exports.AstPatchGenerator = AstPatchGenerator;
function getNodeAtPosition(sourceFile, position) {
    let found;
    function visit(node) {
        if (position >= node.getFullStart() && position <= node.getEnd()) {
            found = node;
            typescript_1.default.forEachChild(node, visit);
        }
    }
    visit(sourceFile);
    return found;
}
