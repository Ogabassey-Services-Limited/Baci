/**
 * Builds a fetch wrapper for Supabase client factories that bounds every
 * request with a timeout WITHOUT discarding the caller's own AbortSignal.
 *
 * supabase-js passes per-request signals through `options.signal`; a wrapper
 * that overwrites it with `AbortSignal.timeout(...)` silently disables
 * caller-side aborts (and any tighter per-call timeout). Compose both with
 * `AbortSignal.any` instead — whichever aborts first wins.
 */
export function createTimeoutComposedFetch(
  timeoutMs: number
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return (input, init = {}) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;

    return fetch(input, {
      ...init,
      signal,
    });
  };
}
