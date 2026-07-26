import { describe, expect, it } from 'vitest';

import { getRecommendationsForTenant } from './chat-recommendation-tool-handlers';
import type { ChatToolTenantClient } from './chat-tool-result-types';

type QueryResult = { data: unknown; error?: unknown };

// Scoped client whose product query resolves `source` for the source-product
// lookup (maybeSingle) and `recs` for the recommendation list (awaited query).
function scopedClient(
  source: QueryResult,
  recs: QueryResult
): ChatToolTenantClient {
  const query = Object.assign(Promise.resolve(recs), {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    gt: vi.fn(() => query),
    lt: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(source)),
  });
  return {
    merchantId: 'merchant-1',
    supabase: { from: vi.fn(() => query) } as never,
  };
}

describe('chat recommendation tool handlers', () => {
  it('returns no recommendations when the scoped source product is missing', async () => {
    const scoped = scopedClient(
      { data: null, error: null },
      { data: [], error: null }
    );

    const result = await getRecommendationsForTenant(
      { productId: 'missing', type: 'upsell' },
      scoped
    );

    expect(result).toEqual([]);
  });

  it('maps recommendation rows into the product result shape (first image url)', async () => {
    const scoped = scopedClient(
      {
        data: {
          id: 'p1',
          name: 'Phone',
          price: 1000,
          category: 'Smartphones',
          brand: 'Acme',
        },
        error: null,
      },
      {
        data: [
          {
            id: 'p2',
            name: 'Case',
            price: 200,
            description: 'A case',
            brand: 'Acme',
            category: 'Accessories',
            images: [{ url: 'https://cdn/case.jpg' }],
            stock: 5,
            status: 'active',
          },
        ],
        error: null,
      }
    );

    const result = await getRecommendationsForTenant(
      { productId: 'p1', type: 'accessories' },
      scoped
    );

    expect(result).toEqual([
      {
        id: 'p2',
        name: 'Case',
        price: 200,
        description: 'A case',
        brand: 'Acme',
        category: 'Accessories',
        image_url: 'https://cdn/case.jpg',
        stock: 5,
        status: 'active',
      },
    ]);
  });
});
