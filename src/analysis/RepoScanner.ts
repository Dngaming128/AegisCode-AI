import fs from "fs";
import path from "path";
import ts from "typescript";
import { Logger } from "../core/Logger";
import { FileUtils } from "../utils/FileUtils";

export interface RepoSnapshot {
  root: string;
  files: string[];
  program: ts.Program;
  compilerOptions: ts.CompilerOptions;
}

export class RepoScanner {
  constructor(private root: string, private logger: Logger) {}

  scan(): RepoSnapshot {
    const tsconfigPath = path.resolve(this.root, "tsconfig.json");
    let compilerOptions: ts.CompilerOptions = {
      strict: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS
    };
    let files: string[] = [];

    if (fs.existsSync(tsconfigPath)) {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        this.root
      );
      compilerOptions = parsed.options;
      files = parsed.fileNames;
    } else {
      files = FileUtils.scanTypescriptFiles(this.root);
    }

    const program = ts.createProgram(files, compilerOptions);
    this.logger.info("Repository scanned.", { files: files.length });

    return {
      root: this.root,
      files,
      program,
      compilerOptions
    };
  }
}
