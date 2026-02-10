"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.loadConfig = loadConfig;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
exports.defaultConfig = {
    repoRoot: process.cwd(),
    mode: "ui",
    port: 4000,
    safeMode: false,
    ultraStrict: false,
    confidenceThreshold: 0.72,
    memoryDir: path_1.default.resolve(process.cwd(), "data"),
    uiDir: path_1.default.resolve(process.cwd(), "ui"),
    ollama: {
        enabled: false,
        baseUrl: "http://localhost:11434",
        timeoutMs: 15000,
        models: {
            solver: ["qwen2.5-coder:3b", "llama3.1:8b", "qwen2.5-coder:7b-instruct"],
            critic: ["qwen2.5-coder:7b-instruct", "llama3.1:8b", "qwen2.5-coder:3b"],
            verifier: ["qwen2.5-coder:3b", "llama3.1:8b", "qwen2.5-coder:7b-instruct"]
        }
    }
};
function loadConfig(args) {
    const config = { ...exports.defaultConfig };
    const env = process.env;
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === "--repo" && args[i + 1]) {
            config.repoRoot = path_1.default.resolve(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg === "--scan") {
            config.mode = "scan";
            continue;
        }
        if (arg === "--ui") {
            config.mode = "ui";
            continue;
        }
        if (arg === "--port" && args[i + 1]) {
            config.port = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg === "--safe") {
            config.safeMode = true;
            continue;
        }
        if (arg === "--ultra") {
            config.ultraStrict = true;
            continue;
        }
        if (arg === "--threshold" && args[i + 1]) {
            config.confidenceThreshold = Number(args[i + 1]);
            i += 1;
            continue;
        }
        if (arg === "--ollama") {
            config.ollama.enabled = true;
            continue;
        }
        if (arg === "--ollama-url" && args[i + 1]) {
            config.ollama.baseUrl = args[i + 1];
            i += 1;
            continue;
        }
        if (arg === "--ollama-models" && args[i + 1]) {
            const models = args[i + 1].split(",").map((model) => model.trim()).filter(Boolean);
            if (models.length > 0) {
                config.ollama.models = {
                    solver: models,
                    critic: models,
                    verifier: models
                };
            }
            i += 1;
            continue;
        }
    }
    if (env.OLLAMA_ENABLED === "true") {
        config.ollama.enabled = true;
    }
    if (env.OLLAMA_URL) {
        config.ollama.baseUrl = env.OLLAMA_URL;
    }
    if (env.OLLAMA_MODELS) {
        const models = env.OLLAMA_MODELS.split(",").map((model) => model.trim()).filter(Boolean);
        if (models.length > 0) {
            config.ollama.models = {
                solver: models,
                critic: models,
                verifier: models
            };
        }
    }
    const configPath = path_1.default.resolve(config.repoRoot, "aegis.config.json");
    if (fs_1.default.existsSync(configPath)) {
        const raw = fs_1.default.readFileSync(configPath, "utf8");
        const fileConfig = JSON.parse(raw);
        return {
            ...config,
            ...fileConfig,
            repoRoot: path_1.default.resolve(fileConfig.repoRoot ?? config.repoRoot),
            memoryDir: path_1.default.resolve(fileConfig.memoryDir ?? config.memoryDir),
            uiDir: path_1.default.resolve(fileConfig.uiDir ?? config.uiDir)
        };
    }
    return config;
}
