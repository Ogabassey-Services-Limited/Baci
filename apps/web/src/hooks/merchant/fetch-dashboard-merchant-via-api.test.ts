import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDashboardMerchantViaApi } from './fetch-dashboard-merchant-via-api';

describe('fetchDashboardMerchantViaApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns the merchant + staff access payload on success', async () => {
    const payload = {
      merchant: { id: 'm-1', business_name: 'Baci' },
      staffAccess: { isStaff: false, isOwner: true, role: 'owner' },
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const result = await fetchDashboardMerchantViaApi();

    expect(fetchMock).toHaveBeenCalledWith('/api/merchant/me', {
      credentials: 'same-origin',
    });
    expect(result).toEqual(payload);
  });

  it('treats 401 as "no dashboard merchant" rather than an error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const result = await fetchDashboardMerchantViaApi();

    expect(result.merchant).toBeNull();
    expect(result.staffAccess.isOwner).toBe(false);
    expect(result.staffAccess.isStaff).toBe(false);
  });

  it('throws on a non-401 error response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    await expect(fetchDashboardMerchantViaApi()).rejects.toThrow(
      'Failed to load merchant dashboard (500)'
    );
  });
});
