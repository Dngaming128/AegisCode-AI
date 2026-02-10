import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Logger } from "../core/Logger";
import { MemoryEntry, MemoryState } from "./MemoryTypes";
import { SolveResult } from "../agents/AgentTypes";

export class MemoryStore {
  private filePath: string;
  private state: MemoryState;
  private frozen = false;

  constructor(private dir: string, private logger: Logger) {
    this.filePath = path.join(dir, "memory.json");
    this.state = this.load();
  }

  read(): MemoryState {
    return this.state;
  }

  recordSuccess(result: SolveResult): void {
    this.record(result, true, "success");
  }

  recordFailure(result: SolveResult, reason: string): void {
    if (this.frozen) {
      this.logger.warn("Memory is frozen due to signature mismatch.");
      return;
    }
    this.record(result, false, reason);
    this.state.failurePatterns[reason] =
      (this.state.failurePatterns[reason] ?? 0) + 1;
    this.save();
  }

  private record(result: SolveResult, success: boolean, reason: string): void {
    if (this.frozen) {
      this.logger.warn("Memory is frozen due to signature mismatch.");
      return;
    }
    const entry: MemoryEntry = {
      timestamp: new Date().toISOString(),
      success,
      rationale: `${reason}: ${result.rationale}`,
      patchCount: result.patches.length,
      confidence: result.confidence
    };
    this.state.shortTerm.push(entry);
    if (this.state.shortTerm.length > 50) {
      this.state.shortTerm.shift();
    }
    this.state.longTerm.push(entry);
    if (this.state.longTerm.length > 500) {
      this.state.longTerm.shift();
    }
    this.state.confidenceHistory.push(result.confidence);
    if (this.state.confidenceHistory.length > 200) {
      this.state.confidenceHistory.shift();
    }
    this.state.successRate = this.calculateSuccessRate();
    this.save();
    this.logger.info("Memory updated.", { success });
  }

  private calculateSuccessRate(): number {
    const total = this.state.longTerm.length;
    if (total === 0) {
      return 0.5;
    }
    const successCount = this.state.longTerm.filter((entry) => entry.success).length;
    return successCount / total;
  }

  private load(): MemoryState {
    if (!fs.existsSync(this.filePath)) {
      return {
        shortTerm: [],
        longTerm: [],
        failurePatterns: {},
        confidenceHistory: [],
        successRate: 0.5
      };
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    const payload = JSON.parse(raw) as { signature: string; state: MemoryState };
    const expected = this.sign(JSON.stringify(payload.state));
    if (payload.signature !== expected) {
      this.frozen = true;
      this.logger.error("Memory signature mismatch. Freezing memory.");
      return {
        shortTerm: [],
        longTerm: [],
        failurePatterns: {},
        confidenceHistory: [],
        successRate: 0.5
      };
    }
    return payload.state;
  }

  private save(): void {
    if (this.frozen) {
      return;
    }
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    const payload = {
      signature: this.sign(JSON.stringify(this.state)),
      state: this.state
    };
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), "utf8");
  }

  private sign(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
