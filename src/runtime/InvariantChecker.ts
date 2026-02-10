import { RepoSnapshot } from "../analysis/RepoScanner";
import { Graph } from "../utils/GraphUtils";
import { InvariantViolation } from "../analysis/Invariant";

export class InvariantChecker {
  check(snapshot: RepoSnapshot, dependencyGraph: Graph): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

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
