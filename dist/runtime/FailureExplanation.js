"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FailureExplanationEngine = void 0;
class FailureExplanationEngine {
    build(reason, assumptions, violations) {
        return {
            why: reason,
            assumptions,
            violatedInvariants: violations.map((violation) => violation.id)
        };
    }
}
exports.FailureExplanationEngine = FailureExplanationEngine;
