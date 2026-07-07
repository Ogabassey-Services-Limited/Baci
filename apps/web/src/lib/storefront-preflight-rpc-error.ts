import type { StorefrontInternalPreflightFailOpenReason } from './storefront-internal-preflight';

/**
 * Classifies a supabase-js `.rpc()` resolved-error object into a fail-open
 * reason.
 *
 * supabase-js `.rpc()` does NOT throw on transport failures — an aborted or
 * network-failed fetch RESOLVES into `{ error }` with an EMPTY `code` and the
 * underlying message, so the transport's try/catch almost never fires and a
 * blanket 'has-error' buried real timeout/network incidents. This re-separates
 * those flattened transport failures from genuine PostgREST/SQLSTATE errors so
 * PostHog volume is attributed to the right failure mode.
 */

// Postgres statement_timeout (the anon role's DB-side cap). Local: this module
// exposes a single utility (one export per file).
const POSTGRES_STATEMENT_TIMEOUT_CODE = '57014';

// A DOMException name (or, defensively, code) that survived flattening.
const ABORT_ERROR_NAME_PATTERN = /^(AbortError|TimeoutError)$/;

/**
 * Pure and directly testable. Precedence:
 *  1. Postgres statement_timeout code (57014) → 'timeout';
 *  2. an explicit AbortError/TimeoutError name or code → 'timeout';
 *  3. a flattened transport failure (EMPTY code): message mentions 'abort' →
 *     'timeout', otherwise any non-empty message → 'fetch-error';
 *  4. everything else stays 'has-error' — a genuine PostgREST (PGRSTxxx) or
 *     SQLSTATE error ALWAYS carries a non-empty code, so it is never
 *     reclassified by its message wording (e.g. 25P02 "current transaction is
 *     aborted" must not be mislabelled a timeout).
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

  // Only an empty code is a flattened transport failure; a coded database error
  // stays has-error below regardless of its message wording.
  if (code === '') {
    if (/abort/i.test(message)) {
      return 'timeout';
    }
    if (message.length > 0) {
      return 'fetch-error';
    }
  }

  return 'has-error';
}
