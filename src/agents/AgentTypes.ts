import { DiagnosticInfo } from "../compiler/TscIngest";
import { Graph } from "../utils/GraphUtils";
import { RepoSnapshot } from "../analysis/RepoScanner";
import { PatchProposal } from "../patch/PatchTypes";
import { IntentResult } from "../core/IntentParser";
import { MemoryState } from "../memory/MemoryTypes";
import { InvariantViolation } from "../analysis/Invariant";
import { RootCause } from "../analysis/RootCause";

export interface SolveInput {
  snapshot: RepoSnapshot;
  dependencyGraph: Graph;
  callGraph: Graph;
  dataFlowGraph: Graph;
  tscDiagnostics: DiagnosticInfo[];
  eslintDiagnostics: DiagnosticInfo[];
  runtimeDiagnostics: DiagnosticInfo[];
  intent: IntentResult;
  memory: MemoryState;
}

export interface SolveResult {
  patches: PatchProposal[];
  violations: InvariantViolation[];
  rootCauses: RootCause[];
  confidence: number;
  rationale: string;
}
