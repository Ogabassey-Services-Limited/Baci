'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getPostHogBrowserEnv } from '@/lib/posthog/config';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

const postHogBrowserEnv = getPostHogBrowserEnv();

export function PostHogClientBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    const currentPathname = pathname || globalThis.location?.pathname;

    if (!currentPathname || isPublicBlogPathname(currentPathname)) {
      return;
    }

    let cancelled = false;

    async function initialize() {
      const { initializePostHogBrowser } = await import(
        '@/lib/posthog/browser'
      );

      if (cancelled) {
        return;
      }

      initializePostHogBrowser(postHogBrowserEnv);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
