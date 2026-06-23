'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const postHogBrowserEnv = getPostHogBrowserEnv();

export function PostHogPageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const currentPathname = pathname ?? globalThis.location?.pathname;

    if (!currentPathname || isPublicBlogPathname(currentPathname)) {
      return;
    }

    let cancelled = false;

    async function capturePageview() {
      try {
        const { capturePostHogPageview, initializePostHogBrowser } =
          await import('@/lib/posthog/browser');

        if (cancelled) {
          return;
        }

        initializePostHogBrowser(postHogBrowserEnv);
        capturePostHogPageview(window.location.href);
      } catch (error) {
        if (!cancelled) {
          logger.warn({
            error,
            message: 'PostHog pageview capture failed.',
          });
        }
      }
    }

    void capturePageview();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
