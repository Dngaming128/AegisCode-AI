"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvariantChecker = void 0;
class InvariantChecker {
    check(snapshot, dependencyGraph) {
        const violations = [];
        if (snapshot.files.length === 0) {
            violations.push({
                id: "invariant-empty-repo",
                message: "Repository has no TypeScript files.",
                severity: "high"
            });
        }
        for (const edge of dependencyGraph.edges) {
            if (edge.from === edge.to) {
                violations.push({
                    id: `invariant-self-import-${edge.from}`,
                    message: "File imports itself.",
                    filePath: edge.from,
                    severity: "medium"
                });
            }
        }
        return violations;
    }
}
exports.InvariantChecker = InvariantChecker;
