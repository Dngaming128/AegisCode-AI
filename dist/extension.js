"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Engine_1 = require("./core/Engine");
const Config_1 = require("./core/Config");
let uiEngine = null;
function ensureDir(dir) {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
function buildConfig(context, mode) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const repoRoot = workspaceFolder?.uri.fsPath ?? process.cwd();
    const settings = vscode.workspace.getConfiguration("aegisCodeAI");
    const memoryDir = context.globalStorageUri.fsPath;
    const uiDir = path_1.default.join(context.extensionPath, "ui");
    ensureDir(memoryDir);
    return {
        repoRoot,
        mode,
        port: settings.get("port", Config_1.defaultConfig.port),
        safeMode: settings.get("safeMode", Config_1.defaultConfig.safeMode),
        ultraStrict: settings.get("ultraStrict", Config_1.defaultConfig.ultraStrict),
        confidenceThreshold: settings.get("confidenceThreshold", Config_1.defaultConfig.confidenceThreshold),
        memoryDir,
        uiDir,
        ollama: {
            enabled: settings.get("ollama.enabled", Config_1.defaultConfig.ollama.enabled),
            baseUrl: settings.get("ollama.baseUrl", Config_1.defaultConfig.ollama.baseUrl),
            timeoutMs: settings.get("ollama.timeoutMs", Config_1.defaultConfig.ollama.timeoutMs),
            models: {
                solver: settings.get("ollama.models.solver", Config_1.defaultConfig.ollama.models.solver),
                critic: settings.get("ollama.models.critic", Config_1.defaultConfig.ollama.models.critic),
                verifier: settings.get("ollama.models.verifier", Config_1.defaultConfig.ollama.models.verifier)
            }
        }
    };
}
async function runWithProgress(title, task) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
    }, async () => task());
}
function activate(context) {
    const scanCommand = vscode.commands.registerCommand("aegisCodeAI.scanAndRepair", async () => {
        const config = buildConfig(context, "scan");
        const engine = new Engine_1.Engine(config);
        const result = await runWithProgress("Aegis: Scanning and repairing...", () => engine.runOnce());
        if (result.status === "ok") {
            vscode.window.showInformationMessage(`Aegis: ${result.message} (${result.patchesApplied} patches).`);
        }
        else {
            vscode.window.showWarningMessage(`Aegis blocked: ${result.message}`);
        }
    });
    const planCommand = vscode.commands.registerCommand("aegisCodeAI.plan", async () => {
        const config = buildConfig(context, "scan");
        const engine = new Engine_1.Engine(config);
        const result = await runWithProgress("Aegis: Generating plan...", () => engine.plan());
        if (result.status === "ok") {
            vscode.window.showInformationMessage(`Aegis: ${result.message}`);
        }
        else {
            vscode.window.showWarningMessage(`Aegis blocked: ${result.message}`);
        }
    });
    const uiCommand = vscode.commands.registerCommand("aegisCodeAI.startUi", async () => {
        if (uiEngine) {
            vscode.window.showInformationMessage("Aegis UI server is already running.");
            return;
        }
        const config = buildConfig(context, "ui");
        uiEngine = new Engine_1.Engine(config);
        await runWithProgress("Aegis: Starting UI server...", () => uiEngine.startUi());
        vscode.window.showInformationMessage(`Aegis UI server started on port ${config.port}.`);
    });
    context.subscriptions.push(scanCommand, planCommand, uiCommand);
}
function deactivate() {
    uiEngine = null;
}
