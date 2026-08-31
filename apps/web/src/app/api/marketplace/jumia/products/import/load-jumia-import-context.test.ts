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

import { loadJumiaImportContext } from './load-jumia-import-context';

describe('loadJumiaImportContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      getShops: vi.fn().mockResolvedValue([
        {
          id: 'shop-1',
          businessClients: [
            { status: 'active', code: 'NG-RETAIL' },
            { status: 'active', code: 'NG-EXPRESS' },
          ],
        },
      ]),
    };

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
      getShops: vi.fn().mockResolvedValue([
        {
          id: 'shop-1',
          businessClients: [{ status: 'active', code: 'NG-RETAIL' }],
        },
      ]),
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
});
