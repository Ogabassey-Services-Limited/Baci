import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  getEffectiveInventoryTrackingPolicy,
  getPublicSerializedVariantSummariesByProductId,
} from './public-serialized-variant-summary';

describe('getEffectiveInventoryTrackingPolicy', () => {
  it('returns variant policy directly if variant policy is not inherit/null', () => {
    expect(
      getEffectiveInventoryTrackingPolicy('off', 'serialized_strict')
    ).toBe('serialized_strict');
    expect(
      getEffectiveInventoryTrackingPolicy('serialized_strict', 'off')
    ).toBe('off');
    expect(
      getEffectiveInventoryTrackingPolicy(
        'serialized_strict',
        'serialized_then_unlimited'
      )
    ).toBe('serialized_then_unlimited');
  });

  it('inherits product policy if variant policy is inherit or null', () => {
    expect(
      getEffectiveInventoryTrackingPolicy('serialized_strict', 'inherit')
    ).toBe('serialized_strict');
    expect(
      getEffectiveInventoryTrackingPolicy('serialized_then_unlimited', null)
    ).toBe('serialized_then_unlimited');
  });

  it('defaults to off if neither product nor variant policy is serialized', () => {
    expect(getEffectiveInventoryTrackingPolicy('off', 'inherit')).toBe('off');
    expect(getEffectiveInventoryTrackingPolicy('off', null)).toBe('off');
  });
});

describe('getPublicSerializedVariantSummariesByProductId', () => {
  const merchantId = 'merchant-123';

  it('returns empty array if productIds is empty', async () => {
    const mockSupabase = {} as unknown as SupabaseClient;
    const result = await getPublicSerializedVariantSummariesByProductId(
      mockSupabase,
      merchantId,
      []
    );
    expect(result).toEqual([]);
  });

  it('correctly fetches and resolves simple product summaries', async () => {
    const productIds = ['prod-1'];

    // Mock products query
    const productsData = [
      {
        id: 'prod-1',
        inventory_tracking_policy: 'serialized_strict',
        has_variants: false,
        status: 'active',
      },
    ];

    // Mock variants query (should have the hidden anchor variant)
    const variantsData = [
      {
        id: 'variant-anchor-1',
        product_id: 'prod-1',
        inventory_tracking_policy: 'inherit',
        is_inventory_anchor: true,
      },
    ];

    // Mock RPC counts response
    const countsData = [
      {
        product_id: 'prod-1',
        variant_id: null,
        public_available_units: 5,
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockImplementation((_columns: string) => {
            return {
              eq: vi.fn().mockImplementation(() => {
                return {
                  in: vi.fn().mockResolvedValue({
                    data: table === 'products' ? productsData : variantsData,
                    error: null,
                  }),
                };
              }),
            };
          }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({
        data: countsData,
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await getPublicSerializedVariantSummariesByProductId(
      mockSupabase,
      merchantId,
      productIds
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      productId: 'prod-1',
      variantId: null,
      publicAvailableUnits: 5,
      inventoryTrackingPolicy: 'serialized_strict',
    });
  });

  it('correctly fetches and resolves variant product summaries, excluding anchor variants', async () => {
    const productIds = ['prod-2'];

    // Mock products query
    const productsData = [
      {
        id: 'prod-2',
        inventory_tracking_policy: 'off',
        has_variants: true,
        status: 'active',
      },
    ];

    // Mock variants query (anchor + two visible variants)
    const variantsData = [
      {
        id: 'variant-anchor-2',
        product_id: 'prod-2',
        inventory_tracking_policy: 'inherit',
        is_inventory_anchor: true,
      },
      {
        id: 'variant-visible-2a',
        product_id: 'prod-2',
        inventory_tracking_policy: 'serialized_strict',
        is_inventory_anchor: false,
      },
      {
        id: 'variant-visible-2b',
        product_id: 'prod-2',
        inventory_tracking_policy: 'serialized_then_unlimited',
        is_inventory_anchor: false,
      },
    ];

    // Mock RPC counts response (only one variant has stock in DB)
    const countsData = [
      {
        product_id: 'prod-2',
        variant_id: 'variant-visible-2a',
        public_available_units: 3,
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockImplementation(() => {
            return {
              eq: vi.fn().mockImplementation(() => {
                return {
                  in: vi.fn().mockResolvedValue({
                    data: table === 'products' ? productsData : variantsData,
                    error: null,
                  }),
                };
              }),
            };
          }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({
        data: countsData,
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await getPublicSerializedVariantSummariesByProductId(
      mockSupabase,
      merchantId,
      productIds
    );

    expect(result).toHaveLength(2);
    // Sort results by variantId for deterministic checks
    const sortedResult = [...result].sort((a, b) =>
      (a.variantId || '').localeCompare(b.variantId || '')
    );

    expect(sortedResult[0]).toEqual({
      productId: 'prod-2',
      variantId: 'variant-visible-2a',
      publicAvailableUnits: 3,
      inventoryTrackingPolicy: 'serialized_strict',
    });

    expect(sortedResult[1]).toEqual({
      productId: 'prod-2',
      variantId: 'variant-visible-2b',
      publicAvailableUnits: 0,
      inventoryTrackingPolicy: 'serialized_then_unlimited',
    });
  });

  it('chunks queries in batches of 200 items', async () => {
    // Generate 250 product IDs
    const productIds = Array.from({ length: 250 }, (_, i) => `prod-${i}`);

    const mockProductsSelect = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => ({
        in: vi.fn().mockImplementation((_field: string, ids: string[]) => {
          return Promise.resolve({
            data: ids.map((id) => ({
              id,
              inventory_tracking_policy: 'serialized_strict',
              has_variants: false,
              status: 'active',
            })),
            error: null,
          });
        }),
      })),
    }));

    const mockVariantsSelect = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => ({
        in: vi.fn().mockImplementation((_field: string, ids: string[]) => {
          return Promise.resolve({
            data: ids.map((id) => ({
              id: `anchor-${id}`,
              product_id: id,
              inventory_tracking_policy: 'inherit',
              is_inventory_anchor: true,
            })),
            error: null,
          });
        }),
      })),
    }));

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select:
            table === 'products' ? mockProductsSelect : mockVariantsSelect,
        };
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    } as unknown as SupabaseClient;

    const result = await getPublicSerializedVariantSummariesByProductId(
      mockSupabase,
      merchantId,
      productIds
    );

    expect(result).toHaveLength(250);
    // Verify chunk calls
    expect(mockSupabase.from).toHaveBeenCalledTimes(4); // 2 chunk products + 2 chunk variants
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2); // 2 chunk rpcs
  });

  it('throws when the products query fails', async () => {
    const productsError = new Error('products query failed');
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: productsError }),
          }),
        }),
      }),
      rpc: vi.fn(),
    } as unknown as SupabaseClient;

    await expect(
      getPublicSerializedVariantSummariesByProductId(mockSupabase, merchantId, [
        'prod-1',
      ])
    ).rejects.toThrow(productsError);
  });

  it('throws when the variants query fails', async () => {
    const variantsError = new Error('variants query failed');
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data:
                table === 'products'
                  ? [
                      {
                        id: 'prod-1',
                        inventory_tracking_policy: 'serialized_strict',
                        has_variants: false,
                        status: 'active',
                      },
                    ]
                  : null,
              error: table === 'products' ? null : variantsError,
            }),
          }),
        }),
      })),
      rpc: vi.fn(),
    } as unknown as SupabaseClient;

    await expect(
      getPublicSerializedVariantSummariesByProductId(mockSupabase, merchantId, [
        'prod-1',
      ])
    ).rejects.toThrow(variantsError);
  });

  it('throws when the availability counts RPC fails', async () => {
    const countsError = new Error('counts rpc failed');
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data:
                table === 'products'
                  ? [
                      {
                        id: 'prod-1',
                        inventory_tracking_policy: 'serialized_strict',
                        has_variants: false,
                        status: 'active',
                      },
                    ]
                  : [
                      {
                        id: 'variant-anchor-1',
                        product_id: 'prod-1',
                        inventory_tracking_policy: 'inherit',
                        is_inventory_anchor: true,
                      },
                    ],
              error: null,
            }),
          }),
        }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: countsError }),
    } as unknown as SupabaseClient;

    await expect(
      getPublicSerializedVariantSummariesByProductId(mockSupabase, merchantId, [
        'prod-1',
      ])
    ).rejects.toThrow(countsError);
  });
});
