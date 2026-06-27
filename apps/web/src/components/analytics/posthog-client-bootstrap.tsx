'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const postHogBrowserEnv = getPostHogBrowserEnv();

export function PostHogClientBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    const currentPathname = pathname ?? globalThis.location?.pathname;

    if (!currentPathname) {
      return;
    }

    const isPublicBlog = isPublicBlogPathname(currentPathname, {
      hostname: globalThis.location?.hostname,
    });

    if (isPublicBlog) {
      return;
    }

    let cancelled = false;

    async function initialize() {
      try {
        const { initializePostHogBrowser } = await import(
          '@/lib/posthog/browser'
        );

        if (cancelled) {
          return;
        }

        initializePostHogBrowser(postHogBrowserEnv, console, {
          lightweight: false,
          pathname: currentPathname,
          hostname: globalThis.location?.hostname,
        });

        const { initializePostHogInstrumentationIfAllowed } = await import(
          '@/instrumentation-client'
        );

        if (!cancelled) {
          initializePostHogInstrumentationIfAllowed(currentPathname);
        }
      } catch (error) {
        if (!cancelled) {
          logger.warn({
            error,
            message: 'PostHog client bootstrap failed to initialize.',
          });
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
