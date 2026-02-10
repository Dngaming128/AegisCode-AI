export type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  constructor(private level: LogLevel = "info") {}

  private shouldLog(target: LogLevel): boolean {
    const order: Record<LogLevel, number> = {
      debug: 10,
      info: 20,
      warn: 30,
      error: 40
    };
    return order[target] >= order[this.level];
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog("debug")) {
      console.debug(`[debug] ${message}`, meta ?? "");
    }
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog("info")) {
      console.info(`[info] ${message}`, meta ?? "");
    }
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog("warn")) {
      console.warn(`[warn] ${message}`, meta ?? "");
    }
  }

  error(message: string, meta?: unknown): void {
    if (this.shouldLog("error")) {
      console.error(`[error] ${message}`, meta ?? "");
    }
  }
}
