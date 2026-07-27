import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateTextWithChain: vi.fn() }));

vi.mock('@/ai/generate-text-with-chain', () => ({
  generateTextWithChain: mocks.generateTextWithChain,
}));

import { generateSEOSuggestionsForMerchant } from './generate-seo-suggestions';

function createSupabase(products: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    data: products,
    error: null,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  return { supabase: { from: vi.fn(() => query) } as never, query };
}

describe('generateSEOSuggestionsForMerchant', () => {
  it('parses a fenced AI response and preserves the source product metadata', async () => {
    mocks.generateTextWithChain.mockResolvedValue({
      text: '```json\n{"meta_title":"Premium Leather Tote Bag for Nigeria","meta_description":"Shop this premium leather tote bag with trusted delivery throughout Nigeria. Order now for a durable, elegant work and travel essential.","keywords":["leather tote","bags nigeria","premium bag"],"focus_keyword":"leather tote"}\n```',
    });
    const { supabase, query } = createSupabase([
      {
        id: 'product-1',
        name: 'Leather Tote Bag',
        description: 'A leather tote for everyday use.',
        category: 'Bags',
        brand: 'Baci',
        price: 25000,
        meta_title: null,
        meta_description: null,
        keywords: [],
      },
    ]);

    const result = await generateSEOSuggestionsForMerchant(
      supabase,
      'merchant-1',
      ['product-1']
    );

    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.in).toHaveBeenCalledWith('id', ['product-1']);
    expect(result[0]).toMatchObject({
      productId: 'product-1',
      productName: 'Leather Tote Bag',
      optimized: { focus_keyword: 'leather tote' },
    });
  });
});
