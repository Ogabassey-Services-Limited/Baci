import { describe, expect, it } from 'vitest';
import type { NormalizedProductDetails } from '@/components/storefront/ogabassey/pages/product-details-page/product-normalization';
import {
  getAvailabilityConstraintsForAxis,
  pruneSelectionsByVariantAvailability,
} from './variant-selection-pruning';

const variants = [
  {
    id: 'v1',
    attributes: { storage: '256GB', color: 'Black' },
    condition: 'new' as const,
    price_modifier: 0,
    stock_quantity: 5,
  },
  {
    id: 'v2',
    attributes: { storage: '512GB', color: 'Black' },
    condition: 'new' as const,
    price_modifier: 0,
    stock_quantity: 3,
  },
  {
    id: 'v3',
    attributes: { storage: '256GB', color: 'Silver' },
    condition: 'new' as const,
    price_modifier: 0,
    stock_quantity: 2,
  },
] as NonNullable<NormalizedProductDetails['variants']>;

describe('pruneSelectionsByVariantAvailability', () => {
  it('keeps the changed axis and drops unreachable sibling selections', () => {
    const next = { storage: '512GB', color: 'Silver' };
    const result = pruneSelectionsByVariantAvailability(
      next,
      'storage',
      variants
    );

    expect(result).toEqual({ storage: '512GB' });
  });

  it('returns selections unchanged when no variants exist', () => {
    const next = { storage: '256GB', color: 'Silver' };
    expect(
      pruneSelectionsByVariantAvailability(next, 'storage', undefined)
    ).toEqual(next);
  });
});

describe('getAvailabilityConstraintsForAxis', () => {
  it('excludes the target axis and display-only metadata axes', () => {
    const selections = {
      storage: '256GB',
      color: 'Black',
      warranty: '12 months',
    };

    expect(
      getAvailabilityConstraintsForAxis(selections, 'color', variants)
    ).toEqual({ storage: '256GB' });
  });
});
