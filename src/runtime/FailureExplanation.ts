import { InvariantViolation } from "../analysis/Invariant";

export interface FailureExplanation {
  why: string;
  assumptions: string[];
  violatedInvariants: string[];
}

export class FailureExplanationEngine {
  build(reason: string, assumptions: string[], violations: InvariantViolation[]): FailureExplanation {
    return {
      why: reason,
      assumptions,
      violatedInvariants: violations.map((violation) => violation.id)
    };
  }
}
