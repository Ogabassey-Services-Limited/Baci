import { QueryClient } from '@tanstack/react-query';
import { getCachedProductStock } from './cart-query-cache';

describe('cart query cache helpers', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  afterEach(() => {
    // TanStack Query schedules cache GC timers; clear them so Jest can exit.
    queryClient.clear();
  });

  it('returns the cached stock quantity for a product', () => {
    queryClient.setQueryData(
      ['products', 'featured'],
      [
        { id: 'product-1', stock_quantity: 4 },
        { id: 'product-2', stock_quantity: 9 },
      ]
    );

    expect(getCachedProductStock(queryClient, 'product-2')).toBe(9);
  });

  it('returns undefined when cached products are missing', () => {
    expect(getCachedProductStock(queryClient, 'product-2')).toBeUndefined();
  });

  it('returns undefined when the cached products do not include the product', () => {
    queryClient.setQueryData(
      ['products', 'featured'],
      [{ id: 'product-1', stock_quantity: 4 }]
    );

    expect(getCachedProductStock(queryClient, 'product-999')).toBeUndefined();
  });
});
