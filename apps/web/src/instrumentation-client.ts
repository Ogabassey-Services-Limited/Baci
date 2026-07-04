import { initializeChunkLoadRecovery } from '@/lib/chunk-load-recovery';
import { logger } from '@/lib/logger';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';
import { scheduleIdleBoot } from '@/lib/posthog/schedule-idle-boot';

const postHogBrowserEnv = getPostHogBrowserEnv();

// Chunk-load recovery must stay eager at module scope so it can catch early
// dynamic-import failures (stale /_next/static after a deploy) before hydration.
// It is intentionally NOT deferred.
initializeChunkLoadRecovery();

async function initializePostHogInstrumentation() {
  try {
    const { capturePostHogPageview, initializePostHogBrowser } = await import(
      '@/lib/posthog/browser'
    );

    initializePostHogBrowser(postHogBrowserEnv);
    capturePostHogPageview();
  } catch (error) {
    logger.warn({
      error,
      message: 'PostHog browser instrumentation failed to initialize.',
    });
  }
}

let postHogInstrumentationInitialized = false;

export function initializePostHogInstrumentationIfAllowed(
  pathname = globalThis.location?.pathname
) {
  if (
    typeof window === 'undefined' ||
    postHogInstrumentationInitialized ||
    isPublicBlogPathname(pathname)
  ) {
    return;
  }

  postHogInstrumentationInitialized = true;
  void initializePostHogInstrumentation();
}

// Defer the eager PostHog boot (session recording, heatmaps, autocapture,
// dead-click capture) AND the posthog-js chunk download off the initial
// critical path. This idle boot OWNS the landing pageview: after init it calls
// `capturePostHogPageview()`, whose URL posthog-js buffers via its own request
// queue until the client finishes loading. PostHogPageviewTracker never boots
// the client and captures nothing on non-blog routes before this fires (it only
// emits post-boot route-change pageviews and the lightweight public-blog
// beacon), so the landing view is captured exactly once — `capture_pageview` is
// false, so posthog-js adds no duplicate. A first interaction (pointerdown/
// keydown) boots it promptly.
scheduleIdleBoot(() => {
  initializePostHogInstrumentationIfAllowed();
});
