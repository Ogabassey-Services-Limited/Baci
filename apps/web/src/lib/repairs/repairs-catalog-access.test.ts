import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRepairsCatalogMerchant } from './repairs-catalog-access';

const mocks = vi.hoisted(() => ({
  getMerchantByIdentifier: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: mocks.getMerchantByIdentifier,
}));

describe('resolveRepairsCatalogMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the merchant does not exist', async () => {
    mocks.getMerchantByIdentifier.mockResolvedValueOnce(null);

    const result = await resolveRepairsCatalogMerchant('missing');

    expect(result).toBeNull();
  });

  it('reports enabled for a published electronics merchant with the flag on', async () => {
    mocks.getMerchantByIdentifier.mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: true,
      business_type: 'electronics',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const result = await resolveRepairsCatalogMerchant('ogabassey');

    expect(result).toEqual({ merchantId: 'merchant-1', enabled: true });
  });

  it('reports disabled for an UNPUBLISHED merchant even with the flag on (matches the SQL gate)', async () => {
    mocks.getMerchantByIdentifier.mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: false,
      business_type: 'electronics',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const result = await resolveRepairsCatalogMerchant('ogabassey');

    expect(result).toEqual({ merchantId: 'merchant-1', enabled: false });
  });

  it('reports disabled for an electronics merchant with the flag off', async () => {
    mocks.getMerchantByIdentifier.mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: true,
      business_type: 'electronics',
      feature_settings: { repairs_catalog_enabled: false },
    });

    const result = await resolveRepairsCatalogMerchant('ogabassey');

    expect(result).toEqual({ merchantId: 'merchant-1', enabled: false });
  });

  it('reports disabled for a non-electronics merchant even with the flag on', async () => {
    mocks.getMerchantByIdentifier.mockResolvedValueOnce({
      id: 'merchant-2',
      is_published: true,
      business_type: 'fashion',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const result = await resolveRepairsCatalogMerchant('fashion-store');

    expect(result).toEqual({ merchantId: 'merchant-2', enabled: false });
  });

  it('resolves a custom storefront domain through the identifier lookup', async () => {
    mocks.getMerchantByIdentifier.mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: true,
      business_type: 'electronics',
      feature_settings: { repairs_catalog_enabled: true },
    });

    const result = await resolveRepairsCatalogMerchant('repairs.example.com');

    expect(result).toEqual({ merchantId: 'merchant-1', enabled: true });
    expect(mocks.getMerchantByIdentifier).toHaveBeenCalledWith(
      'repairs.example.com'
    );
  });
});
