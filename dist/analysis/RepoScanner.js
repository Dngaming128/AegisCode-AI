"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoScanner = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const FileUtils_1 = require("../utils/FileUtils");
class RepoScanner {
    constructor(root, logger) {
        this.root = root;
        this.logger = logger;
    }
    scan() {
        const tsconfigPath = path_1.default.resolve(this.root, "tsconfig.json");
        let compilerOptions = {
            strict: true,
            target: typescript_1.default.ScriptTarget.ES2020,
            module: typescript_1.default.ModuleKind.CommonJS
        };
        let files = [];
        if (fs_1.default.existsSync(tsconfigPath)) {
            const configFile = typescript_1.default.readConfigFile(tsconfigPath, typescript_1.default.sys.readFile);
            const parsed = typescript_1.default.parseJsonConfigFileContent(configFile.config, typescript_1.default.sys, this.root);
            compilerOptions = parsed.options;
            files = parsed.fileNames;
        }
        else {
            files = FileUtils_1.FileUtils.scanTypescriptFiles(this.root);
        }
        const program = typescript_1.default.createProgram(files, compilerOptions);
        this.logger.info("Repository scanned.", { files: files.length });
        return {
            root: this.root,
            files,
            program,
            compilerOptions
        };
    }
}
exports.RepoScanner = RepoScanner;
