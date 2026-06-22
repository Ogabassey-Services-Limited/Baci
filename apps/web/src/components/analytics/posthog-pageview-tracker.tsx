'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isPublicBlogPathname } from '@/lib/posthog/public-blog-path';

export function PostHogPageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const currentPathname = pathname || globalThis.location?.pathname;

    if (!currentPathname || isPublicBlogPathname(currentPathname)) {
      return;
    }

    let cancelled = false;

    async function capturePageview() {
      const { capturePostHogPageview } = await import('@/lib/posthog/browser');

      if (cancelled) {
        return;
      }

      capturePostHogPageview(window.location.href);
    }

    void capturePageview();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
