import {
  buildOrderListFilters,
  matchesOrderListFilter,
} from './order-list-filters';

describe('order list filters', () => {
  const orders = [
    { shipping_status: 'pending' },
    { shipping_status: 'confirmed' },
    { shipping_status: 'delivered' },
    { shipping_status: 'cancelled' },
    { shipping_status: 'returned' },
  ];

  it('matches active orders correctly', () => {
    expect(matchesOrderListFilter({ shipping_status: 'pending' }, 'active')).toBe(
      true
    );
    expect(
      matchesOrderListFilter({ shipping_status: 'delivered' }, 'active')
    ).toBe(false);
  });

  it('matches closed orders correctly', () => {
    expect(
      matchesOrderListFilter({ shipping_status: 'cancelled' }, 'closed')
    ).toBe(true);
    expect(
      matchesOrderListFilter({ shipping_status: 'returned' }, 'closed')
    ).toBe(true);
  });

  it('builds filter counts from the order collection', () => {
    expect(buildOrderListFilters(orders)).toEqual([
      { key: 'all', label: 'All', count: 5 },
      { key: 'active', label: 'Active', count: 2 },
      { key: 'delivered', label: 'Delivered', count: 1 },
      { key: 'closed', label: 'Closed', count: 2 },
    ]);
  });
});
