import { logger } from '@/lib/logger';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const postHogBrowserEnv = getPostHogBrowserEnv();

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

initializePostHogInstrumentationIfAllowed();
