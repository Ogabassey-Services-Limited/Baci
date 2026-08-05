import { describe, expect, it } from 'vitest';
import {
  quizPrizeProductSchema,
  quizPrizeProductSearchQuerySchema,
  quizPrizeProductsResponseSchema,
} from './quiz-prize-product';

const PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const VARIANT_ID = '66666666-6666-4666-8666-666666666666';

describe('quiz prize product schemas', () => {
  it('normalizes a bounded search page', () => {
    expect(
      quizPrizeProductSearchQuerySchema.parse({
        cursor: '24',
        limit: '12',
        search: '  Galaxy  ',
      })
    ).toEqual({ cursor: '24', limit: 12, search: 'Galaxy' });
  });

  it('rejects ambiguous and unbounded pagination', () => {
    expect(
      quizPrizeProductSearchQuerySchema.safeParse({
        cursor: '12',
        offset: '12',
      }).success
    ).toBe(false);
    expect(
      quizPrizeProductSearchQuerySchema.safeParse({ limit: '101' }).success
    ).toBe(false);
    expect(
      quizPrizeProductSearchQuerySchema.safeParse({ cursor: 'opaque' }).success
    ).toBe(false);
    expect(
      quizPrizeProductSearchQuerySchema.safeParse({ cursor: '1000001' }).success
    ).toBe(true);
    expect(
      quizPrizeProductSearchQuerySchema.safeParse({ cursor: '-1' }).success
    ).toBe(false);
    expect(
      quizPrizeProductSearchQuerySchema.safeParse({ cursor: '1.5' }).success
    ).toBe(false);
  });

  it('requires exact variant, condition, image, and inventory projection', () => {
    expect(
      quizPrizeProductSchema.parse({
        available: true,
        condition: 'open_box',
        defaultVariantId: VARIANT_ID,
        effectiveStock: 3,
        hasVariants: true,
        id: PRODUCT_ID,
        imageUrl: 'https://cdn.example.com/galaxy-blue.png',
        manageStock: true,
        name: 'Samsung Galaxy S25',
        price: 1_800_000,
        requiresVariantSelection: false,
        selectionId: `${PRODUCT_ID}:${VARIANT_ID}`,
        variantId: VARIANT_ID,
        variantLabel: '256GB / Blue',
      })
    ).toMatchObject({ variantId: VARIANT_ID, condition: 'open_box' });
  });

  it('rejects a malformed response instead of accepting partial stock data', () => {
    expect(
      quizPrizeProductsResponseSchema.safeParse({
        nextCursor: null,
        products: [{ id: PRODUCT_ID, name: 'Incomplete product' }],
        total: 1,
      }).success
    ).toBe(false);
  });
});
