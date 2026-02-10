export interface InvariantViolation {
  id: string;
  message: string;
  filePath?: string;
  position?: number;
  diagnosticCode?: number;
  severity: "low" | "medium" | "high";
}
