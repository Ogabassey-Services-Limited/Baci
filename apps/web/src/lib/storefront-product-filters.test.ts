import { describe, expect, it } from 'vitest';
import { storefrontProductFilters } from './storefront-product-filters';

describe('storefront-product-filters', () => {
  it('derives normalized conditions from available_conditions first', () => {
    expect(
      storefrontProductFilters.getNormalizedStorefrontConditions({
        available_conditions: [' New ', 'uk_used', 'refurbished'],
        condition: 'new',
      })
    ).toEqual(['new', 'used', 'open_box']);
  });

  it('falls back to legacy condition offers when explicit conditions are absent', () => {
    expect(
      storefrontProductFilters.getNormalizedStorefrontConditions({
        has_condition_offers: true,
      })
    ).toEqual(['new', 'used']);
  });

  it('merges an explicit condition with legacy offer inference when available conditions are absent', () => {
    expect(
      storefrontProductFilters.getNormalizedStorefrontConditions({
        condition: 'open_box',
        has_condition_offers: true,
      })
    ).toEqual(['new', 'used', 'open_box']);
  });

  it('does not broaden explicit available conditions just because legacy offers exist', () => {
    expect(
      storefrontProductFilters.getNormalizedStorefrontConditions({
        available_conditions: ['open_box'],
        has_condition_offers: true,
        condition: 'new',
      })
    ).toEqual(['open_box']);
  });

  it('filters invalid available_conditions entries while preserving valid strings', () => {
    expect(
      storefrontProductFilters.getNormalizedStorefrontConditions({
        available_conditions: [42, null, ' new '],
      })
    ).toEqual(['new']);
  });

  it('returns a multi-condition badge label when the family spans more than new and used', () => {
    expect(
      storefrontProductFilters.getStorefrontConditionBadgeLabel({
        available_conditions: ['new', 'open_box'],
      })
    ).toBe('Multiple Conditions');
  });

  it('returns a new-and-used badge label when those are the only normalized conditions', () => {
    expect(
      storefrontProductFilters.getStorefrontConditionBadgeLabel({
        available_conditions: ['new', 'used'],
      })
    ).toBe('New & Used');
  });

  it('returns undefined when there is no condition data', () => {
    expect(
      storefrontProductFilters.getStorefrontConditionBadgeLabel({})
    ).toBeUndefined();
  });

  it('matches condition filters against normalized available conditions', () => {
    expect(
      storefrontProductFilters.matchesStorefrontConditionFilter(
        {
          available_conditions: ['new', 'refurbished'],
          condition: 'new',
        },
        'Open Box'
      )
    ).toBe(true);

    expect(
      storefrontProductFilters.matchesStorefrontConditionFilter(
        {
          available_conditions: ['new'],
          condition: 'new',
        },
        'Used'
      )
    ).toBe(false);
  });

  it('treats all as a pass-through condition filter and rejects invalid condition filters', () => {
    expect(
      storefrontProductFilters.matchesStorefrontConditionFilter(
        {
          available_conditions: ['new'],
        },
        'All'
      )
    ).toBe(true);

    expect(
      storefrontProductFilters.matchesStorefrontConditionFilter(
        {
          available_conditions: ['new'],
        },
        'all'
      )
    ).toBe(true);

    expect(
      storefrontProductFilters.matchesStorefrontConditionFilter(
        {
          available_conditions: ['new'],
        },
        'not-a-condition'
      )
    ).toBe(false);
  });

  it('matches category filters against both category names and slugs', () => {
    expect(
      storefrontProductFilters.matchesStorefrontCategoryFilter(
        {
          category: 'Smart TVs',
          category_slug: 'smart-tvs',
        },
        'smart-tvs'
      )
    ).toBe(true);

    expect(
      storefrontProductFilters.matchesStorefrontCategoryFilter(
        {
          categories: [{ name: 'Smart TVs', slug: 'smart-tvs' }],
        },
        'Smart TVs'
      )
    ).toBe(true);
  });

  it('matches brand filters case-insensitively', () => {
    expect(
      storefrontProductFilters.matchesStorefrontBrandFilter(
        {
          brand: 'Sony',
        },
        'sony'
      )
    ).toBe(true);
  });

  it('matches brand filters across slug and display-form brand values', () => {
    expect(
      storefrontProductFilters.matchesStorefrontBrandFilter(
        {
          brand: 'Sony Ericsson',
        },
        'sony-ericsson'
      )
    ).toBe(true);
  });

  it('treats all as a pass-through brand filter and rejects missing brands for specific selections', () => {
    expect(
      storefrontProductFilters.matchesStorefrontBrandFilter(
        {
          brand: 'Sony',
        },
        'All'
      )
    ).toBe(true);

    expect(
      storefrontProductFilters.matchesStorefrontBrandFilter(
        {
          brand: 'Sony',
        },
        'all'
      )
    ).toBe(true);

    expect(
      storefrontProductFilters.matchesStorefrontBrandFilter(
        {
          brand: undefined,
        },
        'sony'
      )
    ).toBe(false);
  });

  it('treats all as a pass-through category filter', () => {
    expect(
      storefrontProductFilters.matchesStorefrontCategoryFilter(
        {
          category: 'Smart TVs',
          category_slug: 'smart-tvs',
        },
        'all'
      )
    ).toBe(true);
  });
});
