import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateStatus = vi.fn();
const mockUpdatePrice = vi.fn();

vi.mock('@/lib/jumia/feeds', () => ({
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  updatePrice: (...args: unknown[]) => mockUpdatePrice(...args),
}));

import {
  getJumiaPriceOverrideError,
  getJumiaProductUpdateReadinessErrors,
  pushPriceUpdates,
  pushStatusUpdates,
  resolveSalePrice,
} from './jumia-product-update-feeds';

describe('getJumiaProductUpdateReadinessErrors', () => {
  it('reports every requested feed when all variants are still pending', () => {
    expect(
      getJumiaProductUpdateReadinessErrors(
        [{ jumia_product_id: null }],
        true,
        true
      )
    ).toEqual([
      'Status update skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)',
      'Price update skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)',
    ]);
  });
});

describe('getJumiaPriceOverrideError', () => {
  it('accepts one price override for every ready variant', () => {
    expect(
      getJumiaPriceOverrideError(
        [
          { jumia_sku: 'SKU-1', jumia_price: 1000 },
          { jumia_sku: 'SKU-2', jumia_price: 1200 },
        ],
        { jumia_price: 1500 }
      )
    ).toBeNull();
  });
});

const mapping = {
  jumia_sale_price: 1000,
  jumia_sale_start: '2026-08-01',
  jumia_sale_end: '2026-08-31',
};

describe('resolveSalePrice', () => {
  it('returns undefined when sale price is explicitly cleared', () => {
    expect(
      resolveSalePrice({ jumia_sale_price: null }, mapping)
    ).toBeUndefined();
  });

  it('uses override price with the mapping sale window', () => {
    expect(resolveSalePrice({ jumia_sale_price: 900 }, mapping)).toEqual({
      value: 900,
      startAt: '2026-08-01',
      endAt: '2026-08-31',
    });
  });

  it('keeps the mapping price when only sale dates are overridden', () => {
    expect(
      resolveSalePrice(
        { jumia_sale_start: '2026-09-01', jumia_sale_end: '2026-09-30' },
        mapping
      )
    ).toEqual({
      value: 1000,
      startAt: '2026-09-01',
      endAt: '2026-09-30',
    });
  });

  it('returns undefined when overrides are empty', () => {
    expect(resolveSalePrice({}, mapping)).toBeUndefined();
  });
});

describe('pushStatusUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips feed submission when mappings lack Jumia product ids', async () => {
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushStatusUpdates(
      { shopId: 'shop-1', marketplaceKey: 'default' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: null,
          jumia_sku: 'SKU-1',
        } as never,
      ],
      false,
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual([]);
    expect(feedErrors[0]).toContain('Status update skipped');
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('updates the variants that are ready when another variant is still pending', async () => {
    mockUpdateStatus.mockResolvedValue('feed-status-partial');
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushStatusUpdates(
      { shopId: 'shop-1', marketplaceKey: 'default' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
        } as never,
        {
          id: 'map-2',
          jumia_product_id: null,
          jumia_sku: 'SKU-2',
        } as never,
      ],
      true,
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual(['feed-status-partial']);
    expect(feedErrors).toEqual([]);
    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), [
      { id: 'JUMIA-1', sellerSku: 'SKU-1', status: 'active' },
    ]);
  });

  it('uses the documented business-client status shape for selected marketplaces', async () => {
    mockUpdateStatus.mockResolvedValue('feed-status-client');
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushStatusUpdates(
      { shopId: 'shop-1', marketplaceKey: 'NG-RETAIL' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
        } as never,
      ],
      true,
      feedIds,
      feedErrors
    );

    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), [
      {
        id: 'JUMIA-1',
        sellerSku: 'SKU-1',
        status: 'active',
        businessClients: [
          { businessClientCode: 'NG-RETAIL', status: 'active' },
        ],
      },
    ]);
  });

  it('records a successful status feed id', async () => {
    mockUpdateStatus.mockResolvedValue('feed-status-1');
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushStatusUpdates(
      { shopId: 'shop-1', marketplaceKey: 'default' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
        } as never,
      ],
      true,
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual(['feed-status-1']);
    expect(mockUpdateStatus).toHaveBeenCalledWith(expect.anything(), [
      { id: 'JUMIA-1', sellerSku: 'SKU-1', status: 'active' },
    ]);
  });
});

describe('pushPriceUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a skip when no resolved price exists', async () => {
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushPriceUpdates(
      { shopId: 'shop-1', marketplaceKey: 'default' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
          jumia_price: null,
        } as never,
      ],
      {},
      'GHS',
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual([]);
    expect(feedErrors[0]).toContain('Price update skipped');
    expect(mockUpdatePrice).not.toHaveBeenCalled();
  });

  it('updates the variants that are ready when another variant is still pending', async () => {
    mockUpdatePrice.mockResolvedValue('feed-price-partial');
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushPriceUpdates(
      { shopId: 'shop-1', marketplaceKey: 'default' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
          jumia_price: 1500,
          jumia_sale_price: null,
          jumia_sale_start: null,
          jumia_sale_end: null,
        } as never,
        {
          id: 'map-2',
          jumia_product_id: null,
          jumia_sku: 'SKU-2',
          jumia_price: 1200,
          jumia_sale_price: null,
          jumia_sale_start: null,
          jumia_sale_end: null,
        } as never,
      ],
      { jumia_price: 1500 },
      'NGN',
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual(['feed-price-partial']);
    expect(feedErrors).toEqual([]);
    expect(mockUpdatePrice).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        id: 'JUMIA-1',
        sellerSku: 'SKU-1',
        price: expect.objectContaining({ value: 1500, currency: 'NGN' }),
      }),
    ]);
  });

  it('submits price feeds with the resolved marketplace currency', async () => {
    mockUpdatePrice.mockResolvedValue('feed-price-1');
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushPriceUpdates(
      { shopId: 'shop-1', marketplaceKey: 'GH' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
          jumia_price: 1500,
          jumia_sale_price: null,
          jumia_sale_start: null,
          jumia_sale_end: null,
        } as never,
      ],
      { jumia_price: 1500 },
      'GHS',
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual(['feed-price-1']);
    expect(mockUpdatePrice).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        price: expect.objectContaining({ currency: 'GHS', value: 1500 }),
      }),
    ]);
  });

  it('uses per-variant prices and scopes feeds to a selected business client', async () => {
    mockUpdatePrice.mockResolvedValue('feed-price-variants');
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushPriceUpdates(
      { shopId: 'shop-1', marketplaceKey: 'NG-RETAIL' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
          jumia_price: 1000,
          jumia_sale_price: null,
          jumia_sale_start: null,
          jumia_sale_end: null,
        } as never,
        {
          id: 'map-2',
          jumia_product_id: 'JUMIA-2',
          jumia_sku: 'SKU-2',
          jumia_price: 1200,
          jumia_sale_price: null,
          jumia_sale_start: null,
          jumia_sale_end: null,
        } as never,
      ],
      { jumia_prices: { 'SKU-1': 1100, 'SKU-2': 1300 } },
      'NGN',
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual(['feed-price-variants']);
    expect(mockUpdatePrice).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        sellerSku: 'SKU-1',
        price: expect.objectContaining({ value: 1100 }),
        businessClients: [
          {
            businessClientCode: 'NG-RETAIL',
            price: expect.objectContaining({ value: 1100, currency: 'NGN' }),
          },
        ],
      }),
      expect.objectContaining({
        sellerSku: 'SKU-2',
        price: expect.objectContaining({ value: 1300 }),
        businessClients: [
          {
            businessClientCode: 'NG-RETAIL',
            price: expect.objectContaining({ value: 1300, currency: 'NGN' }),
          },
        ],
      }),
    ]);
  });

  it('records price feed failures', async () => {
    mockUpdatePrice.mockRejectedValue(new Error('vendor rejected price'));
    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    await pushPriceUpdates(
      { shopId: 'shop-1', marketplaceKey: 'default' } as never,
      [
        {
          id: 'map-1',
          jumia_product_id: 'JUMIA-1',
          jumia_sku: 'SKU-1',
          jumia_price: 1500,
          jumia_sale_price: null,
          jumia_sale_start: null,
          jumia_sale_end: null,
        } as never,
      ],
      { jumia_price: 1500 },
      'NGN',
      feedIds,
      feedErrors
    );

    expect(feedIds).toEqual([]);
    expect(feedErrors[0]).toContain('Price update failed');
  });
});
