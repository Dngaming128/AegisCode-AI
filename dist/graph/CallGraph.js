"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGraphBuilder = void 0;
const typescript_1 = __importDefault(require("typescript"));
const GraphUtils_1 = require("../utils/GraphUtils");
class CallGraphBuilder {
    constructor(logger) {
        this.logger = logger;
    }
    build(snapshot) {
        const graph = (0, GraphUtils_1.createGraph)();
        const checker = snapshot.program.getTypeChecker();
        const getSymbolId = (symbol, fallback) => {
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
            typescript_1.default.forEachChild(sourceFile, function visit(node) {
                if (typescript_1.default.isCallExpression(node)) {
                    const signature = checker.getResolvedSignature(node);
                    const decl = signature?.getDeclaration();
                    const calleeSymbol = checker.getSymbolAtLocation(node.expression);
                    const from = `${sourceFile.fileName}:${node.pos}`;
                    const to = decl
                        ? `${decl.getSourceFile().fileName}:${decl.pos}`
                        : getSymbolId(calleeSymbol, node.expression.getText(sourceFile));
                    (0, GraphUtils_1.addEdge)(graph, { from, to, kind: "call" });
                }
                typescript_1.default.forEachChild(node, visit);
            });
        }
        this.logger.info("Call graph built.", {
            edges: graph.edges.length
        });
        return graph;
    }
}
exports.CallGraphBuilder = CallGraphBuilder;
