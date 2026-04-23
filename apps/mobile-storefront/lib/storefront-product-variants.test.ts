import { jest } from '@jest/globals';

const mockWithSupabaseRetry = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (operation: () => Promise<unknown>, options?: unknown) =>
    mockWithSupabaseRetry(operation, options),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const {
  getStorefrontProductVariantsByProductIds,
  hydrateProductRowsWithStorefrontVariants,
} =
  require('./storefront-product-variants') as typeof import('./storefront-product-variants');

describe('storefront-product-variants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithSupabaseRetry.mockImplementation((...args: unknown[]) => {
      const operation = args[0] as () => Promise<unknown>;
      return operation();
    });
  });

  it('returns an empty object without calling the rpc when no product ids are provided', async () => {
    await expect(getStorefrontProductVariantsByProductIds([])).resolves.toEqual(
      {}
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('hydrates rows with storefront-safe variants from the rpc', async () => {
    mockRpc.mockImplementation(async () => ({
      data: [
        {
          id: 'variant-1',
          product_id: 'product-1',
          condition: 'used',
          price_override: '470000.00',
          stock_quantity: 0,
          attributes: {
            storage: '64GB',
          },
        },
      ],
      error: null,
    }));

    const rows = await hydrateProductRowsWithStorefrontVariants([
      { id: 'product-1', variants: [] },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'product-1',
        variants: [
          expect.objectContaining({
            condition: 'used',
            price_override: '470000.00',
          }),
        ],
      }),
    ]);
  });

  it('returns rows unchanged when there are no row ids to hydrate', async () => {
    const rows = [{ slug: 'no-id' }, { id: null, variants: [] }];

    await expect(
      hydrateProductRowsWithStorefrontVariants(rows)
    ).resolves.toEqual(rows);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns rows unchanged when the rpc errors', async () => {
    mockRpc.mockImplementation(async () => ({
      data: null,
      error: { message: 'boom' },
    }));

    const rows = [{ id: 'product-1', variants: [] }];

    await expect(
      hydrateProductRowsWithStorefrontVariants(rows)
    ).resolves.toEqual(rows);
  });

  it('returns rows unchanged when the rpc returns no variants', async () => {
    mockRpc.mockImplementation(async () => ({
      data: [],
      error: null,
    }));

    const rows = [{ id: 'product-1', variants: [] }];

    await expect(
      hydrateProductRowsWithStorefrontVariants(rows)
    ).resolves.toEqual(rows);
  });

  it('groups rpc variants by product id', async () => {
    mockRpc.mockImplementation(async () => ({
      data: [
        {
          id: 'variant-1',
          product_id: 'product-1',
          attributes: { storage: '64GB' },
        },
        {
          id: 'variant-2',
          product_id: 'product-2',
          attributes: { storage: '256GB' },
        },
      ],
      error: null,
    }));

    const variantsByProductId = await getStorefrontProductVariantsByProductIds([
      'product-1',
      'product-2',
    ]);

    expect(variantsByProductId).toEqual({
      'product-1': [expect.objectContaining({ id: 'variant-1' })],
      'product-2': [expect.objectContaining({ id: 'variant-2' })],
    });
  });

  it('groups multiple variants for the same product id', async () => {
    mockRpc.mockImplementation(async () => ({
      data: [
        {
          id: 'variant-1',
          product_id: 'product-1',
          attributes: { storage: '64GB' },
        },
        {
          id: 'variant-2',
          product_id: 'product-1',
          attributes: { storage: '256GB' },
        },
      ],
      error: null,
    }));

    await expect(
      getStorefrontProductVariantsByProductIds(['product-1'])
    ).resolves.toEqual({
      'product-1': [
        expect.objectContaining({ id: 'variant-1' }),
        expect.objectContaining({ id: 'variant-2' }),
      ],
    });
  });

  it('returns an empty object when the rpc errors', async () => {
    mockRpc.mockImplementation(async () => ({
      data: null,
      error: { message: 'boom' },
    }));

    await expect(
      getStorefrontProductVariantsByProductIds(['product-1'])
    ).resolves.toEqual({});
  });
});
