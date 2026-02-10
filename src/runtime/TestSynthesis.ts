import fs from "fs";
import path from "path";
import ts from "typescript";
import { Logger } from "../core/Logger";
import { FileUtils } from "../utils/FileUtils";
import { RepoScanner } from "../analysis/RepoScanner";
import { execFileSync } from "child_process";

export class TestSynthesis {
  constructor(private logger: Logger) {}

  run(root: string): { ok: boolean; reason: string } {
    try {
      const scanner = new RepoScanner(root, this.logger);
      const snapshot = scanner.scan();
      const tests = this.generateSmokeTests(snapshot.program, snapshot.root);
      if (tests.length === 0) {
        return { ok: true, reason: "No tests synthesized." };
      }

      const testDir = path.join(root, ".aegis-tests");
      FileUtils.ensureDir(testDir);
      const outDir = path.join(testDir, "out");
      FileUtils.ensureDir(outDir);

      const emitProgram = ts.createProgram(snapshot.files, {
        ...snapshot.compilerOptions,
        outDir
      });
      const emitResult = emitProgram.emit();
      if (emitResult.emitSkipped) {
        return { ok: false, reason: "Emit skipped during test synthesis." };
      }

      const testFile = path.join(testDir, "smoke.test.ts");
      const testContent = this.renderTestFile(tests, snapshot.root, outDir);
      FileUtils.writeFile(testFile, testContent);

      const output = ts.transpileModule(testContent, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
      }).outputText;

      const jsFile = path.join(testDir, "smoke.test.js");
      fs.writeFileSync(jsFile, output, "utf8");
      execFileSync("node", [jsFile], { cwd: root, stdio: "pipe" });
      return { ok: true, reason: "Smoke tests passed." };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }

  private generateSmokeTests(program: ts.Program, root: string): Array<{
    modulePath: string;
    functionName: string;
  }> {
    const tests: Array<{ modulePath: string; functionName: string }> = [];
    const allowed = /^(get|build|create|make|compute|calc)/i;
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) {
        continue;
      }
      if (!sourceFile.fileName.startsWith(root)) {
        continue;
      }
      const modulePath = sourceFile.fileName;
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name && node.parameters.length === 0) {
          if (!allowed.test(node.name.text)) {
            return;
          }
          if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
            tests.push({ modulePath, functionName: node.name.text });
          }
        }
      });
    }
    return tests;
  }

  private renderTestFile(
    tests: Array<{ modulePath: string; functionName: string }>,
    root: string,
    outDir: string
  ): string {
    const lines: string[] = [];
    lines.push("const assert = require('assert');");
    tests.forEach((test, index) => {
      const relToRoot = path.relative(root, test.modulePath).replace(/\\\\/g, "/");
      const jsPath = path
        .join(outDir, relToRoot)
        .replace(/\\.tsx?$/, ".js")
        .replace(/\\\\/g, "/");
      lines.push(`const mod${index} = require('${jsPath}');`);
      lines.push(
        `assert.doesNotThrow(() => { if (mod${index}.${test.functionName}) { mod${index}.${test.functionName}(); } });`
      );
    });
    lines.push("console.log('Aegis smoke tests passed');");
    return lines.join("\n");
  }
}
