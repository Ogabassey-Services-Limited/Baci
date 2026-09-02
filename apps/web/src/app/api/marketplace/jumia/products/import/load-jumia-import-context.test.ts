import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetAllProducts } = vi.hoisted(() => ({
  mockGetAllProducts: vi.fn(),
}));

vi.mock('@/lib/jumia/catalog', () => ({
  getAllProducts: mockGetAllProducts,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));
vi.mock('@/lib/jumia/verify-jumia-single-marketplace-scope', () => ({
  verifyJumiaSingleMarketplaceScope: vi.fn(),
}));

import { verifyJumiaSingleMarketplaceScope } from '@/lib/jumia/verify-jumia-single-marketplace-scope';
import { loadJumiaImportContext } from './load-jumia-import-context';

describe('loadJumiaImportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyJumiaSingleMarketplaceScope).mockResolvedValue({
      ok: true,
    });
  });

  it('loads the integration and leaves the fallback shop filter unset', async () => {
    const jumia = { shopId: 'oauth' };
    mockGetAllProducts.mockResolvedValue([]);

    const result = await loadJumiaImportContext({
      createJumiaClient: vi.fn().mockResolvedValue(jumia),
    });

    expect(result).toEqual({ ok: true, jumia, jumiaProducts: [] });
    expect(mockGetAllProducts).toHaveBeenCalledWith(jumia, {
      status: 'active',
    });
  });

  it('maps integration authorization failures without querying the catalog', async () => {
    const result = await loadJumiaImportContext({
      createJumiaClient: vi.fn().mockRejectedValue({ status: 404 }),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Integration not found',
      status: 404,
    });
    expect(mockGetAllProducts).not.toHaveBeenCalled();
  });

  it('returns a retryable catalog error when Jumia product loading fails', async () => {
    mockGetAllProducts.mockRejectedValue(new Error('provider down'));

    const result = await loadJumiaImportContext({
      createJumiaClient: vi.fn().mockResolvedValue({ shopId: 'shop-1' }),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Failed to fetch products from Jumia',
      status: 502,
    });
  });

  it('fails closed instead of importing an ambiguous multi-marketplace shop', async () => {
    const jumia = {
      shopId: 'shop-1',
      marketplaceKey: 'NG-RETAIL',
    };
    vi.mocked(verifyJumiaSingleMarketplaceScope).mockResolvedValue({
      ok: false,
      reason: 'multiple_active_marketplaces',
    });

    const result = await loadJumiaImportContext({
      createJumiaClient: vi.fn().mockResolvedValue(jumia),
    });

    expect(result).toEqual({
      ok: false,
      error:
        'Jumia catalog import is unavailable when a shop has multiple active marketplaces',
      status: 409,
    });
    expect(mockGetAllProducts).not.toHaveBeenCalled();
  });

  it('imports a marketplace-scoped shop when it has one active marketplace', async () => {
    const jumia = {
      shopId: 'shop-1',
      marketplaceKey: 'NG-RETAIL',
    };
    mockGetAllProducts.mockResolvedValue([]);

    const result = await loadJumiaImportContext({
      createJumiaClient: vi.fn().mockResolvedValue(jumia),
    });

    expect(result).toEqual({ ok: true, jumia, jumiaProducts: [] });
    expect(mockGetAllProducts).toHaveBeenCalledWith(jumia, {
      status: 'active',
      shopId: 'shop-1',
    });
  });

  it('fails closed when the selected marketplace does not match the provider', async () => {
    const jumia = { shopId: 'shop-1', marketplaceKey: 'NG-RETAIL' };
    vi.mocked(verifyJumiaSingleMarketplaceScope).mockResolvedValue({
      ok: false,
      reason: 'marketplace_mismatch',
    });

    const result = await loadJumiaImportContext({
      createJumiaClient: vi.fn().mockResolvedValue(jumia),
    });

    expect(result).toEqual({
      ok: false,
      error:
        'Jumia catalog import is unavailable because the selected marketplace is not active for this shop',
      status: 409,
    });
    expect(mockGetAllProducts).not.toHaveBeenCalled();
  });
});
