import ts from "typescript";
import { Logger } from "../core/Logger";
import { RepoSnapshot } from "../analysis/RepoScanner";

export interface DiagnosticInfo {
  source: "tsc" | "eslint" | "runtime";
  code?: number;
  message: string;
  filePath?: string;
  position?: number;
  severity: "error" | "warning";
}

export class TscIngest {
  constructor(private logger: Logger) {}

  collect(snapshot: RepoSnapshot): DiagnosticInfo[] {
    const diagnostics = ts.getPreEmitDiagnostics(snapshot.program);
    const results: DiagnosticInfo[] = diagnostics.map((diag) => {
      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      return {
        source: "tsc",
        code: diag.code,
        message,
        filePath: diag.file?.fileName,
        position: diag.start,
        severity: diag.category === ts.DiagnosticCategory.Error ? "error" : "warning"
      };
    });
    this.logger.info("TSC diagnostics collected.", { count: results.length });
    return results;
  }
}
