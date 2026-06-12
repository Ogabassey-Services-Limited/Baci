import { describe, expect, it } from 'vitest';
import {
  isStorePoliciesInputValid,
  parseCatalogSearchInput,
  parseProductIdInput,
} from './webmcp-storefront-tools-parsers';

describe('webmcp-storefront-tools-parsers', () => {
  it('normalizes catalog search input defensively', () => {
    expect(
      parseCatalogSearchInput({
        brand: ' Apple ',
        category: ' Phones ',
        limit: 5,
        query: ' iphone ',
        sort: 'price-desc',
      })
    ).toEqual({
      brand: 'Apple',
      category: 'Phones',
      limit: 5,
      query: 'iphone',
      sort: 'price-desc',
    });

    expect(parseCatalogSearchInput({ limit: 500, sort: 'unsafe' })).toEqual({
      brand: undefined,
      category: undefined,
      limit: undefined,
      query: undefined,
      sort: undefined,
    });
  });

  it('validates product lookup and policy inputs', () => {
    expect(parseProductIdInput({ product_id: ' product-1 ' })).toEqual({
      ok: true,
      productId: 'product-1',
    });
    expect(parseProductIdInput({})).toEqual({
      ok: false,
      error: 'product_id is required',
    });
    expect(parseProductIdInput({ product_id: ' ' })).toEqual({
      ok: false,
      error: 'Invalid product_id',
    });

    expect(isStorePoliciesInputValid(undefined)).toBe(true);
    expect(isStorePoliciesInputValid({})).toBe(true);
    expect(isStorePoliciesInputValid([])).toBe(false);
  });
});
