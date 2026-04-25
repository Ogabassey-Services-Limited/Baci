import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  hydrateRowsNeedingStorefrontVariants,
  needsVariantHydration,
} from './product-hydration';

const mockHydrateProductRowsWithStorefrontVariants: jest.Mock = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/storefront-product-variants', () => ({
  hydrateProductRowsWithStorefrontVariants: (...args: unknown[]) =>
    mockHydrateProductRowsWithStorefrontVariants(...args),
}));

describe('product-hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('identifies only variant products without embedded variants as hydration candidates', () => {
    expect(
      needsVariantHydration({
        has_variants: true,
        variants: undefined,
      })
    ).toBe(true);
    expect(
      needsVariantHydration({
        has_variants: true,
        variants: null,
      })
    ).toBe(true);
    expect(
      needsVariantHydration({
        has_variants: true,
        variants: [],
      })
    ).toBe(true);
    expect(
      needsVariantHydration({
        has_variants: true,
        variants: 'not-an-array',
      })
    ).toBe(true);
    expect(
      needsVariantHydration({
        has_variants: true,
        variants: [{ id: 'variant-1' }],
      })
    ).toBe(false);
    expect(
      needsVariantHydration({
        has_variants: false,
        variants: [],
      })
    ).toBe(false);
    expect(
      needsVariantHydration({
        variants: [],
      })
    ).toBe(false);
  });

  it('returns empty hydration input without calling the variant hydrator', async () => {
    await expect(hydrateRowsNeedingStorefrontVariants([])).resolves.toEqual([]);

    expect(mockHydrateProductRowsWithStorefrontVariants).not.toHaveBeenCalled();
  });

  it('hydrates only rows that need storefront variants and preserves row order', async () => {
    const rows = [
      {
        id: 'needs-hydration',
        has_variants: true,
        variants: [],
      },
      {
        id: 'already-hydrated',
        has_variants: true,
        variants: [{ id: 'embedded-variant' }],
      },
      {
        id: 'simple-product',
        has_variants: false,
        variants: [],
      },
    ];
    const hydratedRow = {
      ...rows[0],
      variants: [{ id: 'hydrated-variant' }],
    };
    mockHydrateProductRowsWithStorefrontVariants.mockImplementationOnce(
      async () => [hydratedRow]
    );

    const result = await hydrateRowsNeedingStorefrontVariants(rows);

    expect(mockHydrateProductRowsWithStorefrontVariants).toHaveBeenCalledWith([
      rows[0],
    ]);
    expect(result).toEqual([hydratedRow, rows[1], rows[2]]);
    expect(result[1]).toBe(rows[1]);
    expect(result[2]).toBe(rows[2]);
  });

  it('leaves rows with non-string ids unchanged during hydration', async () => {
    const rows = [
      {
        id: 123,
        has_variants: true,
        variants: [],
      },
    ];
    mockHydrateProductRowsWithStorefrontVariants.mockImplementationOnce(
      async () => rows
    );

    const result = await hydrateRowsNeedingStorefrontVariants(rows);

    // The non-string-id row still routes through the hydrator (it matches
    // `needsVariantHydration`), but the post-hydration lookup map filters by
    // `typeof row.id === 'string'`, so the original row falls through and
    // identity is preserved.
    expect(mockHydrateProductRowsWithStorefrontVariants).toHaveBeenCalledWith([
      rows[0],
    ]);
    expect(result).toEqual(rows);
    expect(result[0]).toBe(rows[0]);
  });

  it('falls back to original rows when variant hydration fails', async () => {
    const rows = [
      {
        id: 'needs-hydration',
        has_variants: true,
        variants: [],
      },
    ];
    mockHydrateProductRowsWithStorefrontVariants.mockImplementationOnce(() =>
      Promise.reject(new Error('RPC failed'))
    );

    const result = await hydrateRowsNeedingStorefrontVariants(rows);

    expect(result).toBe(rows);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Failed to hydrate storefront variants; using embedded rows',
      expect.objectContaining({
        error: expect.any(Error),
      })
    );
  });
});
