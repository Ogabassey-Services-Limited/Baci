import { QueryClient } from '@tanstack/react-query';
import { getCachedProductStock } from './cart-query-cache';

describe('cart query cache helpers', () => {
  it('returns the cached stock quantity for a product', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['products', 'featured'], [
      { id: 'product-1', stock_quantity: 4 },
      { id: 'product-2', stock_quantity: 9 },
    ]);

    expect(getCachedProductStock(queryClient, 'product-2')).toBe(9);
  });

  it('returns undefined when cached products are missing', () => {
    const queryClient = new QueryClient();

    expect(getCachedProductStock(queryClient, 'product-2')).toBeUndefined();
  });
});
