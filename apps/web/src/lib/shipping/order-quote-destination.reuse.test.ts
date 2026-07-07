import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { enrichShippingAddressWithQuoteDestination } from './order-quote-destination';
import { createSupabaseRpcMock } from './test-helpers/create-supabase-rpc-mock';

const shippingAddress = {
  address: '123 Queen Street West',
  city: 'Toronto',
  country: 'Canada',
  countryCode: 'CA',
  postalCode: 'M5V 3L9',
  state: 'Ontario',
};

describe('enrichShippingAddressWithQuoteDestination reuse validation', () => {
  it('allows reused international order items to validate without a comparable price', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabaseRpcMock({
          price: 10_000,
          provider_rate_id: 'GIGL_INTL_1_2_3_1',
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
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [{ name: 'Phone', price: null, quantity: 1, weight: 1 }],
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

  it('allows saved quote physical metadata when product metadata is absent', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabaseRpcMock({
          price: 10_000,
          provider_rate_id: 'GIGL_INTL_1_2_3_1',
          quote_request: {
            merchantId: 'merchant-current',
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              ...shippingAddress,
              name: 'Jane Receiver',
              phone: '',
            },
            items: [
              {
                name: 'Phone',
                quantity: 1,
                weight: 5,
                value: 100_000,
                hsCode: '851712',
                length: 10,
                width: 8,
                height: 6,
              },
            ],
          },
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [{ name: 'Phone', quantity: 1, value: 100_000 }],
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
