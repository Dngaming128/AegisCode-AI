"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolverAgent = void 0;
const AstPatch_1 = require("../patch/AstPatch");
const InvariantChecker_1 = require("../runtime/InvariantChecker");
class SolverAgent {
    constructor(logger, ollama) {
        this.logger = logger;
        this.ollama = ollama;
    }
    solve(input) {
        const invariantChecker = new InvariantChecker_1.InvariantChecker();
        const violations = [
            ...invariantChecker.check(input.snapshot, input.dependencyGraph),
            ...this.mapDiagnosticsToViolations(input.tscDiagnostics, input.eslintDiagnostics, input.runtimeDiagnostics)
        ];
        const rootCauses = this.deriveRootCauses(violations);
        const generator = new AstPatch_1.AstPatchGenerator(this.logger);
        const patches = generator.propose(input.snapshot.program, input.tscDiagnostics);
        const avgPatchConfidence = patches.reduce((sum, patch) => sum + patch.confidence, 0) /
            (patches.length === 0 ? 1 : patches.length);
        const memoryFactor = input.memory.successRate;
        const confidence = clamp(0.45 + avgPatchConfidence * 0.4 + memoryFactor * 0.15);
        const rationale = `Violations: ${violations.length}, patches: ${patches.length}`;
        this.logger.info("Solver agent completed.", {
            confidence,
            patches: patches.length
        });
        return {
            patches,
            violations,
            rootCauses,
            confidence,
            rationale
        };
    }
    async solveWithOllama(input) {
        const baseResult = this.solve(input);
        if (!this.ollama) {
            return baseResult;
        }
        const prompt = [
            "You are the solver reviewer for a TypeScript refactor tool.",
            "Respond with strict JSON only.",
            "Schema: {\"confidence_adjustment\": number, \"rationale\": string}",
            "Guidelines:",
            "- confidence_adjustment range [-0.2, 0.2]",
            "- rationale should be short",
            "Context:",
            `Violations: ${baseResult.violations.length}`,
            `Patches: ${baseResult.patches.length}`,
            `Base confidence: ${baseResult.confidence.toFixed(2)}`
        ].join("\n");
        const response = await this.ollama.generate("solver", prompt);
        if (!response) {
            return baseResult;
        }
        try {
            const parsed = JSON.parse(response);
            const adjustment = typeof parsed.confidence_adjustment === "number"
                ? parsed.confidence_adjustment
                : 0;
            const newConfidence = clamp(baseResult.confidence + adjustment);
            const newRationale = parsed.rationale
                ? `${baseResult.rationale}; LLM: ${parsed.rationale}`
                : baseResult.rationale;
            return {
                ...baseResult,
                confidence: newConfidence,
                rationale: newRationale
            };
        }
        catch {
            return baseResult;
        }
    }
    mapDiagnosticsToViolations(tsc, eslint, runtime) {
        const map = (diag) => ({
            id: `${diag.source}-${diag.code ?? "na"}-${diag.filePath ?? "global"}-${diag.position ?? 0}`,
            message: diag.message,
            filePath: diag.filePath,
            position: diag.position,
            diagnosticCode: diag.code,
            severity: diag.severity === "error" ? "high" : "medium"
        });
        return [...tsc.map(map), ...eslint.map(map), ...runtime.map(map)];
    }
    deriveRootCauses(violations) {
        return violations.map((violation) => ({
            id: `root-${violation.id}`,
            description: `Root cause for ${violation.message}`,
            violationId: violation.id,
            confidence: violation.severity === "high" ? 0.7 : 0.5,
            fixStrategy: this.pickStrategy(violation)
        }));
    }
    pickStrategy(violation) {
        if (violation.diagnosticCode === 6133) {
            return "remove-unused-symbol";
        }
        if (violation.diagnosticCode === 7006) {
            return "add-unknown-parameter-type";
        }
        if (violation.diagnosticCode === 2304) {
            return "unknown-identifier";
        }
        return "manual-review";
    }
}
exports.SolverAgent = SolverAgent;
function clamp(value) {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}
