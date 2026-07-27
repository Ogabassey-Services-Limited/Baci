import { describe, expect, it } from 'vitest';
import { createAutocompleteSupabase } from './storefront-search-autocomplete.test-support';

describe('createAutocompleteSupabase', () => {
  it('provides typed RPC and product-query test doubles', async () => {
    const supabase = createAutocompleteSupabase();
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    await expect(supabase.rpc('search_products_v2', {})).resolves.toEqual({
      data: [],
      error: null,
    });
    await expect(
      Promise.resolve(supabase.from().select())
    ).resolves.toMatchObject({
      data: [{ id: 'product-1', name: 'iPhone 16 Pro' }],
      error: null,
    });
  });
});
