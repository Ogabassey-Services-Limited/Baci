import { describe, expect, it, vi } from 'vitest';
import type { ChatToolSupabaseClient } from './chat-tool-handlers';

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
    const supabase = {
      from: vi.fn(() => query),
      rpc: vi.fn(),
    } as unknown as ChatToolSupabaseClient;

    const result = await handleAddToCart(
      { productId: 'product-1', quantity: 1 },
      { id: 'merchant-1', slug: 'winter-store', businessName: 'Winter Store' },
      supabase
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
