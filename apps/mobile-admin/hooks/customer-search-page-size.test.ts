import { describe, expect, it } from 'vitest';
import { getCustomerPageSize } from './customer-search-page-size';

describe('getCustomerPageSize', () => {
  it('uses the default page size when no search term is provided', () => {
    expect(getCustomerPageSize()).toBe(20);
    expect(getCustomerPageSize('   ')).toBe(20);
  });

  it('uses a larger page size for customer search results', () => {
    expect(getCustomerPageSize('john')).toBe(25);
    expect(getCustomerPageSize(' madu ')).toBe(25);
  });
});
