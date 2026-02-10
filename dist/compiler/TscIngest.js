"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TscIngest = void 0;
const typescript_1 = __importDefault(require("typescript"));
class TscIngest {
    constructor(logger) {
        this.logger = logger;
    }
    collect(snapshot) {
        const diagnostics = typescript_1.default.getPreEmitDiagnostics(snapshot.program);
        const results = diagnostics.map((diag) => {
            const message = typescript_1.default.flattenDiagnosticMessageText(diag.messageText, "\n");
            return {
                source: "tsc",
                code: diag.code,
                message,
                filePath: diag.file?.fileName,
                position: diag.start,
                severity: diag.category === typescript_1.default.DiagnosticCategory.Error ? "error" : "warning"
            };
        });
        this.logger.info("TSC diagnostics collected.", { count: results.length });
        return results;
    }
}
exports.TscIngest = TscIngest;
