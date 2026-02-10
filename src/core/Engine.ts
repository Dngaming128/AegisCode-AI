import path from "path";
import express from "express";
import { EngineConfig } from "./Config";
import { Logger } from "./Logger";
import { ReentrancyLock } from "./Lock";
import { IntentParser } from "./IntentParser";
import { RepoScanner } from "../analysis/RepoScanner";
import { DependencyGraphBuilder } from "../graph/DependencyGraph";
import { CallGraphBuilder } from "../graph/CallGraph";
import { DataFlowGraphBuilder } from "../graph/DataFlowGraph";
import { TscIngest } from "../compiler/TscIngest";
import { EslintIngest } from "../compiler/EslintIngest";
import { RuntimeIngest } from "../compiler/RuntimeIngest";
import { SolverAgent } from "../agents/SolverAgent";
import { CriticAgent } from "../agents/CriticAgent";
import { VerifierAgent } from "../agents/VerifierAgent";
import { MemoryStore } from "../memory/MemoryStore";
import { PatchApplier } from "../patch/PatchApplier";
import { TestSynthesis } from "../runtime/TestSynthesis";
import { PatchProposal, AppliedPatch } from "../patch/PatchTypes";
import { FailureExplanationEngine, FailureExplanation } from "../runtime/FailureExplanation";
import { OllamaClient } from "../llm/OllamaClient";

export class Engine {
  private logger = new Logger("info");
  private lock = new ReentrancyLock();
  private memory: MemoryStore;
  private lastResult: Awaited<ReturnType<Engine["runOnce"]>> | null = null;
  private lastPlan: {
    patches: PatchProposal[];
    previews: AppliedPatch[];
    confidence: number;
    rationale: string;
  } | null = null;

  constructor(private config: EngineConfig) {
    this.memory = new MemoryStore(config.memoryDir, this.logger);
  }

  async runOnce(): Promise<{
    status: "ok" | "blocked";
    message: string;
    patchesApplied: number;
    explanation?: FailureExplanation;
  }> {
    return this.execute(true);
  }

  async plan(): Promise<{
    status: "ok" | "blocked";
    message: string;
    patchesApplied: number;
    explanation?: FailureExplanation;
  }> {
    return this.execute(false);
  }

  private async execute(autoApply: boolean): Promise<{
    status: "ok" | "blocked";
    message: string;
    patchesApplied: number;
    explanation?: FailureExplanation;
  }> {
    if (!this.lock.acquire()) {
      return {
        status: "blocked",
        message: "Engine locked (re-entrancy guard).",
        patchesApplied: 0
      };
    }

    try {
      this.logger.info("Scanning repository.", { repo: this.config.repoRoot });
      const scanner = new RepoScanner(this.config.repoRoot, this.logger);
      const snapshot = scanner.scan();

      const dependencyGraph = new DependencyGraphBuilder(this.logger).build(snapshot);
      const callGraph = new CallGraphBuilder(this.logger).build(snapshot);
      const dataFlowGraph = new DataFlowGraphBuilder(this.logger).build(snapshot);

      const tscIngest = new TscIngest(this.logger);
      const tscDiagnostics = tscIngest.collect(snapshot);

      const eslintIngest = new EslintIngest(this.logger);
      const eslintDiagnostics = await eslintIngest.collect(this.config.repoRoot);

      const runtimeIngest = new RuntimeIngest(this.logger);
      const runtimeDiagnostics = runtimeIngest.collect();

      const ollama = this.config.ollama.enabled
        ? new OllamaClient(this.config.ollama, this.logger)
        : undefined;
      const solver = new SolverAgent(this.logger, ollama);
      const critic = new CriticAgent(this.logger, ollama);
      const verifier = new VerifierAgent(this.logger, new TestSynthesis(this.logger), ollama);

      const intent = new IntentParser().parse("scan and repair");

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
        const explanation = new FailureExplanationEngine().build(
          "Ultra-strict mode blocked execution.",
          solverResult.rationale.split(","),
          solverResult.violations
        );
        return {
          status: "blocked",
          message: "Ultra-strict mode blocked execution.",
          patchesApplied: 0,
          explanation
        };
      }

      const patchApplier = new PatchApplier(this.logger);
      this.lastPlan = {
        patches: solverResult.patches,
        previews: patchApplier.previewPatches(solverResult.patches),
        confidence: solverResult.confidence,
        rationale: solverResult.rationale
      };

      const criticResult = await critic.reviewWithOllama(
        solverResult,
        this.config.confidenceThreshold
      );
      if (!criticResult.approved) {
        this.memory.recordFailure(solverResult, "critic-veto");
        const explanation = new FailureExplanationEngine().build(
          criticResult.reason,
          solverResult.rationale.split(","),
          solverResult.violations
        );
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
        const explanation = new FailureExplanationEngine().build(
          "No patches applied.",
          solverResult.rationale.split(","),
          solverResult.violations
        );
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
        const explanation = new FailureExplanationEngine().build(
          verifyResult.reason,
          solverResult.rationale.split(","),
          solverResult.violations
        );
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
    } finally {
      this.lock.release();
    }
  }

  async startUi(): Promise<void> {
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    const uiPath = path.resolve(this.config.uiDir);
    app.use(express.static(uiPath));

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
      res.json(
        this.lastPlan ?? {
          patches: [],
          previews: [],
          confidence: 0,
          rationale: "No plan."
        }
      );
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
      const { safeMode } = req.body as { safeMode: boolean };
      this.config.safeMode = Boolean(safeMode);
      res.json({ safeMode: this.config.safeMode });
    });

    app.listen(this.config.port, () => {
      this.logger.info(`UI server listening on port ${this.config.port}.`);
    });
  }
}
