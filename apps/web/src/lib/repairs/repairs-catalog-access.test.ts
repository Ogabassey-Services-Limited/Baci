import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRepairsCatalogMerchant } from './repairs-catalog-access';

const mocks = vi.hoisted(() => ({
  getCachedMerchant: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: mocks.getCachedMerchant,
}));

describe('resolveRepairsCatalogMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the merchant does not exist', async () => {
    mocks.getCachedMerchant.mockResolvedValueOnce(null);

    const result = await resolveRepairsCatalogMerchant('missing');

    expect(result).toBeNull();
  });

  it('reports enabled for an electronics merchant with the flag on', async () => {
    mocks.getCachedMerchant.mockResolvedValueOnce({
      id: 'merchant-1',
      business_type: 'electronics',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const result = await resolveRepairsCatalogMerchant('ogabassey');

    expect(result).toEqual({ merchantId: 'merchant-1', enabled: true });
  });

  it('reports disabled for an electronics merchant with the flag off', async () => {
    mocks.getCachedMerchant.mockResolvedValueOnce({
      id: 'merchant-1',
      business_type: 'electronics',
      feature_settings: { repairs_catalog_enabled: false },
    });

    const result = await resolveRepairsCatalogMerchant('ogabassey');

    expect(result).toEqual({ merchantId: 'merchant-1', enabled: false });
  });

  it('reports disabled for a non-electronics merchant even with the flag on', async () => {
    mocks.getCachedMerchant.mockResolvedValueOnce({
      id: 'merchant-2',
      business_type: 'fashion',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const result = await resolveRepairsCatalogMerchant('fashion-store');

    expect(result).toEqual({ merchantId: 'merchant-2', enabled: false });
  });
});
