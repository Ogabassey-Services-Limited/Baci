import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { POST } from './search/route';

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: vi.fn(() => true),
}));

vi.mock('@/lib/agentic/agent-request-controls', () => ({
  verifyAgenticRequestAccess: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: vi.fn(async () => ({
    agent_user_agent_allowlist: [],
    agent_user_agent_denylist: [],
    agentic_checkout_enabled: true,
    business_name: 'Ogabassey',
    custom_domain: undefined,
    id: 'merchant-1',
    pay_on_delivery_enabled: false,
    paystack_subaccount_code: null,
    slug: 'ogabassey',
  })),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

let query: {
  eq: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

function mockJunctionOnlyProduct() {
  const rows = [
    {
      id: 'product-1',
      name: 'Laptop',
      price: 100,
      product_categories: [{ categories: { slug: 'laptops' } }],
      slug: 'thin-laptop',
      status: 'active',
    },
  ];
  query = {
    eq: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: rows, error: null })),
    order: vi.fn(() => query),
  };
  vi.mocked(createAgenticScopedSupabaseClient).mockReturnValue({
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
  } as never);
}

describe('POST /api/agentic/catalog/search junction categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJunctionOnlyProduct();
  });

  it('keeps the canonical category path for a junction-only product', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/agentic/catalog/search', {
        body: JSON.stringify({ filters: { category: 'laptops' } }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products[0].url).toBe(
      'https://ogabassey.usebaci.com/laptops/thin-laptop'
    );
  });
});
