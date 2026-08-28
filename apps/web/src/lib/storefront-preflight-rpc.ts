import type { SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient } from '@/lib/supabase/public';
import { createAbortSignalTimeout } from './abort-signal-timeout';
import type { StorefrontInternalPreflightSurface } from './storefront-internal-preflight';
import {
  storefrontInternalPreflight,
  UNKNOWN_STOREFRONT_FAIL_OPEN_REASON,
} from './storefront-internal-preflight';
import { createStorefrontPreflightCircuitBreaker } from './storefront-preflight-circuit-breaker';
import { classifyRpcErrorReason } from './storefront-preflight-rpc-error';

/**
 * Direct-Supabase transport for the proxy middleware's storefront preflights.
 *
 * Replaces the /api/internal self-fetch (middleware → public edge →
 * cold-startable function → data cache → DB) with one anon PostgREST RPC call:
 * the Vercel function region (dub1) and the database (eu-west-1) are
 * co-located, so verdicts resolve in tens of milliseconds and the abort budget
 * becomes headroom instead of a cliff. Verdict semantics live in the
 * SECURITY DEFINER RPCs (supabase/migrations/20260706200000_*).
 *
 * Blast-radius bounds (both required because middleware cannot use 'use cache'
 * and therefore lost the data-cache absorber the route transport had):
 *  - a short-TTL verdict memo collapses the canonical + membership helpers'
 *    identical calls on the same navigation (and same-URL crawl repeats) into
 *    one round trip;
 *  - a consecutive-failure circuit breaker fails every preflight open
 *    instantly during a Supabase brownout instead of stalling each document
 *    navigation for the full budget, twice.
 *
 * ACCEPTED EXPOSURE: the verdict RPCs are anon-GRANTed SECURITY DEFINER
 * functions, so they are directly callable at PostgREST with the public anon
 * key, bypassing this transport's memo/breaker/kill-switch — the same class
 * as the shipped resolve_storefront_auth_merchant and
 * get_merchant_product_slug_resolution RPCs. They expose only public
 * storefront verdict data, are index-backed point reads, and are capped
 * DB-side by the anon role's statement_timeout (a function-level SET could
 * not re-arm the timer for the already-running statement); platform-side
 * anon rate limiting is the control surface for direct abuse.
 */

export interface StorefrontPreflightRpcContext {
  surface: StorefrontInternalPreflightSurface;
  identifier: string;
  slug: string;
}

export type StorefrontPreflightRpcResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

export type StorefrontPreflightRpcImpl = (
  fn: string,
  args: Record<string, string>,
  signal: AbortSignal
) => PromiseLike<StorefrontPreflightRpcResult>;

interface CallStorefrontPreflightRpcOptions {
  failOpenContext: StorefrontPreflightRpcContext;
  /** Tight budget — a slow verdict must not delay navigations. */
  timeoutMs?: number;
  /** Injectable for tests. */
  rpcImpl?: StorefrontPreflightRpcImpl;
  /**
   * Some established identity RPCs legitimately return no row for unknown
   * public identifiers. Treat that result as a designed fail-open instead of
   * reporting a parse incident.
   */
  emptyResult?: 'unknown';
}

// 2s, not the route transport's old 800ms: the RPCs execute in ~20ms
// server-side, and PostHog `detail` telemetry showed the entire residual
// timeout class (155 events/19h post-#2980) was OUR client abort firing on
// transport-tail events (cold TLS + event-loop contention during page-data
// fanout) — each one a fail-open that forfeits a crawler-facing 404/308
// verdict. The old prohibition on budget bumps guarded a user-visible stall
// bound on two SEQUENTIAL slow function hops; here the memo collapses the
// second call on success, the circuit breaker bounds brownouts, and the
// extra budget is only ever spent on genuine tail events, converting lost
// verdicts into slightly-slower correct ones.
const DEFAULT_TIMEOUT_MS = 2_000;
// One navigation's canonical + membership helpers call within ~100ms of each
// other; 3s also absorbs a crawler re-hitting the same URL without letting a
// verdict outlive the freshness the no-store route transport guaranteed.
const MEMO_TTL_MS = 3_000;
const MEMO_MAX_ENTRIES = 512;

const memo = new Map<string, { expires: number; row: unknown }>();
// Suppress only timeout retries; real product-read failures remain retryable.
const TIMEOUT_MEMO = Symbol('storefront-preflight-timeout');
const EMPTY_RESULT_MEMO = Symbol('storefront-preflight-empty-result');
const breaker = createStorefrontPreflightCircuitBreaker();

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  client ??= createPublicClient({
    clientInfo: 'storefront-preflight',
    // Outer safety net only; the per-call abort signal below governs.
    timeoutMs: 10_000,
  });
  return client;
}

const defaultRpcImpl: StorefrontPreflightRpcImpl = (fn, args, signal) =>
  getClient().rpc(fn, args).abortSignal(signal);

function memoKey(fn: string, args: Record<string, string>): string {
  return JSON.stringify([
    fn,
    Object.keys(args)
      .sort()
      .map((key) => [key, args[key]]),
  ]);
}

function readMemo(key: string): unknown | undefined {
  const entry = memo.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    memo.delete(key);
    return undefined;
  }
  return entry.row;
}

function writeMemo(key: string, row: unknown): void {
  if (memo.size >= MEMO_MAX_ENTRIES) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { expires: Date.now() + MEMO_TTL_MS, row });
}

function isAbortLikeError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

/**
 * Bounded, secrets-free `code message` diagnostic for a fail-open. PostgREST
 * error messages carry no secrets; bounding keeps a pathological message from
 * bloating the telemetry payload. Empty → undefined so the property is omitted.
 */
function boundedErrorDetail(code: string, message: string): string | undefined {
  return `${code} ${message}`.trim().slice(0, 160) || undefined;
}

/** Same diagnostic for the rare THROWN (not resolved-`{ error }`) rejection. */
function thrownErrorDetail(error: unknown): string | undefined {
  if (error instanceof Error || error instanceof DOMException) {
    return boundedErrorDetail(error.name, error.message);
  }
  return undefined;
}

/**
 * Calls a preflight verdict RPC and returns its single row, or null after
 * logging/capturing the fail-open (callers return their surface's fail-open
 * verdict on null). Never throws.
 */
export async function callStorefrontPreflightRpc(
  fn: string,
  args: Record<string, string>,
  options: CallStorefrontPreflightRpcOptions
): Promise<unknown | null> {
  const { failOpenContext } = options;

  const key = memoKey(fn, args);
  const memoized = readMemo(key);
  if (memoized === TIMEOUT_MEMO || memoized === EMPTY_RESULT_MEMO) return null;
  if (memoized !== undefined) {
    return memoized;
  }

  // Preview deployments must not resolve verdicts against production data —
  // parity with the route transport's resolveBaseUrl gate, which returns null
  // for every non-production VERCEL_ENV.
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv && vercelEnv !== 'production') {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'no-base-url',
    });
    return null;
  }

  if (breaker.isOpen()) {
    // Console-only: the transition itself was captured once below.
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      reason: 'circuit-open',
    });
    return null;
  }

  const rpcImpl = options.rpcImpl ?? defaultRpcImpl;
  const timeout = createAbortSignalTimeout(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  let result: StorefrontPreflightRpcResult;
  try {
    result = await rpcImpl(fn, args, timeout.signal);
  } catch (error) {
    const reason = isAbortLikeError(error) ? 'timeout' : 'fetch-error';
    if (reason === 'timeout') writeMemo(key, TIMEOUT_MEMO);
    breaker.recordFailure();
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason,
      detail: thrownErrorDetail(error),
    });
    captureBreakerOpenTransition(failOpenContext);
    return null;
  } finally {
    timeout.clear();
  }

  if (result.error) {
    const reason = classifyRpcErrorReason(result.error);
    if (reason === 'timeout') writeMemo(key, TIMEOUT_MEMO);
    breaker.recordFailure();
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason,
      detail: boundedErrorDetail(
        result.error.code ?? '',
        result.error.message ?? ''
      ),
    });
    captureBreakerOpenTransition(failOpenContext);
    return null;
  }

  breaker.recordSuccess();

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (row === null || row === undefined || typeof row !== 'object') {
    if (
      options.emptyResult === 'unknown' &&
      Array.isArray(result.data) &&
      result.data.length === 0
    ) {
      writeMemo(key, EMPTY_RESULT_MEMO);
      return null;
    }
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'parse',
    });
    return null;
  }

  writeMemo(key, row);
  return row;
}

function captureBreakerOpenTransition(
  failOpenContext: StorefrontPreflightRpcContext
): void {
  if (breaker.consumeOpenTransition()) {
    // Exactly one capture per open transition — its own fingerprint makes a
    // brownout alertable without a capture per suppressed navigation.
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'circuit-open',
    });
  }
}

/**
 * Shared storefront-status gate for RPC verdict rows: true only for a
 * published storefront. Unknown/unpublished is the DESIGNED junk-traffic
 * fail-open (skip-logged, no capture — parity with the routes'
 * `failOpenReason: 'unknown-storefront'`); any future status value fails open
 * as a captured has-error.
 */
export function gateStorefrontPreflightStatus(
  status: string,
  failOpenContext: StorefrontPreflightRpcContext
): boolean {
  if (status === 'published') {
    return true;
  }

  if (status === 'unknown' || status === 'unpublished') {
    storefrontInternalPreflight.warnSkip({
      ...failOpenContext,
      reason: UNKNOWN_STOREFRONT_FAIL_OPEN_REASON,
    });
  } else {
    storefrontInternalPreflight.warnFailOpen({
      ...failOpenContext,
      reason: 'has-error',
    });
  }
  return false;
}

/** Test hook: clears the verdict memo, breaker state, and client singleton. */
export function resetStorefrontPreflightRpcForTests(): void {
  memo.clear();
  breaker.reset();
  client = null;
}
