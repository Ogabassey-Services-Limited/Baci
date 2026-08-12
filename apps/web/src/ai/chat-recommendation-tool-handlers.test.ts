import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createScoped: vi.fn(),
}));

vi.mock('@/lib/agentic/agentic-scoped-chat-client', () => ({
  createAgenticScopedChatClient: mocks.createScoped,
}));

import { handleGetRecommendations } from './chat-recommendation-tool-handlers';

type QueryResult = { data: unknown; error?: unknown };

// Scoped client whose product query resolves `source` for the source-product
// lookup (maybeSingle) and `recs` for the recommendation list (awaited query).
function scopedClient(source: QueryResult, recs: QueryResult) {
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
    supabase: { from: vi.fn(() => query) },
  };
}

describe('chat recommendation tool handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed with an empty list when the copilot tenant is unresolvable', async () => {
    mocks.createScoped.mockResolvedValue(null);

    const result = await handleGetRecommendations({
      productId: 'p1',
      type: 'upsell',
    });

    expect(result).toEqual([]);
  });

  it('returns no recommendations when the scoped source product is missing', async () => {
    mocks.createScoped.mockResolvedValue(
      scopedClient({ data: null, error: null }, { data: [], error: null })
    );

    const result = await handleGetRecommendations({
      productId: 'missing',
      type: 'upsell',
    });

    expect(result).toEqual([]);
  });

  it('maps recommendation rows into the product result shape (first image url)', async () => {
    mocks.createScoped.mockResolvedValue(
      scopedClient(
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
      )
    );

    const result = await handleGetRecommendations({
      productId: 'p1',
      type: 'accessories',
    });

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
