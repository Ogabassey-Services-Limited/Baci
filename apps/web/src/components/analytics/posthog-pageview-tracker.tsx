'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { capturePostHogPageview } from '@/lib/posthog/browser';

export function PostHogPageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) {
      return;
    }

    capturePostHogPageview(window.location.href);
  }, [pathname]);

  return null;
}
