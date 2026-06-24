import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedStorefrontLaunchProducts,
  type StorefrontHomeProduct,
} from '@/lib/cached-data';
import { getCachedStorefrontProductsBySlugs } from '@/lib/cached-storefront-products-by-slugs';
import {
  loadOgabasseyLaunchProducts,
  selectOgabasseyLaunchProducts,
  sortByNewestCreated,
} from './ogabassey-home-launch-products';

vi.mock('@/lib/cached-data', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCachedStorefrontLaunchProducts: vi.fn(),
  };
});

vi.mock('@/lib/cached-storefront-products-by-slugs', () => ({
  getCachedStorefrontProductsBySlugs: vi.fn(),
}));

function createRow(
  overrides: Partial<StorefrontHomeProduct> = {}
): StorefrontHomeProduct {
  return {
    id: 'product-1',
    name: 'Samsung Galaxy A27 5G',
    slug: 'samsung-galaxy-a27-5g',
    price: 50000,
    images: ['https://cdn.ogabassey.com/products/a27.avif'],
    category: 'Smartphones',
    brand: 'Samsung',
    condition: 'new',
    stock: 2,
    stock_quantity: null,
    manage_stock: false,
    low_stock_threshold: null,
    product_categories: [],
    ...overrides,
  };
}

describe('ogabassey home launch products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedStorefrontLaunchProducts).mockResolvedValue([]);
    vi.mocked(getCachedStorefrontProductsBySlugs).mockResolvedValue([]);
  });

  it('sorts missing timestamps last while preserving newest-created order', () => {
    expect(
      sortByNewestCreated([
        { id: 'old', created_at: '2026-05-01T00:00:00.000Z' },
        { id: 'missing' },
        { id: 'new', created_at: '2026-06-01T00:00:00.000Z' },
      ]).map((row) => row.id)
    ).toEqual(['new', 'old', 'missing']);
  });

  it('selects renderable launch products with newer additions ahead of pins', () => {
    const products = selectOgabasseyLaunchProducts({
      launchCandidateRows: [
        createRow({
          id: 'newer',
          name: 'New Arrival',
          slug: 'new-arrival',
          created_at: '2026-06-24T00:00:00.000Z',
        }),
        createRow({
          id: 'unrenderable',
          name: 'No Image',
          slug: 'no-image',
          images: [],
          created_at: '2026-06-25T00:00:00.000Z',
        }),
      ],
      pinnedProductRows: [
        createRow({
          id: 'pin',
          name: 'Pinned A27',
          slug: 'samsung-galaxy-a27-5g',
          created_at: '2026-05-01T00:00:00.000Z',
        }),
      ],
    });

    expect(products.map((product) => product.name)).toEqual([
      'New Arrival',
      'Pinned A27',
    ]);
  });

  it('loads launch and pinned rows for the streamed hero without failing on missing pins', async () => {
    vi.mocked(getCachedStorefrontLaunchProducts).mockResolvedValue([
      createRow({ id: 'launch', name: 'Launch Device' }),
    ]);
    vi.mocked(getCachedStorefrontProductsBySlugs).mockRejectedValue(
      new Error('temporary cache miss')
    );

    const products = await loadOgabasseyLaunchProducts('merchant-1');

    expect(getCachedStorefrontLaunchProducts).toHaveBeenCalledWith(
      'merchant-1'
    );
    expect(getCachedStorefrontProductsBySlugs).toHaveBeenCalledWith(
      'merchant-1',
      expect.arrayContaining(['samsung-galaxy-a27-5g'])
    );
    expect(products.map((product) => product.name)).toEqual(['Launch Device']);
  });
});
