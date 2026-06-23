'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const postHogBrowserEnv = getPostHogBrowserEnv();

export function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams?.toString() ?? '';

  useEffect(() => {
    const currentPathname = pathname ?? globalThis.location?.pathname;

    if (!currentPathname) {
      return;
    }

    const currentSearch = searchParamString ? `?${searchParamString}` : '';
    const currentUrl =
      typeof globalThis.location !== 'undefined'
        ? globalThis.location.href
        : `${currentPathname}${currentSearch}`;
    let cancelled = false;

    async function capturePageview() {
      try {
        const { capturePostHogPageview, initializePostHogBrowser } =
          await import('@/lib/posthog/browser');

        if (cancelled) {
          return;
        }

        initializePostHogBrowser(postHogBrowserEnv, console, {
          lightweight: isPublicBlogPathname(currentPathname),
          pathname: currentPathname,
          hostname: globalThis.location?.hostname,
        });
        capturePostHogPageview(currentUrl);
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
  }, [pathname, searchParamString]);

  return null;
}
