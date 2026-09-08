/**
 * Frontend logging.
 *
 * Every log call in `src/` goes through here so debug chatter can be switched
 * off in release builds. Development builds log everything from `debug` up,
 * release builds only `warn` and `error`. Set `VITE_LOG_LEVEL` to a level name
 * (or `silent`) at build time to override that.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const RANK: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};

function isLevel(value: string): value is LogLevel {
    return Object.prototype.hasOwnProperty.call(RANK, value);
}

function configuredLevel(): LogLevel {
    const requested = (import.meta.env.VITE_LOG_LEVEL || "").trim().toLowerCase();
    if (isLevel(requested)) return requested;
    return import.meta.env.DEV ? "debug" : "warn";
}

const threshold = RANK[configuredLevel()];

function enabled(level: Exclude<LogLevel, "silent">) {
    return RANK[level] >= threshold;
}

export interface Logger {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

/**
 * Creates a logger that prefixes every message with `[scope]`, so a console
 * line says which part of the app wrote it.
 *
 * @example
 * const log = createLogger("decker");
 * log.debug("Connecting", comPort);
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
