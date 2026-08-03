import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

import { handleAddToCart } from './chat-tool-product-handlers';

describe('chat-tool-product-handlers', () => {
  it('returns only an active product for an add-to-cart action', async () => {
    const query = Object.assign(
      Promise.resolve({
        data: {
          id: 'product-1',
          name: 'Winter Coat',
          price: 250,
          description: 'Warm coat',
          brand: 'North',
          category: 'Clothing',
          images: [],
          stock: 2,
          status: 'active',
        },
        error: null,
      }),
      {
        select: vi.fn(),
        eq: vi.fn(),
        single: vi.fn(),
      }
    );
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.single.mockResolvedValue(await query);
    mocks.createAgenticScopedSupabaseClient.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await handleAddToCart(
      { productId: 'product-1', quantity: 1 },
      { id: 'merchant-1', slug: 'winter-store', businessName: 'Winter Store' }
    );

    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(result).toMatchObject({
      id: 'product-1',
      name: 'Winter Coat',
      price: 250,
    });
  });
});
