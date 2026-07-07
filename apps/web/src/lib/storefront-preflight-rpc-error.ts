import type { StorefrontInternalPreflightFailOpenReason } from './storefront-internal-preflight';

/**
 * Classifies a supabase-js `.rpc()` resolved-error object into a fail-open
 * reason.
 *
 * supabase-js `.rpc()` does NOT throw on transport failures — an aborted or
 * network-failed fetch RESOLVES into `{ error }` with an empty `code` and the
 * underlying (TypeError-ish) message, so the transport's try/catch almost
 * never fires and a blanket 'has-error' buried real timeout/network incidents.
 * This re-separates those transport failures from genuine PostgREST/SQLSTATE
 * errors so PostHog volume is attributed to the right failure mode.
 */

// Postgres statement_timeout error (the anon role's DB-side cap).
export const POSTGRES_STATEMENT_TIMEOUT_CODE = '57014';

const ABORT_ERROR_NAME_PATTERN = /^(AbortError|TimeoutError)$/;
const NETWORK_ERROR_MESSAGE_PATTERN =
  /fetch failed|network|ECONNRESET|ETIMEDOUT|socket/i;

/**
 * Pure and directly testable. Precedence:
 *  1. Postgres statement_timeout code (57014) → 'timeout';
 *  2. abort-like (message mentions 'abort', or an AbortError/TimeoutError name
 *     or code leaked through the flatten) → 'timeout';
 *  3. network-like (a recognizable transport message, or an empty code carrying
 *     a non-PostgREST message) → 'fetch-error';
 *  4. everything else — a real PostgREST (PGRSTxxx) or SQLSTATE code → 'has-error'.
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
    /abort/i.test(message) ||
    ABORT_ERROR_NAME_PATTERN.test(name) ||
    ABORT_ERROR_NAME_PATTERN.test(code)
  ) {
    return 'timeout';
  }

  // A genuine PostgREST error always carries a code, so an empty code with any
  // message is a flattened transport failure, not a server-side error.
  if (
    NETWORK_ERROR_MESSAGE_PATTERN.test(message) ||
    (code === '' && message.length > 0)
  ) {
    return 'fetch-error';
  }

  return 'has-error';
}
