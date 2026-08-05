import { describe, expect, it, vi } from 'vitest';
import { resolveQuizPrizeSelection } from './quiz-prize-selection';

function input(overrides: Record<string, unknown> = {}) {
  return {
    difficulty: 'standard' as const,
    maxAttempts: 10,
    mode: 'test' as const,
    prizeCondition: 'new',
    prizeEffectiveStock: 2,
    prizeImageUrl: 'https://cdn/p.png',
    prizeProductId: '55555555-5555-4555-8555-555555555555',
    questionCountPerTopic: 1,
    timeLimitSeconds: 10,
    title: 'Phone Quiz',
    topics: ['Phones'],
    variantsPerQuestion: 1,
    ...overrides,
  };
}

describe('resolveQuizPrizeSelection', () => {
  it('revalidates ownership, stock, condition, and image snapshots', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        condition: 'new',
        default_variant_id: null,
        has_variants: false,
        id: input().prizeProductId,
        images: ['https://cdn/p.png'],
        manage_stock: true,
        merchant_id: 'merchant-1',
        name: 'Phone',
        stock: 2,
        stock_quantity: 2,
      },
      error: null,
    });
    const builder = {
      eq: vi.fn(() => builder),
      maybeSingle,
      select: vi.fn(() => builder),
    };
    const result = await resolveQuizPrizeSelection(
      { from: vi.fn(() => builder) } as never,
      'merchant-1',
      input()
    );
    expect(result).toMatchObject({
      condition: 'new',
      name: 'Phone',
      variantId: null,
    });
  });

  it('rejects a stale stock snapshot', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        condition: 'new',
        has_variants: false,
        id: input().prizeProductId,
        images: ['https://cdn/p.png'],
        manage_stock: true,
        merchant_id: 'merchant-1',
        name: 'Phone',
        stock: 1,
        stock_quantity: 1,
      },
      error: null,
    });
    const builder = {
      eq: vi.fn(() => builder),
      maybeSingle,
      select: vi.fn(() => builder),
    };
    await expect(
      resolveQuizPrizeSelection(
        { from: vi.fn(() => builder) } as never,
        'merchant-1',
        input()
      )
    ).resolves.toBeNull();
  });
});
