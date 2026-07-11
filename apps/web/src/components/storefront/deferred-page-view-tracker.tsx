'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { runWhenPageActivated } from '@/lib/dom/run-when-page-activated';

interface DeferredPageViewTrackerProps {
  merchantId: string;
  loadTrackerModule?: () => Promise<PageViewTrackerModule>;
}

interface PageViewTrackerModule {
  PageViewTracker: ComponentType<DeferredPageViewTrackerProps>;
}

const PAGE_VIEW_TRACKER_DELAY_MS = 600;

/**
 * Module-scope dynamic import so the component body stays free of `import()`
 * expressions, which block React Compiler memoization.
 */
function loadDefaultTrackerModule(): Promise<PageViewTrackerModule> {
  return import('./page-view-tracker');
}

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
    let timeoutId: number | undefined;

    const loadTracker = () => {
      const trackerModule = loadTrackerModule?.() ?? loadDefaultTrackerModule();

      void trackerModule.then((module) => {
        if (!cancelled) {
          setTracker(() => module.PageViewTracker);
        }
      });
    };

    const removeInteractionListeners = () => {
      window.removeEventListener('pointerdown', loadTracker);
      window.removeEventListener('keydown', loadTracker);
      window.removeEventListener('scroll', loadTracker);
    };

    // Gate scheduling on activation: a speculatively prerendered PDP executes
    // this effect, and the merchant page-view tracker POSTs to /api/events (a
    // DB write) plus GA4/Pixel pageviews. Deferring until the page is actually
    // presented keeps discarded prerenders from minting junk pageviews.
    const cancelActivationGate = runWhenPageActivated(() => {
      if (cancelled) {
        return;
      }
      timeoutId = window.setTimeout(loadTracker, PAGE_VIEW_TRACKER_DELAY_MS);
      window.addEventListener('pointerdown', loadTracker, {
        once: true,
        passive: true,
      });
      window.addEventListener('keydown', loadTracker, { once: true });
      window.addEventListener('scroll', loadTracker, {
        once: true,
        passive: true,
      });
    });

    return () => {
      cancelled = true;
      cancelActivationGate();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      removeInteractionListeners();
    };
  }, [Tracker, loadTrackerModule]);

  if (!Tracker) {
    return null;
  }

  return <Tracker merchantId={merchantId} />;
}
