import {
  filterOrdersBySearchQuery,
  matchesOrderListSearchQuery,
  type OrderListSearchOrderLike,
} from './order-list-search';

function buildOrder(
  overrides: Partial<OrderListSearchOrderLike> = {}
): OrderListSearchOrderLike {
  return {
    order_number: 'BA-2026-001',
    shipping_status: 'shipped',
    items: [{ product_name: 'iPhone 11 Pro Max' }],
    ...overrides,
  };
}

describe('matchesOrderListSearchQuery', () => {
  it('matches by order number', () => {
    const order = buildOrder();
    expect(matchesOrderListSearchQuery(order, '2026-001')).toBe(true);
  });

  it('matches by mapped status label', () => {
    const order = buildOrder({ shipping_status: 'pending' });
    expect(matchesOrderListSearchQuery(order, 'order placed')).toBe(true);
  });

  it('matches by product name', () => {
    const order = buildOrder();
    expect(matchesOrderListSearchQuery(order, 'iphone')).toBe(true);
  });

  it('returns false when query does not match order number, status, or items', () => {
    const order = buildOrder();
    expect(matchesOrderListSearchQuery(order, 'playstation')).toBe(false);
  });

  it('returns true for empty query after trimming whitespace', () => {
    const order = buildOrder();
    expect(matchesOrderListSearchQuery(order, '   ')).toBe(true);
  });
});

describe('filterOrdersBySearchQuery', () => {
  it('returns filtered orders when query is present', () => {
    const orders = [
      buildOrder({ order_number: 'A-1', items: [{ product_name: 'iPhone' }] }),
      buildOrder({
        order_number: 'B-1',
        shipping_status: 'delivered',
        items: [{ product_name: 'PlayStation' }],
      }),
    ];

    expect(filterOrdersBySearchQuery(orders, 'playstation')).toEqual([orders[1]]);
  });

  it('returns original array when query is empty', () => {
    const orders = [buildOrder(), buildOrder({ order_number: 'BA-2026-002' })];
    expect(filterOrdersBySearchQuery(orders, '')).toEqual(orders);
  });
});
