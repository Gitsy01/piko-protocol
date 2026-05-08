import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel) {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[env.LOG_LEVEL];
}

export function log(level: LogLevel, message: string, ...details: unknown[]) {
  if (!shouldLog(level)) {
    return;
  }

  if (level === "debug" || level === "info") {
    console.log(message, ...details);
    return;
  }

  console[level](message, ...details);
}
