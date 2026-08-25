import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueue = vi.fn().mockResolvedValue(undefined);
const reset = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/analytics/dashboard-layout-save-queue', () => ({
  createDashboardLayoutSaveQueue: () => ({ enqueue, reset }),
}));
vi.mock('@/lib/analytics/save-dashboard-layout-preference', () => ({
  fetchDashboardLayoutPreference: vi.fn(),
  saveDashboardLayoutPreference: vi.fn(),
}));

import { useAnalyticsGridLayout } from './use-analytics-grid-layout';

describe('useAnalyticsGridLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the local layout without persisting outside edit mode', () => {
    const { result } = renderHook(() =>
      useAnalyticsGridLayout({
        activeCategory: 'overview',
        isEditMode: false,
        merchantId: 'merchant-1',
      })
    );

    act(() => {
      result.current.onLayoutChange([], { lg: [] });
    });

    expect(result.current.layouts.lg).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('queues merchant-scoped persistence while editing', () => {
    const { result } = renderHook(() =>
      useAnalyticsGridLayout({
        activeCategory: 'overview',
        isEditMode: true,
        merchantId: 'merchant-1',
      })
    );

    act(() => {
      result.current.onLayoutChange([], { lg: [] });
    });

    expect(enqueue).toHaveBeenCalledWith(expect.any(Object), 'merchant-1');
  });
});
