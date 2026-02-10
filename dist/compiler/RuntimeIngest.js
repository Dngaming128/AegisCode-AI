"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeIngest = void 0;
class RuntimeIngest {
    constructor(logger) {
        this.logger = logger;
    }
    collect(runtimeLog) {
        if (!runtimeLog || runtimeLog.trim().length === 0) {
            return [];
        }
        this.logger.info("Runtime diagnostics collected.");
        return [
            {
                source: "runtime",
                message: runtimeLog,
                severity: "error"
            }
        ];
    }
}
exports.RuntimeIngest = RuntimeIngest;
