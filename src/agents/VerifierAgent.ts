import { Logger } from "../core/Logger";
import { RepoScanner } from "../analysis/RepoScanner";
import { PatchApplicationResult } from "../patch/PatchTypes";
import { TscIngest } from "../compiler/TscIngest";
import { TestSynthesis } from "../runtime/TestSynthesis";
import { OllamaClient } from "../llm/OllamaClient";

export class VerifierAgent {
  constructor(
    private logger: Logger,
    private tests: TestSynthesis,
    private ollama?: OllamaClient
  ) {}

  verify(snapshot: { root: string }, _patches: PatchApplicationResult): {
    ok: boolean;
    reason: string;
  } {
    const scanner = new RepoScanner(snapshot.root, this.logger);
    const newSnapshot = scanner.scan();
    const tsc = new TscIngest(this.logger);
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

  async verifyWithOllama(
    snapshot: { root: string },
    patches: PatchApplicationResult
  ): Promise<{ ok: boolean; reason: string }> {
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
      const parsed = JSON.parse(response) as { summary?: string };
      if (parsed.summary) {
        return {
          ok: false,
          reason: `${base.reason} ${parsed.summary}`
        };
      }
      return base;
    } catch {
      return base;
    }
  }
}
