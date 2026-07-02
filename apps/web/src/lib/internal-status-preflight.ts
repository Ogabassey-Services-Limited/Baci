import { createAbortSignalTimeout } from './abort-signal-timeout';

/**
 * Why every fail-open reason is enumerated and logged
 * ---------------------------------------------------
 * The storefront status preflights (PDP hard-404, PDP canonical redirect, blog
 * post status, blog listing status) all make an authenticated `/api/internal/*`
 * hop and must fail OPEN — never hard-404 or open-redirect a live page on a
 * transient hiccup. The historical implementations swallowed every failure in a
 * bare `catch {}`, so when the hop silently failed 100% of the time in
 * production (Vercel Deployment Protection 302'd the deployment-URL fetch to
 * `vercel.com/sso-api`, which then served an HTTP 200 `text/html` login page
 * that `response.json()` choked on) there was no signal to diagnose it. This
 * helper centralises the hop and emits exactly one structured `console.warn`
 * per fail-open so the reason is always observable.
 */
export type InternalStatusPreflightFailReason =
  | 'redirect'
  | 'non-json-content-type'
  | 'parse'
  | 'timeout'
  | 'error'
  | `http-${number}`;

interface InternalStatusPreflightContext {
  /** Preflight name, e.g. `pdp-slug-membership`. */
  check: string;
  /** Storefront slug or custom domain resolved by the proxy. */
  identifier: string;
  /** The page slug/intent under check (for observability only). */
  slug: string;
}

interface FetchInternalStatusJsonOptions {
  /** Fully-built internal endpoint URL (base already resolved by the caller). */
  url: URL;
  /** `INTERNAL_API_SECRET`; sent only to platform-configured origins. */
  secret: string;
  /** Tight budget — a slow internal hop must not delay navigations. */
  timeoutMs: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  context: InternalStatusPreflightContext;
}

export type FetchInternalStatusJsonResult =
  | { kind: 'json'; body: unknown }
  | { kind: 'fail-open'; reason: InternalStatusPreflightFailReason };

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) return error.name === 'AbortError';
  if (error instanceof DOMException) return error.name === 'AbortError';
  return false;
}

function failOpen(
  context: InternalStatusPreflightContext,
  reason: InternalStatusPreflightFailReason
): FetchInternalStatusJsonResult {
  console.warn('[internal-status-preflight] fail-open', {
    check: context.check,
    identifier: context.identifier,
    slug: context.slug,
    reason,
  });
  return { kind: 'fail-open', reason };
}

/**
 * Performs the authenticated internal-status HTTP hop with strict, observable
 * fail-open semantics. Returns the parsed JSON body on success, or a
 * `fail-open` verdict (with a logged reason) on any redirect, non-2xx,
 * non-JSON, unparseable, timed-out, or errored response.
 *
 * `redirect: 'manual'` is deliberate: a Deployment-Protection SSO wall answers
 * with a 302 to the login page. Following it would yield an HTTP 200
 * `text/html` page that must NEVER be treated as a valid status verdict, so a
 * redirect is surfaced and treated as a fail-open here.
 */
export async function fetchInternalStatusJson(
  opts: FetchInternalStatusJsonOptions
): Promise<FetchInternalStatusJsonResult> {
  const { url, secret, timeoutMs, fetchImpl, context } = opts;
  const timeout = createAbortSignalTimeout(timeoutMs);

  try {
    const response = await (fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${secret}` },
      redirect: 'manual',
      signal: timeout.signal,
    });

    // `redirect: 'manual'` surfaces a redirect either as a 3xx status or, in
    // spec-compliant runtimes, as an opaque-redirect filtered response.
    if (
      response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400)
    ) {
      return failOpen(context, 'redirect');
    }

    if (!response.ok) {
      return failOpen(context, `http-${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return failOpen(context, 'non-json-content-type');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return failOpen(context, 'parse');
    }

    return { kind: 'json', body };
  } catch (error) {
    const reason =
      timeout.signal.aborted || isAbortError(error) ? 'timeout' : 'error';
    return failOpen(context, reason);
  } finally {
    timeout.clear();
  }
}
