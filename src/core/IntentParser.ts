export interface IntentResult {
  intent: string;
  constraints: string[];
  assumptions: string[];
  conflicts: string[];
}

export class IntentParser {
  parse(input: string): IntentResult {
    const constraints: string[] = [];
    const assumptions: string[] = [];
    const conflicts: string[] = [];
    const normalized = input.trim().toLowerCase();

    if (normalized.includes("fix") || normalized.includes("repair")) {
      constraints.push("must-repair");
    }
    if (normalized.includes("validate") || normalized.includes("verify")) {
      constraints.push("must-validate");
    }
    if (normalized.includes("fast")) {
      assumptions.push("speed-priority");
    }

    if (normalized.includes("no action") && normalized.includes("apply")) {
      conflicts.push("conflicting-action-intent");
    }

    return {
      intent: normalized.length === 0 ? "scan" : normalized,
      constraints,
      assumptions,
      conflicts
    };
  }
}
