"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
class MemoryStore {
    constructor(dir, logger) {
        this.dir = dir;
        this.logger = logger;
        this.frozen = false;
        this.filePath = path_1.default.join(dir, "memory.json");
        this.state = this.load();
    }
    read() {
        return this.state;
    }
    recordSuccess(result) {
        this.record(result, true, "success");
    }
    recordFailure(result, reason) {
        if (this.frozen) {
            this.logger.warn("Memory is frozen due to signature mismatch.");
            return;
        }
        this.record(result, false, reason);
        this.state.failurePatterns[reason] =
            (this.state.failurePatterns[reason] ?? 0) + 1;
        this.save();
    }
    record(result, success, reason) {
        if (this.frozen) {
            this.logger.warn("Memory is frozen due to signature mismatch.");
            return;
        }
        const entry = {
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
    calculateSuccessRate() {
        const total = this.state.longTerm.length;
        if (total === 0) {
            return 0.5;
        }
        const successCount = this.state.longTerm.filter((entry) => entry.success).length;
        return successCount / total;
    }
    load() {
        if (!fs_1.default.existsSync(this.filePath)) {
            return {
                shortTerm: [],
                longTerm: [],
                failurePatterns: {},
                confidenceHistory: [],
                successRate: 0.5
            };
        }
        const raw = fs_1.default.readFileSync(this.filePath, "utf8");
        const payload = JSON.parse(raw);
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
    save() {
        if (this.frozen) {
            return;
        }
        if (!fs_1.default.existsSync(this.dir)) {
            fs_1.default.mkdirSync(this.dir, { recursive: true });
        }
        const payload = {
            signature: this.sign(JSON.stringify(this.state)),
            state: this.state
        };
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), "utf8");
    }
    sign(content) {
        return crypto_1.default.createHash("sha256").update(content).digest("hex");
    }
}
exports.MemoryStore = MemoryStore;
