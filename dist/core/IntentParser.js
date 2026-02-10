"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentParser = void 0;
class IntentParser {
    parse(input) {
        const constraints = [];
        const assumptions = [];
        const conflicts = [];
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
exports.IntentParser = IntentParser;
