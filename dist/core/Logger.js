"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    constructor(level = "info") {
        this.level = level;
    }
    shouldLog(target) {
        const order = {
            debug: 10,
            info: 20,
            warn: 30,
            error: 40
        };
        return order[target] >= order[this.level];
    }
    debug(message, meta) {
        if (this.shouldLog("debug")) {
            console.debug(`[debug] ${message}`, meta ?? "");
        }
    }
    info(message, meta) {
        if (this.shouldLog("info")) {
            console.info(`[info] ${message}`, meta ?? "");
        }
    }
    warn(message, meta) {
        if (this.shouldLog("warn")) {
            console.warn(`[warn] ${message}`, meta ?? "");
        }
    }
    error(message, meta) {
        if (this.shouldLog("error")) {
            console.error(`[error] ${message}`, meta ?? "");
        }
    }
}
exports.Logger = Logger;
