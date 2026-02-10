import { Logger } from "../core/Logger";
import { SolveResult } from "./AgentTypes";
import { OllamaClient } from "../llm/OllamaClient";

export interface CriticResult {
  approved: boolean;
  reason: string;
}

export class CriticAgent {
  constructor(private logger: Logger, private ollama?: OllamaClient) {}

  review(result: SolveResult, threshold: number): CriticResult {
    if (result.patches.length === 0) {
      return { approved: false, reason: "No patches proposed." };
    }

    if (result.confidence < threshold) {
      return {
        approved: false,
        reason: `Confidence ${result.confidence.toFixed(2)} below threshold ${threshold.toFixed(
          2
        )}.`
      };
    }

    const risky = result.patches.filter((patch) => patch.confidence < 0.65);
    if (risky.length > 0) {
      this.logger.warn("Critic vetoed low-confidence patches.", {
        count: risky.length
      });
      return { approved: false, reason: "Low-confidence patch detected." };
    }

    return { approved: true, reason: "Approved." };
  }

  async reviewWithOllama(result: SolveResult, threshold: number): Promise<CriticResult> {
    const base = this.review(result, threshold);
    if (!this.ollama) {
      return base;
    }

    const prompt = [
      "You are the critic agent for a TypeScript refactor tool.",
      "Decide approve or reject. Respond with strict JSON only.",
      "Schema: {\"decision\": \"approve\"|\"reject\", \"reason\": string}",
      "Context:",
      `Patches: ${result.patches.length}`,
      `Confidence: ${result.confidence.toFixed(2)}`,
      `Threshold: ${threshold.toFixed(2)}`
    ].join("\n");

    const response = await this.ollama.generate("critic", prompt);
    if (!response) {
      return base;
    }

    try {
      const parsed = JSON.parse(response) as { decision?: string; reason?: string };
      if (parsed.decision === "reject") {
        return {
          approved: false,
          reason: parsed.reason ?? "LLM vetoed."
        };
      }
      if (parsed.decision === "approve") {
        return {
          approved: true,
          reason: parsed.reason ?? base.reason
        };
      }
      return base;
    } catch {
      return base;
    }
  }
}
