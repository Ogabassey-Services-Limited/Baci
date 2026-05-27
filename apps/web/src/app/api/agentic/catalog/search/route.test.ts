import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';

const mockVerifyAgenticApiKey = vi.hoisted(() => vi.fn(() => true));
const mockResolveAgenticMerchantContext = vi.hoisted(() =>
  vi.fn(async () => ({
    agent_user_agent_allowlist: [],
    agent_user_agent_denylist: [],
    agentic_checkout_enabled: true,
    business_name: 'Ogabassey',
    custom_domain: undefined,
    id: 'merchant-1',
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

type ProductRow = {
  id: string;
  name: string;
  price?: number;
  slug?: string;
  status?: string;
};

let mockSelect: ReturnType<typeof vi.fn>;
let query: {
  eq: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

function mockProductRows(rows: ProductRow[]) {
  query = {
    eq: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
  };
  mockSelect = vi.fn(() => query);
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    from: vi.fn(() => ({ select: mockSelect })),
  } as never);
}

describe('POST /api/agentic/catalog/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockProductRows([]);
  });

  it('returns 401 when the agent key is missing', async () => {
    mockVerifyAgenticApiKey.mockReturnValueOnce(false);

    const { POST } = await import('./route');
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

    const { POST } = await import('./route');
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
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.or).toHaveBeenCalledWith(
      'name.ilike.%iphone%,description.ilike.%iphone%'
    );
  });

  it('omits unpublished products returned by the database', async () => {
    mockProductRows([
      { id: 'draft-product', name: 'Draft', status: 'draft' },
      { id: 'product-1', name: 'Live', status: 'active' },
    ]);

    const { POST } = await import('./route');
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

  it('does not use select star in Supabase queries', async () => {
    const { POST } = await import('./route');
    await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ query: 'phone' }),
        method: 'POST',
      })
    );

    expect(mockSelect).not.toHaveBeenCalledWith('*');
  });
});
