import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchAdminProductSearchRows = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/product-search', () => ({
  fetchAdminProductSearchRows: (...args: unknown[]) =>
    mockFetchAdminProductSearchRows(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { fetchSelectableItems } from './discount-items';

function createSelectableItemQuery(result?: {
  data?: Array<{
    id: string;
    name: string;
    description?: string;
    images?: Array<string | { url?: string | null } | null> | null;
  }>;
  error?: Error | null;
}) {
  const chain = {
    data: result?.data ?? [
      { id: 'cat-1', name: 'Phones', description: 'Smartphones' },
    ],
    error: result?.error ?? null,
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe('fetchSelectableItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses ranked admin product search for product selectors', async () => {
    mockFetchAdminProductSearchRows.mockResolvedValue({
      nextCursor: null,
      rows: [
        {
          id: 'product-1',
          name: 'iPhone 15 Pro',
          description: 'Apple phone',
          images: ['image.jpg'],
        },
      ],
      totalCount: 1,
    });

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'product',
        search: 'iphnoe',
      })
    ).resolves.toEqual([
      {
        id: 'product-1',
        name: 'iPhone 15 Pro',
        description: 'Apple phone',
        images: ['image.jpg'],
      },
    ]);

    expect(mockFetchAdminProductSearchRows).toHaveBeenCalledWith({
      cursor: 0,
      filters: { search: 'iphnoe' },
      merchantId: 'merchant-1',
      pageSize: 50,
      selectColumns: 'id, name, description, images',
    });
    expect(mockFrom).not.toHaveBeenCalledWith('products');
  });

  it('propagates ranked product selector failures', async () => {
    mockFetchAdminProductSearchRows.mockRejectedValue(
      new Error('ranked search failed')
    );

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'product',
        search: 'iphone',
      })
    ).rejects.toThrow('ranked search failed');
  });

  it('defaults null ranked product images to an empty array', async () => {
    mockFetchAdminProductSearchRows.mockResolvedValue({
      nextCursor: null,
      rows: [
        {
          id: 'product-1',
          name: 'iPhone 15 Pro',
          description: 'Apple phone',
          images: null,
        },
      ],
      totalCount: 1,
    });

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'product',
        search: 'iphone',
      })
    ).resolves.toEqual([
      {
        id: 'product-1',
        name: 'iPhone 15 Pro',
        description: 'Apple phone',
        images: [],
      },
    ]);
  });

  it('normalizes object product images to string URLs for ranked product selectors', async () => {
    mockFetchAdminProductSearchRows.mockResolvedValue({
      nextCursor: null,
      rows: [
        {
          id: 'product-1',
          name: 'iPhone 15 Pro',
          description: 'Apple phone',
          images: [
            { url: ' https://cdn.usebaci.com/product-1.jpg ' },
            null,
            { url: null },
            ' https://cdn.usebaci.com/product-1-alt.jpg ',
          ],
        },
      ],
      totalCount: 1,
    });

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'product',
        search: 'iphone',
      })
    ).resolves.toEqual([
      {
        id: 'product-1',
        name: 'iPhone 15 Pro',
        description: 'Apple phone',
        images: [
          'https://cdn.usebaci.com/product-1.jpg',
          'https://cdn.usebaci.com/product-1-alt.jpg',
        ],
      },
    ]);
  });

  it('uses the direct product query fallback for empty product search', async () => {
    const query = createSelectableItemQuery({
      data: [
        {
          id: 'product-1',
          name: 'First Product',
          description: 'Default product',
          images: [{ url: 'https://cdn.usebaci.com/default.jpg' }],
        },
      ],
    });
    mockFrom.mockReturnValue(query);

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'product',
        search: '   ',
      })
    ).resolves.toEqual([
      {
        id: 'product-1',
        name: 'First Product',
        description: 'Default product',
        images: ['https://cdn.usebaci.com/default.jpg'],
      },
    ]);

    expect(mockFetchAdminProductSearchRows).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('products');
    expect(query.ilike).toHaveBeenCalledWith('name', '%%');
  });

  it('keeps category selectors on category name filtering', async () => {
    const query = createSelectableItemQuery();
    mockFrom.mockReturnValue(query);

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'category',
        search: 'phones',
      })
    ).resolves.toEqual([
      {
        id: 'cat-1',
        name: 'Phones',
        description: 'Smartphones',
        images: [],
      },
    ]);

    expect(mockFrom).toHaveBeenCalledWith('categories');
    expect(query.not).toHaveBeenCalledWith('is_active', 'is', false);
    expect(query.ilike).toHaveBeenCalledWith('name', '%phones%');
  });

  it('propagates category selector query failures', async () => {
    const query = createSelectableItemQuery({
      data: [],
      error: new Error('category query failed'),
    });
    mockFrom.mockReturnValue(query);

    await expect(
      fetchSelectableItems({
        merchantId: 'merchant-1',
        type: 'category',
        search: 'phones',
      })
    ).rejects.toThrow('category query failed');
  });
});
