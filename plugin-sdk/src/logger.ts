/**
 * SDK logging.
 *
 * Plugin processes write to stdout and stderr, and Dot X shows that output in
 * the plugin log viewer. The SDK's own chatter goes through this logger so a
 * plugin author sees connection detail only when they ask for it. Set
 * `DOTX_PLUGIN_LOG_LEVEL` to `debug`, `info`, `warn`, `error`, or `silent`. The
 * default is `info`. Anything a plugin logs itself is untouched.
 *
 * @internal
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const DEFAULT_LEVEL: LogLevel = "info";

/** Reads an environment variable in both Deno and Node.js. @internal */
function readEnv(name: string): string | undefined {
  try {
    // @ts-ignore - Deno global may not be defined in all environments
    if (typeof Deno !== "undefined" && Deno.env) {
      // @ts-ignore
      return Deno.env.get(name) || undefined;
    }
  } catch (e) {
    // Deno not available, try Node.js
  }

  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env[name] || undefined;
    }
  } catch (e) {
    // process not available
  }

  return undefined;
}

function configuredLevel(): LogLevel {
  const requested = (readEnv("DOTX_PLUGIN_LOG_LEVEL") || "").trim().toLowerCase();
  return requested in RANK ? (requested as LogLevel) : DEFAULT_LEVEL;
}

let threshold: number | null = null;

function enabled(level: Exclude<LogLevel, "silent">): boolean {
  if (threshold === null) threshold = RANK[configuredLevel()];
  return RANK[level] >= threshold;
}

/** @internal */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Creates a logger that prefixes every message with `[scope]`.
 *
 * @internal
 */
export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug: (...args) => {
      if (enabled("debug")) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (enabled("info")) console.info(prefix, ...args);
    },
    warn: (...args) => {
      if (enabled("warn")) console.warn(prefix, ...args);
    },
    error: (...args) => {
      if (enabled("error")) console.error(prefix, ...args);
    },
  };
}
