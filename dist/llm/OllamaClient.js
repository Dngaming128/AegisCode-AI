"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = void 0;
class OllamaClient {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }
    async generate(role, prompt) {
        if (!this.config.enabled) {
            return null;
        }
        const models = this.config.models[role] ?? [];
        if (models.length === 0) {
            return null;
        }
        for (const model of models) {
            const result = await this.tryModel(model, prompt);
            if (result !== null) {
                return result;
            }
        }
        this.logger.warn("Ollama generation failed for all models.", { role });
        return null;
    }
    async tryModel(model, prompt) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const res = await fetch(`${this.config.baseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: { temperature: 0.2 }
                }),
                signal: controller.signal
            });
            if (!res.ok) {
                this.logger.warn("Ollama request failed.", { model, status: res.status });
                return null;
            }
            const data = (await res.json());
            if (!data.response) {
                return null;
            }
            return data.response.trim();
        }
        catch (err) {
            this.logger.warn("Ollama request error.", { model, error: String(err) });
            return null;
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.OllamaClient = OllamaClient;
