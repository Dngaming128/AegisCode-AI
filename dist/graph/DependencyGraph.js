"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyGraphBuilder = void 0;
const typescript_1 = __importDefault(require("typescript"));
const path_1 = __importDefault(require("path"));
const GraphUtils_1 = require("../utils/GraphUtils");
class DependencyGraphBuilder {
    constructor(logger) {
        this.logger = logger;
    }
    build(snapshot) {
        const graph = (0, GraphUtils_1.createGraph)();
        const { program, compilerOptions } = snapshot;
        const host = typescript_1.default.createCompilerHost(compilerOptions, true);
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) {
                continue;
            }
            const from = sourceFile.fileName;
            typescript_1.default.forEachChild(sourceFile, (node) => {
                if (typescript_1.default.isImportDeclaration(node) && typescript_1.default.isStringLiteral(node.moduleSpecifier)) {
                    const moduleName = node.moduleSpecifier.text;
                    const resolved = typescript_1.default.resolveModuleName(moduleName, sourceFile.fileName, compilerOptions, host).resolvedModule;
                    const to = resolved?.resolvedFileName
                        ? path_1.default.resolve(resolved.resolvedFileName)
                        : moduleName;
                    (0, GraphUtils_1.addEdge)(graph, { from, to, kind: "import" });
                }
                if (typescript_1.default.isCallExpression(node) &&
                    typescript_1.default.isIdentifier(node.expression) &&
                    node.expression.text === "require" &&
                    node.arguments.length === 1 &&
                    typescript_1.default.isStringLiteral(node.arguments[0])) {
                    const moduleName = node.arguments[0].text;
                    const resolved = typescript_1.default.resolveModuleName(moduleName, sourceFile.fileName, compilerOptions, host).resolvedModule;
                    const to = resolved?.resolvedFileName
                        ? path_1.default.resolve(resolved.resolvedFileName)
                        : moduleName;
                    (0, GraphUtils_1.addEdge)(graph, { from, to, kind: "require" });
                }
            });
        }
        this.logger.info("Dependency graph built.", {
            edges: graph.edges.length
        });
        return graph;
    }
}
exports.DependencyGraphBuilder = DependencyGraphBuilder;
