"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifierAgent = void 0;
const RepoScanner_1 = require("../analysis/RepoScanner");
const TscIngest_1 = require("../compiler/TscIngest");
class VerifierAgent {
    constructor(logger, tests, ollama) {
        this.logger = logger;
        this.tests = tests;
        this.ollama = ollama;
    }
    verify(snapshot, _patches) {
        const scanner = new RepoScanner_1.RepoScanner(snapshot.root, this.logger);
        const newSnapshot = scanner.scan();
        const tsc = new TscIngest_1.TscIngest(this.logger);
        const diagnostics = tsc.collect(newSnapshot);
        const errors = diagnostics.filter((diag) => diag.severity === "error");
        if (errors.length > 0) {
            return { ok: false, reason: "TSC errors after patch." };
        }
        const testResult = this.tests.run(newSnapshot.root);
        if (!testResult.ok) {
            return { ok: false, reason: `Tests failed: ${testResult.reason}` };
        }
        return { ok: true, reason: "Verified." };
    }
    async verifyWithOllama(snapshot, patches) {
        const base = this.verify(snapshot, patches);
        if (base.ok || !this.ollama) {
            return base;
        }
        const prompt = [
            "You are the verifier agent for a TypeScript refactor tool.",
            "Summarize why verification failed in one sentence.",
            "Respond with strict JSON only.",
            "Schema: {\"summary\": string}",
            `Failure: ${base.reason}`
        ].join("\n");
        const response = await this.ollama.generate("verifier", prompt);
        if (!response) {
            return base;
        }
        try {
            const parsed = JSON.parse(response);
            if (parsed.summary) {
                return {
                    ok: false,
                    reason: `${base.reason} ${parsed.summary}`
                };
            }
            return base;
        }
        catch {
            return base;
        }
    }
}
exports.VerifierAgent = VerifierAgent;
