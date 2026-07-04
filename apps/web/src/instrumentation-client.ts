import { initializeChunkLoadRecovery } from '@/lib/chunk-load-recovery';
import { logger } from '@/lib/logger';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

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

// The deferred idle boot is NOT armed here. PostHogClientBootstrap
// (rendered by RootDynamicBody in the root layout, so mounted on every
// PostHog-eligible route) is the single owner of the idle-gated boot: it
// schedules exactly one scheduleIdleBoot and, unlike this module's former
// module-scope boot, is pathname-aware (public-blog lightweight mode, pathname
// reconfigure, first-interaction fast path) and calls this
// `initializePostHogInstrumentationIfAllowed`. Arming a second boot here raced
// the component and churned idle listeners for no benefit (init is idempotent),
// so this file now only owns eager chunk-load recovery and the exported gate.
