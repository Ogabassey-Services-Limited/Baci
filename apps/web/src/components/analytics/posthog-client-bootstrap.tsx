'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { hasPostHogBrowserInitialized } from '@/lib/posthog/browser-state';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';
import { scheduleIdleBoot } from '@/lib/posthog/schedule-idle-boot';

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

    if (isPublicBlog && !hasPostHogBrowserInitialized()) {
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
          lightweight: isPublicBlog,
          pathname: currentPathname,
          hostname: globalThis.location?.hostname,
        });

        if (isPublicBlog) {
          return;
        }

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

    // Defer the browser PostHog boot off the initial critical path. The idle
    // gate boots on the first idle period, window load, first interaction, or a
    // hard timeout, so instrumentation never blocks first paint.
    const cancelIdleBoot = scheduleIdleBoot(() => {
      if (!cancelled) {
        void initialize();
      }
    });

    return () => {
      cancelled = true;
      cancelIdleBoot();
    };
  }, [pathname]);

  return null;
}
