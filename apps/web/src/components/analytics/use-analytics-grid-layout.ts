import { useEffect, useRef, useState } from 'react';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy';
import { createDashboardLayoutSaveQueue } from '@/lib/analytics/dashboard-layout-save-queue';
import {
  fetchDashboardLayoutPreference,
  saveDashboardLayoutPreference,
} from '@/lib/analytics/save-dashboard-layout-preference';
import type { AnalyticsCategory } from './analytics-category-nav';
import {
  hydrateDashboardLayoutConfig,
  mergeDashboardLayoutConfig,
} from './analytics-grid-layout-hydration';
import { type Layouts, resolveCategoryLayouts } from './analytics-grid-layouts';

interface AnalyticsGridLayoutInput {
  activeCategory: AnalyticsCategory;
  isEditMode: boolean;
  merchantId?: string;
}

export function useAnalyticsGridLayout({
  activeCategory,
  isEditMode,
  merchantId,
}: AnalyticsGridLayoutInput) {
  const [layouts, setLayouts] = useState<Layouts>(() =>
    resolveCategoryLayouts(activeCategory)
  );
  const persistedLayoutConfigRef = useRef<unknown>(null);
  const layoutSaveQueueRef = useRef(
    createDashboardLayoutSaveQueue(saveDashboardLayoutPreference)
  );
  const [previousSelection, setPreviousSelection] = useState({
    activeCategory,
    merchantId,
  });

  if (
    activeCategory !== previousSelection.activeCategory ||
    merchantId !== previousSelection.merchantId
  ) {
    setPreviousSelection({ activeCategory, merchantId });
    setLayouts(resolveCategoryLayouts(activeCategory));
  }

  useEffect(() => {
    if (!merchantId) return;

    const controller = new AbortController();
    const previousWrites = layoutSaveQueueRef.current.reset();
    persistedLayoutConfigRef.current = null;

    void previousWrites
      .then(() => {
        if (controller.signal.aborted) return null;
        return fetchDashboardLayoutPreference(merchantId, controller.signal);
      })
      .then((layoutConfig) => {
        if (controller.signal.aborted || !layoutConfig) return;

        persistedLayoutConfigRef.current = layoutConfig;
        const hydratedLayouts = hydrateDashboardLayoutConfig(
          layoutConfig,
          activeCategory
        );
        if (hydratedLayouts) setLayouts(hydratedLayouts);
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        console.error('Failed to hydrate dashboard layout:', error);
      });

    return () => {
      controller.abort();
      void layoutSaveQueueRef.current.reset();
    };
  }, [activeCategory, merchantId]);

  function onLayoutChange(
    _currentLayout: Layout,
    allLayouts: ResponsiveLayouts
  ) {
    const completeLayouts: Layouts = {
      ...resolveCategoryLayouts(activeCategory),
      ...allLayouts,
    };
    const nextLayoutConfig = mergeDashboardLayoutConfig(
      persistedLayoutConfigRef.current,
      activeCategory,
      completeLayouts
    );
    setLayouts(completeLayouts);
    persistedLayoutConfigRef.current = nextLayoutConfig;
    if (!isEditMode) return;

    void layoutSaveQueueRef.current
      .enqueue(nextLayoutConfig, merchantId)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to save layout:', error);
      });
  }

  return { layouts, onLayoutChange };
}
