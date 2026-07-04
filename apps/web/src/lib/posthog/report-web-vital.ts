import { hasPostHogBrowserInitialized } from '@/lib/posthog/browser-state';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';
import {
  enqueuePostHogWebVital,
  type PostHogWebVitalsPayload,
} from '@/lib/posthog/web-vitals-queue';

/**
 * The single entry point `WebVitalsReporter` uses to forward a Core Web Vitals
 * metric to PostHog. It keeps the reporter free of queue/boot logic and, most
 * importantly, NEVER imports the `posthog-js` chunk before the browser client
 * has booted:
 *
 * - Already booted → dynamically import the browser module (which resolves from
 *   cache once PostHog has loaded) and capture immediately.
 * - Not yet booted → buffer the payload in the posthog-js-free queue, which
 *   `initializePostHogBrowser` drains post-boot. TTFB/FCP fire before the idle
 *   boot, so this is what recovers them instead of dropping them.
 *
 * Metrics captured on public blog/SEO surfaces are dropped rather than buffered:
 * those surfaces never boot the full client, so a buffered blog metric could
 * otherwise leak out on a later non-blog boot where `before_send`'s location
 * check no longer sees the blog path.
 */
export function reportPostHogWebVital(payload: PostHogWebVitalsPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (hasPostHogBrowserInitialized()) {
    void import('@/lib/posthog/browser')
      .then(({ capturePostHogWebVitals }) => {
        capturePostHogWebVitals(payload);
      })
      .catch(() => {
        // PostHog capture is best-effort; ignore load/capture failures.
      });
    return;
  }

  if (
    isPublicBlogPathname(payload.pathname, {
      hostname: globalThis.location?.hostname,
    })
  ) {
    return;
  }

  enqueuePostHogWebVital(payload);
}
