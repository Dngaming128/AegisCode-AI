import { Logger } from "../core/Logger";
import { DiagnosticInfo } from "./TscIngest";

export class RuntimeIngest {
  constructor(private logger: Logger) {}

  collect(runtimeLog?: string): DiagnosticInfo[] {
    if (!runtimeLog || runtimeLog.trim().length === 0) {
      return [];
    }
    this.logger.info("Runtime diagnostics collected.");
    return [
      {
        source: "runtime",
        message: runtimeLog,
        severity: "error"
      }
    ];
  }
}
