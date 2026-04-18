'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';

interface DeferredPageViewTrackerProps {
  merchantId: string;
  loadTrackerModule?: () => Promise<PageViewTrackerModule>;
}

interface PageViewTrackerModule {
  PageViewTracker: ComponentType<DeferredPageViewTrackerProps>;
}

const PAGE_VIEW_TRACKER_DELAY_MS = 600;

export function DeferredPageViewTracker({
  merchantId,
  loadTrackerModule,
}: DeferredPageViewTrackerProps) {
  const [Tracker, setTracker] = useState<
    PageViewTrackerModule['PageViewTracker'] | null
  >(null);

  useEffect(() => {
    if (Tracker) {
      return;
    }

    let cancelled = false;

    const loadTracker = () => {
      const trackerModule =
        loadTrackerModule?.() ?? import('./page-view-tracker');

      void trackerModule.then((module) => {
        if (!cancelled) {
          setTracker(() => module.PageViewTracker);
        }
      });
    };

    const timeoutId = window.setTimeout(
      loadTracker,
      PAGE_VIEW_TRACKER_DELAY_MS
    );
    window.addEventListener('pointerdown', loadTracker, {
      once: true,
      passive: true,
    });
    window.addEventListener('keydown', loadTracker, { once: true });
    window.addEventListener('scroll', loadTracker, {
      once: true,
      passive: true,
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', loadTracker);
      window.removeEventListener('keydown', loadTracker);
      window.removeEventListener('scroll', loadTracker);
    };
  }, [Tracker, loadTrackerModule]);

  if (!Tracker) {
    return null;
  }

  return <Tracker merchantId={merchantId} />;
}
