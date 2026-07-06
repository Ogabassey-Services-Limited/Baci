import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { enrichShippingAddressWithQuoteDestination } from './order-quote-destination';

const shippingAddress = {
  address: '123 Queen Street West',
  city: 'Toronto',
  country: 'Canada',
  countryCode: 'CA',
  postalCode: 'M5V 3L9',
  state: 'Ontario',
};

function createSupabase() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          price: 10_000,
          provider: 'GIGL',
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
          quote_request: {
            merchantId: 'merchant-current',
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              ...shippingAddress,
              name: 'Jane Receiver',
              phone: '',
            },
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
          },
        },
        error: null,
      }),
    })),
  };
}

describe('enrichShippingAddressWithQuoteDestination reuse validation', () => {
  it('allows reused international order items to validate without a comparable price', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase() as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [{ name: 'Phone', price: null, quantity: 1 }],
          shippingFee: 10_000,
          shippingProvider: 'GIGL',
        }
      )
    ).resolves.toMatchObject({
      country: 'Canada',
      countryCode: 'CA',
      postalCode: 'M5V 3L9',
    });
  });
});
