'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { hasPostHogBrowserInitialized } from '@/lib/posthog/browser-state';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import {
  capturePublicBlogPageview,
  resetPublicBlogPageviewDedupe,
} from '@/lib/posthog/public-blog-pageview';
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
    const hostname = globalThis.location?.hostname;
    let cancelled = false;

    async function capturePageview() {
      try {
        const isPublicBlog = isPublicBlogPathname(currentPathname, {
          hostname,
        });

        if (isPublicBlog && !hasPostHogBrowserInitialized()) {
          capturePublicBlogPageview(postHogBrowserEnv, currentUrl);
          return;
        }

        if (!isPublicBlog) {
          resetPublicBlogPageviewDedupe();
        }

        const { capturePostHogPageview, initializePostHogBrowser } =
          await import('@/lib/posthog/browser');

        if (cancelled) {
          return;
        }

        initializePostHogBrowser(postHogBrowserEnv, console, {
          lightweight: isPublicBlog,
          pathname: currentPathname,
          hostname,
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
