import { describe, expect, it } from 'vitest';
import type { QuizPrizeProduct } from '@/schemas/quiz-prize-product';
import {
  decodePrizeProductCursor,
  paginatePrizeProducts,
} from './prize-product-pagination';

function product(selectionId: string): QuizPrizeProduct {
  return {
    available: true,
    condition: 'new',
    defaultVariantId: null,
    effectiveStock: 1,
    hasVariants: true,
    id: '55555555-5555-4555-8555-555555555555',
    imageUrl: null,
    manageStock: true,
    name: 'Phone',
    price: 1,
    requiresVariantSelection: false,
    selectionId,
    variantId: '66666666-6666-4666-8666-666666666666',
    variantLabel: selectionId,
  };
}

describe('prize product pagination', () => {
  it('caps a variant-expanded page and resumes inside the same product', () => {
    const firstPage = paginatePrizeProducts({
      groups: [[product('a'), product('b')], [product('c')]],
      hasMoreCandidates: false,
      limit: 1,
      start: { productOffset: 0, variantOffset: 0 },
    });

    expect(firstPage.products.map(({ selectionId }) => selectionId)).toEqual([
      'a',
    ]);
    expect(decodePrizeProductCursor(firstPage.nextCursor ?? '')).toEqual({
      productOffset: 0,
      variantOffset: 1,
    });
  });

  it('moves to the next candidate after consuming a product boundary', () => {
    const page = paginatePrizeProducts({
      groups: [[product('b')], [product('c')]],
      hasMoreCandidates: false,
      limit: 1,
      start: { productOffset: 0, variantOffset: 1 },
    });

    expect(page.products.map(({ selectionId }) => selectionId)).toEqual(['c']);
    expect(page.nextCursor).toBeNull();
  });
});
