"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSynthesis = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const FileUtils_1 = require("../utils/FileUtils");
const RepoScanner_1 = require("../analysis/RepoScanner");
const child_process_1 = require("child_process");
class TestSynthesis {
    constructor(logger) {
        this.logger = logger;
    }
    run(root) {
        try {
            const scanner = new RepoScanner_1.RepoScanner(root, this.logger);
            const snapshot = scanner.scan();
            const tests = this.generateSmokeTests(snapshot.program, snapshot.root);
            if (tests.length === 0) {
                return { ok: true, reason: "No tests synthesized." };
            }
            const testDir = path_1.default.join(root, ".aegis-tests");
            FileUtils_1.FileUtils.ensureDir(testDir);
            const outDir = path_1.default.join(testDir, "out");
            FileUtils_1.FileUtils.ensureDir(outDir);
            const emitProgram = typescript_1.default.createProgram(snapshot.files, {
                ...snapshot.compilerOptions,
                outDir
            });
            const emitResult = emitProgram.emit();
            if (emitResult.emitSkipped) {
                return { ok: false, reason: "Emit skipped during test synthesis." };
            }
            const testFile = path_1.default.join(testDir, "smoke.test.ts");
            const testContent = this.renderTestFile(tests, snapshot.root, outDir);
            FileUtils_1.FileUtils.writeFile(testFile, testContent);
            const output = typescript_1.default.transpileModule(testContent, {
                compilerOptions: { module: typescript_1.default.ModuleKind.CommonJS, target: typescript_1.default.ScriptTarget.ES2020 }
            }).outputText;
            const jsFile = path_1.default.join(testDir, "smoke.test.js");
            fs_1.default.writeFileSync(jsFile, output, "utf8");
            (0, child_process_1.execFileSync)("node", [jsFile], { cwd: root, stdio: "pipe" });
            return { ok: true, reason: "Smoke tests passed." };
        }
        catch (error) {
            return { ok: false, reason: String(error) };
        }
    }
    generateSmokeTests(program, root) {
        const tests = [];
        const allowed = /^(get|build|create|make|compute|calc)/i;
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) {
                continue;
            }
            if (!sourceFile.fileName.startsWith(root)) {
                continue;
            }
            const modulePath = sourceFile.fileName;
            typescript_1.default.forEachChild(sourceFile, (node) => {
                if (typescript_1.default.isFunctionDeclaration(node) && node.name && node.parameters.length === 0) {
                    if (!allowed.test(node.name.text)) {
                        return;
                    }
                    if (node.modifiers?.some((mod) => mod.kind === typescript_1.default.SyntaxKind.ExportKeyword)) {
                        tests.push({ modulePath, functionName: node.name.text });
                    }
                }
            });
        }
        return tests;
    }
    renderTestFile(tests, root, outDir) {
        const lines = [];
        lines.push("const assert = require('assert');");
        tests.forEach((test, index) => {
            const relToRoot = path_1.default.relative(root, test.modulePath).replace(/\\\\/g, "/");
            const jsPath = path_1.default
                .join(outDir, relToRoot)
                .replace(/\\.tsx?$/, ".js")
                .replace(/\\\\/g, "/");
            lines.push(`const mod${index} = require('${jsPath}');`);
            lines.push(`assert.doesNotThrow(() => { if (mod${index}.${test.functionName}) { mod${index}.${test.functionName}(); } });`);
        });
        lines.push("console.log('Aegis smoke tests passed');");
        return lines.join("\n");
    }
}
exports.TestSynthesis = TestSynthesis;
