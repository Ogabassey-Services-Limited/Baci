import { describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: mockFetchWithCsrf }));

import { saveDashboardLayoutPreference } from './save-dashboard-layout-preference';

describe('saveDashboardLayoutPreference', () => {
  it('uses the CSRF-aware client for dashboard layout mutations', async () => {
    mockFetchWithCsrf.mockResolvedValue({ ok: true });
    const layout = [{ i: 'sales', x: 0, y: 0, w: 2, h: 2 }];

    await saveDashboardLayoutPreference(layout);

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/dashboard/preferences',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ layout_config: layout }),
      })
    );
  });
});
