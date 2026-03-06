import { describe, expect, it } from 'vitest';
import {
  getRankedCustomerSearchTotalCount,
  mapRankedCustomerSearchRow,
} from './customer-search-results';

describe('mapRankedCustomerSearchRow', () => {
  it('splits full_name into first and last name parts for UI compatibility', () => {
    const customer = mapRankedCustomerSearchRow({
      id: 'cust_1',
      full_name: 'John Mduabuchukwu',
      email: 'john@example.com',
      phone: '08012345678',
      address: 'Lagos',
      total_orders: 3,
      total_spent: '25000',
      store_credit: '500',
      created_at: '2026-03-06T00:00:00.000Z',
      relevance: 912.5,
      total_count: 19,
    });

    expect(customer.first_name).toBe('John');
    expect(customer.last_name).toBe('Mduabuchukwu');
    expect(customer.total_spent).toBe(25000);
    expect(customer.store_credit).toBe(500);
  });

  it('handles single-name customers without inventing a last name', () => {
    const customer = mapRankedCustomerSearchRow({
      id: 'cust_2',
      full_name: 'Madonna',
      email: null,
      phone: null,
      address: null,
      total_orders: null,
      total_spent: null,
      store_credit: null,
      created_at: null,
      relevance: null,
      total_count: null,
    });

    expect(customer.first_name).toBe('Madonna');
    expect(customer.last_name).toBeNull();
    expect(customer.email).toBe('');
  });
});

describe('getRankedCustomerSearchTotalCount', () => {
  it('reads total_count from the first ranked row', () => {
    expect(
      getRankedCustomerSearchTotalCount([
        {
          id: 'cust_1',
          full_name: 'John',
          email: null,
          phone: null,
          address: null,
          total_orders: 1,
          total_spent: 0,
          store_credit: 0,
          created_at: '2026-03-06T00:00:00.000Z',
          relevance: 1,
          total_count: 42,
        },
      ])
    ).toBe(42);
  });

  it('returns zero for an empty result set', () => {
    expect(getRankedCustomerSearchTotalCount([])).toBe(0);
  });
});
