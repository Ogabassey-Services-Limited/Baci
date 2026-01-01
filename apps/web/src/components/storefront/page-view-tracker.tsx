'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/event-tracking';

interface PageViewTrackerProps {
  merchantId: string;
}

export function PageViewTracker({ merchantId }: PageViewTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    // Construct the full URL for tracking
    // We use a relative path + search params to avoid sensitive data in full URLs if needed,
    // but full URL is standard for analytics.
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    // Avoid duplicate tracking for the same URL in strict mode or rapid re-renders
    if (lastTrackedUrl.current === url) {
      return;
    }

    lastTrackedUrl.current = url;

    // Track the page view
    trackEvent.pageView(merchantId, url);

    // Debug log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] Page view tracked: ${url}`);
    }
  }, [pathname, searchParams, merchantId]);

  return null;
}
