"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataFlowGraphBuilder = void 0;
const typescript_1 = __importDefault(require("typescript"));
const GraphUtils_1 = require("../utils/GraphUtils");
class DataFlowGraphBuilder {
    constructor(logger) {
        this.logger = logger;
    }
    build(snapshot) {
        const graph = (0, GraphUtils_1.createGraph)();
        const checker = snapshot.program.getTypeChecker();
        const declarationMap = new Map();
        for (const sourceFile of snapshot.program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) {
                continue;
            }
            typescript_1.default.forEachChild(sourceFile, function visit(node) {
                if (typescript_1.default.isVariableDeclaration(node) && node.name && typescript_1.default.isIdentifier(node.name)) {
                    const symbol = checker.getSymbolAtLocation(node.name);
                    if (symbol) {
                        declarationMap.set(symbol, node);
                    }
                }
                if (typescript_1.default.isParameter(node) && typescript_1.default.isIdentifier(node.name)) {
                    const symbol = checker.getSymbolAtLocation(node.name);
                    if (symbol) {
                        declarationMap.set(symbol, node);
                    }
                }
                typescript_1.default.forEachChild(node, visit);
            });
        }
        for (const sourceFile of snapshot.program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) {
                continue;
            }
            typescript_1.default.forEachChild(sourceFile, function visit(node) {
                if (typescript_1.default.isIdentifier(node)) {
                    const symbol = checker.getSymbolAtLocation(node);
                    const decl = symbol ? declarationMap.get(symbol) : undefined;
                    if (decl) {
                        const from = `${decl.getSourceFile().fileName}:${decl.pos}`;
                        const to = `${sourceFile.fileName}:${node.pos}`;
                        (0, GraphUtils_1.addEdge)(graph, { from, to, kind: "data-flow" });
                    }
                }
                typescript_1.default.forEachChild(node, visit);
            });
        }
        this.logger.info("Data-flow graph built.", {
            edges: graph.edges.length
        });
        return graph;
    }
}
exports.DataFlowGraphBuilder = DataFlowGraphBuilder;
