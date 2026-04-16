import { describe, expect, it } from 'vitest';
import {
  getNormalizedStorefrontConditions,
  getStorefrontConditionBadgeLabel,
  matchesStorefrontBrandFilter,
  matchesStorefrontCategoryFilter,
  matchesStorefrontConditionFilter,
} from './storefront-product-filters';

describe('storefront-product-filters', () => {
  it('derives normalized conditions from available_conditions first', () => {
    expect(
      getNormalizedStorefrontConditions({
        available_conditions: [' New ', 'uk_used', 'refurbished'],
        condition: 'new',
      })
    ).toEqual(['new', 'used', 'open_box']);
  });

  it('falls back to legacy condition offers when explicit conditions are absent', () => {
    expect(
      getNormalizedStorefrontConditions({
        has_condition_offers: true,
      })
    ).toEqual(['new', 'used']);
  });

  it('returns a multi-condition badge label when the family spans more than new and used', () => {
    expect(
      getStorefrontConditionBadgeLabel({
        available_conditions: ['new', 'open_box'],
      })
    ).toBe('Multiple Conditions');
  });

  it('matches condition filters against normalized available conditions', () => {
    expect(
      matchesStorefrontConditionFilter(
        {
          available_conditions: ['new', 'refurbished'],
          condition: 'new',
        },
        'Open Box'
      )
    ).toBe(true);

    expect(
      matchesStorefrontConditionFilter(
        {
          available_conditions: ['new'],
          condition: 'new',
        },
        'Used'
      )
    ).toBe(false);
  });

  it('matches category filters against both category names and slugs', () => {
    expect(
      matchesStorefrontCategoryFilter(
        {
          category: 'Smart TVs',
          category_slug: 'smart-tvs',
        },
        'smart-tvs'
      )
    ).toBe(true);

    expect(
      matchesStorefrontCategoryFilter(
        {
          categories: [{ name: 'Smart TVs', slug: 'smart-tvs' }],
        },
        'Smart TVs'
      )
    ).toBe(true);
  });

  it('matches brand filters case-insensitively', () => {
    expect(
      matchesStorefrontBrandFilter(
        {
          brand: 'Sony',
        },
        'sony'
      )
    ).toBe(true);
  });
});
