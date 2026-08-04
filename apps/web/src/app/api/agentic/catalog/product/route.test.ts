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
  categories?: { slug?: string | null } | null;
  id: string;
  name: string;
  price?: number;
  product_categories?: Array<{ categories?: { slug?: string | null } | null }>;
  slug?: string;
  status?: string;
};

let query: {
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function mockProductRow(row: ProductRow | null) {
  query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
  } as never);
}

describe('POST /api/agentic/catalog/product', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyAgenticApiKey.mockReturnValue(true);
    mockProductRow(null);
  });

  it('returns a single product detail resource', async () => {
    mockProductRow({
      id: 'product-1',
      name: 'iPhone',
      price: 1_200_000,
      slug: 'iphone',
      status: 'active',
    });

    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/product', {
        body: JSON.stringify({ id: 'product-1' }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.product).toMatchObject({
      id: 'product-1',
      title: 'iPhone',
    });
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(query.eq).toHaveBeenCalledWith('id', 'product-1');
  });

  it('returns 404 when the product is missing', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/product', {
        body: JSON.stringify({ id: 'missing-product' }),
        method: 'POST',
      })
    );

    expect(response.status).toBe(404);
  });

  it('selects junction categories for legacy category-only products', async () => {
    const select = vi.fn(() => query);
    vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
      from: vi.fn(() => ({ select })),
    } as never);

    const { POST } = await import('./route');
    await POST(
      new NextRequest('http://localhost/api/agentic/catalog/product', {
        body: JSON.stringify({ id: 'product-1' }),
        method: 'POST',
      })
    );

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('product_categories:product_categories')
    );
  });
});
