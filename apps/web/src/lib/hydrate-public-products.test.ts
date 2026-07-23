import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSummaries = vi.fn();
vi.mock('@/lib/public-serialized-variant-summary', () => ({
  getPublicSerializedVariantSummariesByProductId: (...args: unknown[]) =>
    mockSummaries(...args),
}));
vi.mock('@/lib/public-fulfillment-sanitizer', () => ({
  sanitizePublicProduct: (product: unknown) => product,
}));

import { hydrateAndSanitizePublicProducts } from '@/lib/hydrate-public-products';

describe('hydrateAndSanitizePublicProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves serialized-then-unlimited products as purchasable', async () => {
    mockSummaries.mockResolvedValue([
      {
        inventoryTrackingPolicy: 'serialized_then_unlimited',
        productId: 'product-1',
        publicAvailableUnits: 0,
        variantId: null,
      },
    ]);

    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [
        { id: 'product-1', manage_stock: true, stock: 0 },
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'product-1',
        manage_stock: false,
        stock: 9999,
        stock_quantity: 9999,
      }),
    ]);
  });

  it('marks strict serialized products as stock-managed', async () => {
    mockSummaries.mockResolvedValue([
      {
        inventoryTrackingPolicy: 'serialized_strict',
        productId: 'product-1',
        publicAvailableUnits: 2,
        variantId: null,
      },
    ]);

    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [
        { id: 'product-1' },
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        manage_stock: true,
        stock: 2,
        track_quantity: true,
      }),
    ]);
  });

  it('preserves legacy stock-management flags when serialized tracking is off', async () => {
    mockSummaries.mockResolvedValue([
      {
        inventoryTrackingPolicy: 'off',
        productId: 'product-1',
        publicAvailableUnits: 0,
        variantId: null,
      },
    ]);

    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [
        { id: 'product-1', manage_stock: true, track_quantity: true },
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        manage_stock: true,
        track_quantity: true,
      }),
    ]);
  });

  it('hydrates serialized inventory for both public variant arrays', async () => {
    mockSummaries.mockResolvedValue([
      {
        inventoryTrackingPolicy: 'serialized_strict',
        productId: 'product-1',
        publicAvailableUnits: 2,
        variantId: 'variant-strict',
      },
      {
        inventoryTrackingPolicy: 'serialized_then_unlimited',
        productId: 'product-1',
        publicAvailableUnits: 0,
        variantId: 'variant-unlimited',
      },
    ]);

    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [
        {
          id: 'product-1',
          product_variants: [{ id: 'variant-strict', stock_quantity: 0 }],
          variants: [{ id: 'variant-unlimited', stock_quantity: 0 }],
        },
      ])
    ).resolves.toEqual([
      expect.objectContaining({
        product_variants: [
          expect.objectContaining({
            id: 'variant-strict',
            inventory_tracking_policy: 'serialized_strict',
            stock_quantity: 2,
          }),
        ],
        variants: [
          expect.objectContaining({
            id: 'variant-unlimited',
            inventory_tracking_policy: 'serialized_then_unlimited',
            stock_quantity: 9999,
          }),
        ],
      }),
    ]);
  });

  it('preserves products when no serialized summaries exist', async () => {
    mockSummaries.mockResolvedValue([]);
    const product = { id: 'product-1', manage_stock: false, stock: 12 };

    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [product])
    ).resolves.toEqual([product]);
  });

  it('returns early for an empty product list', async () => {
    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [])
    ).resolves.toEqual([]);
    expect(mockSummaries).not.toHaveBeenCalled();
  });

  it('propagates serialized summary lookup failures', async () => {
    mockSummaries.mockRejectedValue(new Error('summary lookup failed'));

    await expect(
      hydrateAndSanitizePublicProducts({} as never, 'merchant-1', [
        { id: 'product-1' },
      ])
    ).rejects.toThrow('summary lookup failed');
  });
});
