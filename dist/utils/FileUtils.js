"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_IGNORES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".aegis-tests"
]);
class FileUtils {
    static scanTypescriptFiles(root) {
        const results = [];
        function walk(dir) {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (DEFAULT_IGNORES.has(entry.name)) {
                    continue;
                }
                const full = path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
                    results.push(full);
                }
            }
        }
        walk(root);
        return results;
    }
    static ensureDir(dir) {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    static readFile(filePath) {
        return fs_1.default.readFileSync(filePath, "utf8");
    }
    static writeFile(filePath, content) {
        this.ensureDir(path_1.default.dirname(filePath));
        fs_1.default.writeFileSync(filePath, content, "utf8");
    }
}
exports.FileUtils = FileUtils;
