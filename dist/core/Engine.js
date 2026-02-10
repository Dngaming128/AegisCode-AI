"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const Logger_1 = require("./Logger");
const Lock_1 = require("./Lock");
const IntentParser_1 = require("./IntentParser");
const RepoScanner_1 = require("../analysis/RepoScanner");
const DependencyGraph_1 = require("../graph/DependencyGraph");
const CallGraph_1 = require("../graph/CallGraph");
const DataFlowGraph_1 = require("../graph/DataFlowGraph");
const TscIngest_1 = require("../compiler/TscIngest");
const EslintIngest_1 = require("../compiler/EslintIngest");
const RuntimeIngest_1 = require("../compiler/RuntimeIngest");
const SolverAgent_1 = require("../agents/SolverAgent");
const CriticAgent_1 = require("../agents/CriticAgent");
const VerifierAgent_1 = require("../agents/VerifierAgent");
const MemoryStore_1 = require("../memory/MemoryStore");
const PatchApplier_1 = require("../patch/PatchApplier");
const TestSynthesis_1 = require("../runtime/TestSynthesis");
const FailureExplanation_1 = require("../runtime/FailureExplanation");
const OllamaClient_1 = require("../llm/OllamaClient");
class Engine {
    constructor(config) {
        this.config = config;
        this.logger = new Logger_1.Logger("info");
        this.lock = new Lock_1.ReentrancyLock();
        this.lastResult = null;
        this.lastPlan = null;
        this.memory = new MemoryStore_1.MemoryStore(config.memoryDir, this.logger);
    }
    async runOnce() {
        return this.execute(true);
    }
    async plan() {
        return this.execute(false);
    }
    async execute(autoApply) {
        if (!this.lock.acquire()) {
            return {
                status: "blocked",
                message: "Engine locked (re-entrancy guard).",
                patchesApplied: 0
            };
        }
        try {
            this.logger.info("Scanning repository.", { repo: this.config.repoRoot });
            const scanner = new RepoScanner_1.RepoScanner(this.config.repoRoot, this.logger);
            const snapshot = scanner.scan();
            const dependencyGraph = new DependencyGraph_1.DependencyGraphBuilder(this.logger).build(snapshot);
            const callGraph = new CallGraph_1.CallGraphBuilder(this.logger).build(snapshot);
            const dataFlowGraph = new DataFlowGraph_1.DataFlowGraphBuilder(this.logger).build(snapshot);
            const tscIngest = new TscIngest_1.TscIngest(this.logger);
            const tscDiagnostics = tscIngest.collect(snapshot);
            const eslintIngest = new EslintIngest_1.EslintIngest(this.logger);
            const eslintDiagnostics = await eslintIngest.collect(this.config.repoRoot);
            const runtimeIngest = new RuntimeIngest_1.RuntimeIngest(this.logger);
            const runtimeDiagnostics = runtimeIngest.collect();
            const ollama = this.config.ollama.enabled
                ? new OllamaClient_1.OllamaClient(this.config.ollama, this.logger)
                : undefined;
            const solver = new SolverAgent_1.SolverAgent(this.logger, ollama);
            const critic = new CriticAgent_1.CriticAgent(this.logger, ollama);
            const verifier = new VerifierAgent_1.VerifierAgent(this.logger, new TestSynthesis_1.TestSynthesis(this.logger), ollama);
            const intent = new IntentParser_1.IntentParser().parse("scan and repair");
            const solverResult = await solver.solveWithOllama({
                snapshot,
                dependencyGraph,
                callGraph,
                dataFlowGraph,
                tscDiagnostics,
                eslintDiagnostics,
                runtimeDiagnostics,
                memory: this.memory.read(),
                intent
            });
            if (this.config.ultraStrict && solverResult.confidence < 0.95) {
                const explanation = new FailureExplanation_1.FailureExplanationEngine().build("Ultra-strict mode blocked execution.", solverResult.rationale.split(","), solverResult.violations);
                return {
                    status: "blocked",
                    message: "Ultra-strict mode blocked execution.",
                    patchesApplied: 0,
                    explanation
                };
            }
            const patchApplier = new PatchApplier_1.PatchApplier(this.logger);
            this.lastPlan = {
                patches: solverResult.patches,
                previews: patchApplier.previewPatches(solverResult.patches),
                confidence: solverResult.confidence,
                rationale: solverResult.rationale
            };
            const criticResult = await critic.reviewWithOllama(solverResult, this.config.confidenceThreshold);
            if (!criticResult.approved) {
                this.memory.recordFailure(solverResult, "critic-veto");
                const explanation = new FailureExplanation_1.FailureExplanationEngine().build(criticResult.reason, solverResult.rationale.split(","), solverResult.violations);
                return {
                    status: "blocked",
                    message: criticResult.reason,
                    patchesApplied: 0,
                    explanation
                };
            }
            if (!autoApply) {
                return {
                    status: "ok",
                    message: "Plan ready for review.",
                    patchesApplied: 0
                };
            }
            if (this.config.safeMode) {
                return {
                    status: "blocked",
                    message: "Safe mode enabled. No patches applied.",
                    patchesApplied: 0
                };
            }
            const applied = patchApplier.applyPatches(solverResult.patches);
            if (applied.appliedCount === 0) {
                this.memory.recordFailure(solverResult, "no-patches-applied");
                const explanation = new FailureExplanation_1.FailureExplanationEngine().build("No patches applied.", solverResult.rationale.split(","), solverResult.violations);
                return {
                    status: "blocked",
                    message: "No patches applied.",
                    patchesApplied: 0,
                    explanation
                };
            }
            const verifyResult = await verifier.verifyWithOllama(snapshot, applied);
            if (!verifyResult.ok) {
                this.memory.recordFailure(solverResult, verifyResult.reason);
                patchApplier.rollback(applied);
                const explanation = new FailureExplanation_1.FailureExplanationEngine().build(verifyResult.reason, solverResult.rationale.split(","), solverResult.violations);
                return {
                    status: "blocked",
                    message: `Verification failed: ${verifyResult.reason}`,
                    patchesApplied: 0,
                    explanation
                };
            }
            this.memory.recordSuccess(solverResult);
            return {
                status: "ok",
                message: "Patches applied and verified.",
                patchesApplied: applied.appliedCount
            };
        }
        finally {
            this.lock.release();
        }
    }
    async startUi() {
        const app = (0, express_1.default)();
        app.use(express_1.default.json({ limit: "2mb" }));
        const uiPath = path_1.default.resolve(this.config.uiDir);
        app.use(express_1.default.static(uiPath));
        app.get("/api/status", (_req, res) => {
            res.json({
                locked: this.lock.isLocked(),
                lastResult: this.lastResult
            });
        });
        app.post("/api/scan", async (_req, res) => {
            const result = await this.execute(false);
            this.lastResult = result;
            res.json(result);
        });
        app.get("/api/plan", (_req, res) => {
            res.json(this.lastPlan ?? {
                patches: [],
                previews: [],
                confidence: 0,
                rationale: "No plan."
            });
        });
        app.post("/api/apply", async (_req, res) => {
            if (!this.lastPlan) {
                res.json({ status: "blocked", message: "No plan available." });
                return;
            }
            const result = await this.execute(true);
            this.lastResult = result;
            res.json(result);
        });
        app.post("/api/apply-remember", async (_req, res) => {
            if (!this.lastPlan) {
                res.json({ status: "blocked", message: "No plan available." });
                return;
            }
            const result = await this.execute(true);
            this.lastResult = result;
            res.json(result);
        });
        app.post("/api/reject", (_req, res) => {
            this.lastPlan = null;
            res.json({ status: "ok", message: "Plan rejected." });
        });
        app.get("/api/memory", (_req, res) => {
            res.json(this.memory.read());
        });
        app.post("/api/safe-mode", (req, res) => {
            const { safeMode } = req.body;
            this.config.safeMode = Boolean(safeMode);
            res.json({ safeMode: this.config.safeMode });
        });
        app.listen(this.config.port, () => {
            this.logger.info(`UI server listening on port ${this.config.port}.`);
        });
    }
}
exports.Engine = Engine;
