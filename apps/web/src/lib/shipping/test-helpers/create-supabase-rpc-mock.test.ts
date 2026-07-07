import { describe, expect, it } from 'vitest';
import { createSupabaseRpcMock } from './create-supabase-rpc-mock';

describe('createSupabaseRpcMock', () => {
  it('wraps a quote record with the default provider and fresh expiry', async () => {
    const supabase = createSupabaseRpcMock({ id: 'quote-1', price: 1000 });

    const result = await supabase.rpc('get_checkout_shipping_quote');

    expect(result).toEqual({
      data: [
        expect.objectContaining({
          expires_at: expect.any(String),
          id: 'quote-1',
          price: 1000,
          provider: 'GIGL',
        }),
      ],
      error: null,
    });
  });

  it('returns an empty result when no quote is provided', async () => {
    const supabase = createSupabaseRpcMock(null);

    await expect(supabase.rpc('get_checkout_shipping_quote')).resolves.toEqual({
      data: [],
      error: null,
    });
  });
});
