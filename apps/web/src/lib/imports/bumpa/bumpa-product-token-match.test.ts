import { describe, expect, it } from 'vitest';
import type { ExistingImportedProduct } from '@/lib/imports/bumpa/bumpa-types';
import {
  type BumpaTokenMatchCandidate,
  scoreBumpaProductTokenMatch,
} from './bumpa-product-token-match';

function candidate(tokens: string[]): BumpaTokenMatchCandidate {
  return {
    product: {
      condition: null,
      externalId: null,
      externalSource: null,
      id: 'product-1',
      name: 'Product',
      price: null,
      sku: null,
      status: 'active',
    } satisfies ExistingImportedProduct,
    tokens: new Set(tokens),
  };
}

describe('scoreBumpaProductTokenMatch', () => {
  it('scores high-coverage token matches with active product weight', () => {
    const score = scoreBumpaProductTokenMatch(
      new Set(['samsung', 'galaxy', 'fold', '5', '512gb']),
      candidate(['samsung', 'galaxy', 'fold', '5', '512gb'])
    );

    expect(score).toBeGreaterThan(6);
  });

  it('rejects candidates with conflicting model identifiers', () => {
    const score = scoreBumpaProductTokenMatch(
      new Set(['hp', 'elitebook', '840', 'g5', '8gb', '256gb']),
      candidate(['hp', 'elitebook', '840', 'g6', '8gb', '256gb'])
    );

    expect(score).toBe(0);
  });

  it('rejects accessory-only candidate additions', () => {
    const score = scoreBumpaProductTokenMatch(
      new Set(['samsung', 'galaxy', 's22', 'ultra', '256gb']),
      candidate(['samsung', 'galaxy', 's22', 'ultra', '256gb', 'case'])
    );

    expect(score).toBe(0);
  });
});
