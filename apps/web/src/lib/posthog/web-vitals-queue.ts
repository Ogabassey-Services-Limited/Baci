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
 * Buffer a metric payload, dropping the oldest entry when the cap is reached so
 * the queue stays bounded on pages that never boot PostHog.
 */
export function enqueuePostHogWebVital(payload: PostHogWebVitalsPayload): void {
  if (pendingPostHogWebVitals.length >= MAX_PENDING_WEB_VITALS) {
    pendingPostHogWebVitals.shift();
  }

  pendingPostHogWebVitals.push(payload);
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
