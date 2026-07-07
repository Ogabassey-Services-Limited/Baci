import type { StorefrontInternalPreflightFailOpenReason } from './storefront-internal-preflight';

/**
 * Classifies a supabase-js `.rpc()` resolved-error object into a fail-open
 * reason.
 *
 * supabase-js `.rpc()` does NOT throw on transport failures — an aborted or
 * network-failed fetch RESOLVES into `{ error }`, so the transport's try/catch
 * almost never fires and a blanket 'has-error' buried real timeout/network
 * incidents. This re-separates flattened transport failures from genuine
 * PostgREST/SQLSTATE errors so PostHog volume is attributed to the right mode.
 */

// Postgres statement_timeout (the anon role's DB-side cap). Local: this module
// exposes a single utility (one export per file).
const POSTGRES_STATEMENT_TIMEOUT_CODE = '57014';

// An AbortError/TimeoutError name (or code) that survived flattening.
const ABORT_ERROR_NAME_PATTERN = /^(AbortError|TimeoutError)$/;

// A genuine PostgREST/SQLSTATE error code, which is AUTHORITATIVE and must
// never be reclassified by message wording: a 5-char SQLSTATE (e.g. 57014,
// 25P02, XX000) or a PostgREST code (PGRST + digits). A flattened transport
// failure instead carries an EMPTY code or a small numeric DOMException legacy
// code (AbortError=20, TimeoutError=23), neither of which matches this shape.
const DATABASE_ERROR_CODE_PATTERN = /^(?:[0-9A-Z]{5}|PGRST\d+)$/;

// Abort/timeout wording in a flattened transport message. `timeout` never
// matches the network error code "ETIMEDOUT" (…TIMED-OUT, not TIME-OUT).
const ABORT_OR_TIMEOUT_MESSAGE_PATTERN = /abort|timeout/i;

/**
 * Pure and directly testable. Precedence:
 *  1. Postgres statement_timeout code (57014) → 'timeout';
 *  2. an explicit AbortError/TimeoutError name or code → 'timeout';
 *  3. a genuine coded DB error (SQLSTATE / PostgREST shape) → 'has-error',
 *     regardless of message wording (e.g. 25P02 "current transaction is
 *     aborted" is NOT a transport abort);
 *  4. otherwise a flattened transport failure (empty or numeric legacy code):
 *     abort/timeout message → 'timeout', any other non-empty message →
 *     'fetch-error', else 'has-error'.
 */
export function classifyRpcErrorReason(error: {
  code?: string;
  message?: string;
  name?: string;
}): Extract<
  StorefrontInternalPreflightFailOpenReason,
  'timeout' | 'fetch-error' | 'has-error'
> {
  const code = error.code?.trim() ?? '';
  const message = error.message ?? '';
  const name = error.name ?? '';

  if (code === POSTGRES_STATEMENT_TIMEOUT_CODE) {
    return 'timeout';
  }

  if (
    ABORT_ERROR_NAME_PATTERN.test(name) ||
    ABORT_ERROR_NAME_PATTERN.test(code)
  ) {
    return 'timeout';
  }

  // A real database error code is authoritative — never reclassify it by the
  // message (25P02's message contains "aborted" but it is a DB error).
  if (DATABASE_ERROR_CODE_PATTERN.test(code)) {
    return 'has-error';
  }

  // Otherwise this is a flattened transport failure (empty code, or a small
  // numeric DOMException legacy code such as 20/23): classify from the message.
  if (ABORT_OR_TIMEOUT_MESSAGE_PATTERN.test(message)) {
    return 'timeout';
  }
  if (message.length > 0) {
    return 'fetch-error';
  }

  return 'has-error';
}
