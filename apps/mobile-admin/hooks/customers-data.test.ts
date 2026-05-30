import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCustomers, fetchCustomerStats } from './customers-data';

const mocks = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; args: unknown[] }>,
  nextCount: 3,
}));

vi.mock('@baci/shared', () => ({
  buildCustomerSearchFilter: (term: string) => `search.${term}`,
  CUSTOMER_ADMIN_COLUMNS: 'id, merchant_id, full_name',
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeSearchQuery: (value: string) => value.trim(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        eq: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.eq` });
          return query;
        },
        gte: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.gte` });
          return query;
        },
        gt: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.gt` });
          return query;
        },
        is: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.is` });
          return query;
        },
        or: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.or` });
          return query;
        },
        order: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.order` });
          return query;
        },
        range: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.range` });
          return query;
        },
        select: (...args: unknown[]) => {
          mocks.calls.push({ args, method: `${table}.select` });
          return query;
        },
        then: (resolve: (value: unknown) => void) => {
          resolve({
            count: mocks.nextCount,
            data: [{ full_name: 'Ada Customer', id: 'customer-1' }],
            error: null,
          });
        },
      };
      return query;
    },
  },
}));

describe('customers-data', () => {
  beforeEach(() => {
    mocks.calls = [];
    mocks.nextCount = 3;
  });

  it('fetches paged customers with search, sort, and next cursor', async () => {
    mocks.nextCount = 25;

    const result = await fetchCustomers('merchant-1', 0, {
      search: ' Ada ',
      sortBy: 'orders',
    });

    expect(result.nextCursor).toBe(20);
    expect(mocks.calls).toContainEqual({
      args: ['total_orders', { ascending: false }],
      method: 'customers.order',
    });
    expect(mocks.calls).toContainEqual({
      args: ['search.Ada'],
      method: 'customers.or',
    });
  });

  it('builds customer stats with retention rate', async () => {
    mocks.nextCount = 10;

    const result = await fetchCustomerStats('merchant-1');

    expect(result.total).toBe(10);
    expect(result.retentionRate).toBe(100);
    expect(mocks.calls).toContainEqual({
      args: ['merchant_id', 'merchant-1'],
      method: 'customers.eq',
    });
  });
});
