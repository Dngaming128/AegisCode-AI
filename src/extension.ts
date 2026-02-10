import * as vscode from "vscode";
import path from "path";
import fs from "fs";
import { Engine } from "./core/Engine";
import { EngineConfig, defaultConfig } from "./core/Config";

let uiEngine: Engine | null = null;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildConfig(context: vscode.ExtensionContext, mode: EngineConfig["mode"]): EngineConfig {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const repoRoot = workspaceFolder?.uri.fsPath ?? process.cwd();
  const settings = vscode.workspace.getConfiguration("aegisCodeAI");
  const memoryDir = context.globalStorageUri.fsPath;
  const uiDir = path.join(context.extensionPath, "ui");

  ensureDir(memoryDir);

  return {
    repoRoot,
    mode,
    port: settings.get<number>("port", defaultConfig.port),
    safeMode: settings.get<boolean>("safeMode", defaultConfig.safeMode),
    ultraStrict: settings.get<boolean>("ultraStrict", defaultConfig.ultraStrict),
    confidenceThreshold: settings.get<number>(
      "confidenceThreshold",
      defaultConfig.confidenceThreshold
    ),
    memoryDir,
    uiDir,
    ollama: {
      enabled: settings.get<boolean>("ollama.enabled", defaultConfig.ollama.enabled),
      baseUrl: settings.get<string>("ollama.baseUrl", defaultConfig.ollama.baseUrl),
      timeoutMs: settings.get<number>("ollama.timeoutMs", defaultConfig.ollama.timeoutMs),
      models: {
        solver: settings.get<string[]>(
          "ollama.models.solver",
          defaultConfig.ollama.models.solver
        ),
        critic: settings.get<string[]>(
          "ollama.models.critic",
          defaultConfig.ollama.models.critic
        ),
        verifier: settings.get<string[]>(
          "ollama.models.verifier",
          defaultConfig.ollama.models.verifier
        )
      }
    }
  };
}

async function runWithProgress<T>(
  title: string,
  task: () => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    async () => task()
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const scanCommand = vscode.commands.registerCommand(
    "aegisCodeAI.scanAndRepair",
    async () => {
      const config = buildConfig(context, "scan");
      const engine = new Engine(config);
      const result = await runWithProgress("Aegis: Scanning and repairing...", () =>
        engine.runOnce()
      );
      if (result.status === "ok") {
        vscode.window.showInformationMessage(
          `Aegis: ${result.message} (${result.patchesApplied} patches).`
        );
      } else {
        vscode.window.showWarningMessage(`Aegis blocked: ${result.message}`);
      }
    }
  );

  const planCommand = vscode.commands.registerCommand("aegisCodeAI.plan", async () => {
    const config = buildConfig(context, "scan");
    const engine = new Engine(config);
    const result = await runWithProgress("Aegis: Generating plan...", () => engine.plan());
    if (result.status === "ok") {
      vscode.window.showInformationMessage(`Aegis: ${result.message}`);
    } else {
      vscode.window.showWarningMessage(`Aegis blocked: ${result.message}`);
    }
  });

  const uiCommand = vscode.commands.registerCommand("aegisCodeAI.startUi", async () => {
    if (uiEngine) {
      vscode.window.showInformationMessage("Aegis UI server is already running.");
      return;
    }
    const config = buildConfig(context, "ui");
    uiEngine = new Engine(config);
    await runWithProgress("Aegis: Starting UI server...", () => uiEngine!.startUi());
    vscode.window.showInformationMessage(
      `Aegis UI server started on port ${config.port}.`
    );
  });

  context.subscriptions.push(scanCommand, planCommand, uiCommand);
}

export function deactivate(): void {
  uiEngine = null;
}
