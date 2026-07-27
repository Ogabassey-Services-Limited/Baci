import { vi } from 'vitest';
import type { AutocompleteSupabase } from './storefront-search-autocomplete';

export type RankedRpcResult = {
  data: Array<{ product_id: string; total_count: number }> | null;
  error: Error | null;
};

type ProductQuery = PromiseLike<{
  data: Array<{
    id: string;
    name: string;
    category: string | null;
    price: number;
    images: string[];
    slug: string;
  }>;
  error: null;
}> & {
  in: (column: string, values: string[]) => ProductQuery;
  eq: (column: string, value: string) => ProductQuery;
};

export function createAutocompleteSupabase() {
  const query: ProductQuery = {
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock mirrors Supabase query builders
    then: (onFulfilled, onRejected) =>
      Promise.resolve({
        data: [
          {
            id: 'product-1',
            name: 'iPhone 16 Pro',
            category: 'Phones',
            price: 1_200_000,
            images: ['https://cdn.example.com/iphone.jpg'],
            slug: 'iphone-16-pro',
          },
        ],
        error: null,
      }).then(onFulfilled, onRejected),
  };

  return {
    from: vi.fn(() => ({ select: vi.fn(() => query) })),
    rpc: vi.fn<
      (fn: string, args: Record<string, unknown>) => Promise<RankedRpcResult>
    >(),
  } satisfies AutocompleteSupabase;
}
