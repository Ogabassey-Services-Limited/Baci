import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';

const VALID_AGENTIC_MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
const mockVerifyAgenticApiKey = vi.hoisted(() => vi.fn(() => true));
const mockResolveAgenticMerchantContext = vi.hoisted(() =>
  vi.fn(async () => ({
    agent_user_agent_allowlist: [],
    agent_user_agent_denylist: [],
    agentic_checkout_enabled: true,
    business_name: 'Ogabassey',
    custom_domain: undefined,
    id: '00000000-0000-4000-8000-000000000001',
    pay_on_delivery_enabled: false,
    paystack_subaccount_code: null,
    slug: 'ogabassey',
  }))
);

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: mockVerifyAgenticApiKey,
}));

vi.mock('@/lib/agentic/agent-request-controls', () => ({
  verifyAgenticRequestAccess: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: mockResolveAgenticMerchantContext,
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

import { POST } from './route';

type ProductRow = {
  categories?: { slug?: string | null } | null;
  id: string;
  name: string;
  price?: number | string | null;
  product_categories?: Array<{ categories?: { slug?: string | null } | null }>;
  slug?: string;
  status?: string;
};

let mockSelect: ReturnType<typeof vi.fn>;
let mockRpc: ReturnType<typeof vi.fn>;
let query: {
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

function mockProductRows(rows: ProductRow[]) {
  mockRpc = vi.fn().mockResolvedValue({
    data: rows
      .filter((row) => row.status !== 'draft')
      .map((row) => ({ product_id: row.id, total_count: rows.length })),
    error: null,
  });
  query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
  };
  mockSelect = vi.fn(() => query);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    rpc: mockRpc,
    from: vi.fn(() => ({ select: mockSelect })),
  } as never);
}

function mockRankedProductRows(rows: ProductRow[], rankedIds: string[]) {
  return mockRankedProductBatches([
    { rankedIds, rows, totalCount: rankedIds.length },
  ]);
}

function mockRankedProductBatches(
  batches: Array<{
    rankedIds: string[];
    rows: ProductRow[];
    totalCount: number;
  }>
) {
  const rows = batches.flatMap((batch) => batch.rows);
  let requestedIds: string[] = [];
  mockRpc = vi.fn();
  for (const batch of batches) {
    mockRpc.mockResolvedValueOnce({
      data: batch.rankedIds.map((id) => ({
        product_id: id,
        total_count: batch.totalCount,
      })),
      error: null,
    });
  }
  query = {
    eq: vi.fn(() => query),
    in: vi.fn((_column: string, ids: string[]) => {
      requestedIds = ids;
      return query;
    }),
    limit: vi.fn(async () => ({
      data: rows.filter((row) => requestedIds.includes(row.id)),
      error: null,
    })),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
  };
  mockSelect = vi.fn(() => query);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    rpc: mockRpc,
    from: vi.fn(() => ({ select: mockSelect })),
  } as never);

  return { rpc: mockRpc };
}

describe('POST /api/agentic/catalog/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockProductRows([]);
  });

  it('returns 401 when the agent key is missing', async () => {
    mockVerifyAgenticApiKey.mockReturnValueOnce(false);

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'iphone' }),
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
    expect(createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns matching active products for a text query', async () => {
    mockProductRows([
      {
        id: 'product-1',
        name: 'iPhone 15',
        price: 1_200_000,
        slug: 'iphone-15',
        status: 'active',
      },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'iphone', pagination: { limit: 10 } }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toEqual([
      expect.objectContaining({ id: 'product-1', title: 'iPhone 15' }),
    ]);
    expect(query.order).toHaveBeenCalledWith('category_id', {
      ascending: true,
      referencedTable: 'product_categories',
    });
    expect(query.eq).toHaveBeenCalledWith(
      'merchant_id',
      VALID_AGENTIC_MERCHANT_ID
    );
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(mockRpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ search_query: 'iphone' })
    );
    expect(query.in).toHaveBeenCalledWith('id', ['product-1']);
    expect(query.or).not.toHaveBeenCalled();
  });

  it('uses search_products_v2 for catalog search ranking', async () => {
    const { rpc } = mockRankedProductRows(
      [
        {
          id: 'product-1',
          name: 'iPhone X',
          price: 240_000,
          slug: 'iphone-x',
          status: 'active',
        },
        {
          id: 'product-2',
          name: 'iPhone 16 Pro',
          price: 1_200_000,
          slug: 'iphone-16-pro',
          status: 'active',
        },
      ],
      ['product-2', 'product-1']
    );

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'iphnoe', pagination: { limit: 20 } }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(rpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ search_query: 'iphnoe' })
    );
    expect(query.in).toHaveBeenCalledWith('id', ['product-2', 'product-1']);
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
      'product-1',
    ]);
  });

  it('hydrates only the ranked page before returning ranked catalog products', async () => {
    mockRankedProductRows(
      [
        {
          id: 'product-1',
          name: 'iPhone X',
          price: 240_000,
          slug: 'iphone-x',
          status: 'active',
        },
        {
          id: 'product-2',
          name: 'iPhone 16 Pro',
          price: 1_200_000,
          slug: 'iphone-16-pro',
          status: 'active',
        },
      ],
      ['product-2', 'product-1', 'product-3']
    );

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'iphnoe', pagination: { limit: 2 } }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(query.in).toHaveBeenCalledWith('id', [
      'product-2',
      'product-1',
      'product-3',
    ]);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(query.order).toHaveBeenCalledWith('category_id', {
      ascending: true,
      referencedTable: 'product_categories',
    });
    expect(query.order).not.toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'product-2',
      'product-1',
    ]);
  });

  it('returns 500 when ranked catalog search fails', async () => {
    mockProductRows([]);
    mockRpc.mockRejectedValueOnce(new Error('RPC down'));

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'iphone' }),
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: 'Catalog search failed',
    });
    expect(response.status).toBe(500);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('omits unpublished products returned by the database', async () => {
    mockProductRows([
      { id: 'draft-product', name: 'Draft', status: 'draft' },
      { id: 'product-1', name: 'Live', price: 0, status: 'active' },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'phone' }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(body.products).toEqual([
      expect.objectContaining({ id: 'product-1' }),
    ]);
  });

  it('omits active products with malformed prices', async () => {
    mockProductRows([
      { id: 'bad-price', name: 'Bad', price: '123abc', status: 'active' },
      { id: 'free-product', name: 'Free', price: 0, status: 'active' },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'phone' }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'free-product',
    ]);
  });

  it('fills the requested page after refusing an invalid ranked candidate', async () => {
    mockRankedProductBatches([
      {
        rankedIds: ['bad-price-1', 'bad-price-2'],
        rows: [
          {
            id: 'bad-price-1',
            name: 'Bad 1',
            price: -1,
            slug: 'bad-price-1',
            status: 'active',
          },
          {
            id: 'bad-price-2',
            name: 'Bad 2',
            price: Number.NaN,
            slug: 'bad-price-2',
            status: 'active',
          },
        ],
        totalCount: 3,
      },
      {
        rankedIds: ['valid-product'],
        rows: [
          {
            id: 'valid-product',
            name: 'Valid product',
            price: 100,
            slug: 'valid-product',
            status: 'active',
          },
        ],
        totalCount: 3,
      },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'product', pagination: { limit: 1 } }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      'search_products_v2',
      expect.objectContaining({ result_limit: 2, result_offset: 2 })
    );
    expect(query.in).toHaveBeenNthCalledWith(1, 'id', [
      'bad-price-1',
      'bad-price-2',
    ]);
    expect(query.in).toHaveBeenNthCalledWith(2, 'id', ['valid-product']);
    expect(body.products.map((product: { id: string }) => product.id)).toEqual([
      'valid-product',
    ]);
  });

  it('stops ranked backfill at the cumulative candidate cap', async () => {
    const rankedIds = Array.from(
      { length: 100 },
      (_, index) => `bad-price-${index}`
    );
    mockRankedProductBatches([
      {
        rankedIds,
        rows: rankedIds.map((id) => ({
          id,
          name: id,
          price: -1,
          status: 'active',
        })),
        totalCount: 101,
      },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'product', pagination: { limit: 50 } }),
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'search_products_v2',
      expect.objectContaining({ result_limit: 100, result_offset: 0 })
    );
  });

  it('does not use select star in Supabase queries', async () => {
    await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'phone' }),
        method: 'POST',
      })
    );

    expect(mockSelect).not.toHaveBeenCalledWith('*');
  });

  it('selects junction categories for legacy category-only products', async () => {
    mockRankedProductRows(
      [
        {
          id: 'legacy-product',
          name: 'Legacy product',
          price: 100,
          status: 'active',
        },
      ],
      ['legacy-product']
    );

    await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'phone' }),
        method: 'POST',
      })
    );

    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining(
        'product_categories:product_categories(category_id, categories(slug, is_active))'
      )
    );
  });
});
