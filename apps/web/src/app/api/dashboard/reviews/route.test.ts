import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn().mockResolvedValue({
    merchantId: 'merchant-1',
    role: 'owner',
    permissions: {},
  }),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

function buildSupabase() {
  const selectCalls: Array<{ columns: string; options: unknown }> = [];
  const reviewsBuilder = {
    select: vi.fn((columns: string, options: unknown) => {
      selectCalls.push({ columns, options });
      return reviewsBuilder;
    }),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
    },
    from: vi.fn((table: string) => {
      if (table !== 'product_reviews') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return reviewsBuilder;
    }),
    _selectCalls: selectCalls,
  };
}

describe('GET /api/dashboard/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses an explicit dashboard review projection instead of selecting every column', async () => {
    const supabase = buildSupabase();
    vi.mocked(createClient).mockReturnValue(supabase as unknown as never);

    const response = await GET(
      new NextRequest('http://localhost/api/dashboard/reviews?status=all')
    );

    expect(response.status).toBe(200);
    expect(supabase._selectCalls).toHaveLength(1);
    expect(supabase._selectCalls[0]?.columns).toContain('customer_email');
    expect(supabase._selectCalls[0]?.columns).toContain('products:product_id');
    expect(supabase._selectCalls[0]?.columns).not.toMatch(
      /(^|[,\s])\*($|[,\s])/
    );
    expect(supabase._selectCalls[0]?.options).toEqual({ count: 'exact' });
  });
});
