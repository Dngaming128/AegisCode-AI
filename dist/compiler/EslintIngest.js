"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EslintIngest = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class EslintIngest {
    constructor(logger) {
        this.logger = logger;
    }
    hasEslintConfig(root) {
        const configs = [
            ".eslintrc",
            ".eslintrc.json",
            ".eslintrc.js",
            ".eslintrc.cjs",
            "eslint.config.js",
            "eslint.config.cjs"
        ];
        return configs.some((file) => fs_1.default.existsSync(path_1.default.join(root, file)));
    }
    async collect(root) {
        if (!this.hasEslintConfig(root)) {
            return [];
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { ESLint } = require("eslint");
            const eslint = new ESLint({ cwd: root });
            const results = await eslint.lintFiles(["**/*.ts", "**/*.tsx"]);
            const diagnostics = [];
            for (const result of results) {
                for (const msg of result.messages) {
                    diagnostics.push({
                        source: "eslint",
                        code: msg.ruleId ? Number.NaN : undefined,
                        message: msg.message,
                        filePath: result.filePath,
                        position: msg.line,
                        severity: msg.severity === 2 ? "error" : "warning"
                    });
                }
            }
            this.logger.info("ESLint diagnostics collected.", {
                count: diagnostics.length
            });
            return diagnostics;
        }
        catch (error) {
            this.logger.warn("ESLint ingestion failed.", error);
            return [];
        }
    }
}
exports.EslintIngest = EslintIngest;
