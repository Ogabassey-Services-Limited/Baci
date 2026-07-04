/**
 * In-memory buffer for Core Web Vitals metric payloads that fire before the
 * PostHog browser client has booted.
 *
 * TTFB and FCP report the earliest in the page lifecycle — well before the
 * idle-gated PostHog boot — so without a buffer they are dropped and the field
 * capture rate collapses (measured ~1.7% of eligible pageviews, with TTFB/FCP
 * the rarest). This mirrors the `pendingPostHogPageviewUrls` pattern in
 * `browser.ts`, but lives in a module that does NOT import `posthog-js`, so the
 * reporter can enqueue pre-boot metrics without pulling the posthog-js chunk
 * onto the critical path (the exact deferral the idle boot protects).
 *
 * The buffer is bounded (drop-oldest) so a page that never boots PostHog — e.g.
 * a public blog surface or a Speed Brain prerender that never activates — can
 * never grow it unbounded, and `browser.ts` drains it once init runs.
 */

export interface PostHogWebVitalsPayload {
  metric: string;
  value: number;
  rating: string;
  navigationType: string;
  pathname: string;
  [key: string]: string | number;
}

const MAX_PENDING_WEB_VITALS = 10;

const pendingPostHogWebVitals: PostHogWebVitalsPayload[] = [];

/**
 * Pin the origin URL onto a buffered payload so it survives a later flush.
 *
 * Buffered metrics flush AFTER the idle PostHog boot — frequently after a client
 * navigation — but posthog-js computes `$current_url`/`$pathname` from
 * `location` at CAPTURE time, i.e. the LATER page. So without pinning here, a
 * TTFB measured on page A would be attributed to page B once it flushes. We stamp
 * the origin `$current_url` (from `location.href`) and `$pathname` (already
 * captured at report time in `payload.pathname`); posthog-js honors explicitly
 * passed `$current_url`/`$pathname` over its own computed values, so the flushed
 * event keeps page A's identity. Idempotent so a re-enqueue never overwrites the
 * origin with a later location.
 */
function withOriginUrl(
  payload: PostHogWebVitalsPayload
): PostHogWebVitalsPayload {
  if (typeof payload.$current_url === 'string') {
    return payload;
  }

  const href = globalThis.location?.href;
  if (!href) {
    return payload;
  }

  return { ...payload, $current_url: href, $pathname: payload.pathname };
}

/**
 * Buffer a metric payload, dropping the oldest entry when the cap is reached so
 * the queue stays bounded on pages that never boot PostHog.
 */
export function enqueuePostHogWebVital(payload: PostHogWebVitalsPayload): void {
  if (pendingPostHogWebVitals.length >= MAX_PENDING_WEB_VITALS) {
    pendingPostHogWebVitals.shift();
  }

  pendingPostHogWebVitals.push(withOriginUrl(payload));
}

/**
 * Remove and return every buffered payload (oldest first) so the caller can
 * flush them through the booted client exactly once.
 */
export function drainPendingPostHogWebVitals(): PostHogWebVitalsPayload[] {
  return pendingPostHogWebVitals.splice(0);
}

/**
 * Discard every buffered payload without flushing — used when PostHog is
 * disabled (missing project token) so buffered metrics can never send.
 */
export function clearPendingPostHogWebVitals(): void {
  pendingPostHogWebVitals.length = 0;
}

export { MAX_PENDING_WEB_VITALS };
