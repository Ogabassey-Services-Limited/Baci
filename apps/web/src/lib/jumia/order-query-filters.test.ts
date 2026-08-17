import { describe, expect, it } from 'vitest';
import { getJumiaOrderQueryFilters } from './order-query-filters';

describe('getJumiaOrderQueryFilters', () => {
  it('omits country and shop filters for shared OAuth integrations', () => {
    expect(
      getJumiaOrderQueryFilters({
        shopId: 'oauth',
        countryCode: 'NG',
      })
    ).toEqual({});
  });

  it('passes ISO country codes for self-authorized integrations', () => {
    expect(
      getJumiaOrderQueryFilters({
        shopId: 'shop-1',
        countryCode: 'NG',
      })
    ).toEqual({
      country: 'NG',
      shopId: 'shop-1',
    });
  });
});
