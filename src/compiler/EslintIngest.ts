import fs from "fs";
import path from "path";
import { Logger } from "../core/Logger";
import { DiagnosticInfo } from "./TscIngest";

export class EslintIngest {
  constructor(private logger: Logger) {}

  private hasEslintConfig(root: string): boolean {
    const configs = [
      ".eslintrc",
      ".eslintrc.json",
      ".eslintrc.js",
      ".eslintrc.cjs",
      "eslint.config.js",
      "eslint.config.cjs"
    ];
    return configs.some((file) => fs.existsSync(path.join(root, file)));
  }

  async collect(root: string): Promise<DiagnosticInfo[]> {
    if (!this.hasEslintConfig(root)) {
      return [];
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ESLint } = require("eslint") as typeof import("eslint");
      const eslint = new ESLint({ cwd: root });
      const results = await eslint.lintFiles(["**/*.ts", "**/*.tsx"]);
      const diagnostics: DiagnosticInfo[] = [];
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
    } catch (error) {
      this.logger.warn("ESLint ingestion failed.", error);
      return [];
    }
  }
}
