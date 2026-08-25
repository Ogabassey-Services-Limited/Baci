import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnalyticsGridLayout } from './use-analytics-grid-layout';

const fetchPreference = vi.hoisted(() => vi.fn());
const savePreference = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/save-dashboard-layout-preference', () => ({
  fetchDashboardLayoutPreference: (...args: unknown[]) =>
    fetchPreference(...args),
  saveDashboardLayoutPreference: (...args: unknown[]) =>
    savePreference(...args),
}));

describe('useAnalyticsGridLayout', () => {
  beforeEach(() => {
    fetchPreference.mockReset();
    savePreference.mockReset();
    fetchPreference.mockResolvedValue(null);
    savePreference.mockResolvedValue(undefined);
  });

  it('hydrates per merchant and queues edit-mode layout saves', async () => {
    const { result } = renderHook(() =>
      useAnalyticsGridLayout({
        activeCategory: 'overview',
        isEditMode: true,
        merchantId: 'merchant-1',
      })
    );

    await waitFor(() => expect(fetchPreference).toHaveBeenCalled());
    act(() => {
      result.current.onLayoutChange([], {
        lg: [{ i: 'summary-revenue', x: 0, y: 0, w: 4, h: 1 }],
      });
    });
    await waitFor(() =>
      expect(savePreference).toHaveBeenCalledWith(
        expect.any(Object),
        'merchant-1',
        expect.any(AbortSignal)
      )
    );
  });
});
