// @ts-check

/**
 * Bounded-cardinality telemetry for the resilient remote cache handler.
 *
 * The handler runs on every storefront request, and its keys embed merchant
 * slugs, product slugs and crawler-supplied paths. Those must NEVER become
 * metric labels: the label space would grow without bound (one series per
 * crawler URL) and the logs would fill with scraped paths.
 *
 * The entire label space here is the cross product of two frozen allowlists, so
 * it cannot grow at runtime. Anything unrecognised folds into `unknown`.
 *
 * Plain ESM, dependency-free — Node imports this directly (see
 * `remote-cache-handler.mjs`).
 *
 * @typedef {'get' | 'set' | 'refresh_tags' | 'get_expiration' | 'update_tags' | 'unknown'} CacheTelemetryOperation
 * @typedef {'hit' | 'miss' | 'write' | 'skip_oversized' | 'skip_circuit_open' | 'skip_disabled' | 'failure' | 'success' | 'unknown'} CacheTelemetryOutcome
 *
 * @typedef {object} TelemetryLogger
 * @property {(message: string) => void} log
 * @property {(message: string) => void} warn
 * @property {(message: string) => void} error
 *
 * @typedef {object} CacheTelemetryOptions
 * @property {TelemetryLogger} [logger]
 * @property {number} [flushIntervalMs]
 * @property {() => number} [now]
 *
 * @typedef {object} CacheTelemetry
 * @property {(operation: CacheTelemetryOperation, outcome: CacheTelemetryOutcome) => void} record
 * @property {() => Record<string, number>} snapshot
 * @property {() => void} maybeFlush
 */

/** @type {readonly CacheTelemetryOperation[]} */
export const CACHE_TELEMETRY_OPERATIONS = Object.freeze([
  'get',
  'set',
  'refresh_tags',
  'get_expiration',
  'update_tags',
]);

/** @type {readonly CacheTelemetryOutcome[]} */
export const CACHE_TELEMETRY_OUTCOMES = Object.freeze([
  'hit',
  'miss',
  'write',
  'skip_oversized',
  'skip_circuit_open',
  'skip_disabled',
  'failure',
  'success',
]);

export const DEFAULT_FLUSH_INTERVAL_MS = 60_000;

/** Log prefix — greppable in Vercel logs and stable for log-drain parsing. */
export const CACHE_TELEMETRY_LOG_PREFIX = '[resilient-remote-cache]';

/**
 * @param {unknown} value
 * @param {readonly string[]} allowlist
 * @returns {string}
 */
function toBoundedLabel(value, allowlist) {
  return typeof value === 'string' && allowlist.includes(value)
    ? value
    : 'unknown';
}

/**
 * @param {CacheTelemetryOptions} [options]
 * @returns {CacheTelemetry}
 */
export function createCacheTelemetry(options = {}) {
  const logger = options.logger ?? console;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const now = options.now ?? Date.now;

  /** @type {Map<string, number>} */
  const counters = new Map();
  let windowStartedAt = now();

  return {
    record(operation, outcome) {
      // Both labels are forced through the allowlists — a cache key passed here
      // by mistake becomes `unknown`, never a new series.
      const op = toBoundedLabel(operation, CACHE_TELEMETRY_OPERATIONS);
      const result = toBoundedLabel(outcome, CACHE_TELEMETRY_OUTCOMES);
      const key = `${op}.${result}`;
      counters.set(key, (counters.get(key) ?? 0) + 1);
    },

    snapshot() {
      return Object.fromEntries(counters);
    },

    /**
     * Emits at most one summary line per window. Deliberately pull-based: a
     * `setInterval` would keep a serverless function's event loop alive.
     */
    maybeFlush() {
      const current = now();
      if (current - windowStartedAt < flushIntervalMs) {
        return;
      }

      windowStartedAt = current;
      if (counters.size === 0) {
        return;
      }

      const counts = Object.fromEntries(counters);
      counters.clear();
      logger.log(
        `${CACHE_TELEMETRY_LOG_PREFIX} ${JSON.stringify({
          windowMs: flushIntervalMs,
          counts,
        })}`
      );
    },
  };
}
