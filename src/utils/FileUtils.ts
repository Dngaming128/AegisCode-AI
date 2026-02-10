import fs from "fs";
import path from "path";

const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".aegis-tests"
]);

export class FileUtils {
  static scanTypescriptFiles(root: string): string[] {
    const results: string[] = [];

    function walk(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (DEFAULT_IGNORES.has(entry.name)) {
          continue;
        }
        const full = path.join(dir, entry.name);
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

  static ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static readFile(filePath: string): string {
    return fs.readFileSync(filePath, "utf8");
  }

  static writeFile(filePath: string, content: string): void {
    this.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
  }
}
