import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { enrichShippingAddressWithQuoteDestination } from './order-quote-destination';

function createSupabase(quote: unknown) {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: quote, error: null }),
    })),
  };
}

const shippingAddress = {
  address: '123 Queen Street West',
  city: 'Toronto',
  country: undefined,
  countryCode: undefined,
  postalCode: undefined,
  state: 'Ontario',
};
const checkoutPhoneItem = {
  condition: undefined,
  name: 'Phone',
  price: 100_000,
  productName: undefined,
  product_id: 'product-1',
  quantity: 1,
};

describe('enrichShippingAddressWithQuoteDestination', () => {
  it('persists international destination fields from the saved quote request', async () => {
    const result = await enrichShippingAddressWithQuoteDestination(
      createSupabase({
        provider_rate_id: 'GIGL_INTL_1_2_3_4',
        quote_request: {
          sessionId: 'session-1',
          shipmentType: 'international',
          receiver: {
            name: 'Jane Receiver',
            phone: '',
            address: '123 Queen Street West',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            countryCode: 'CA',
            postalCode: 'M5V 3L9',
          },
          items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
        },
      }) as unknown as SupabaseClient,
      'quote-1',
      shippingAddress
    );

    expect(result).toEqual({
      ...shippingAddress,
      country: 'Canada',
      countryCode: 'CA',
      postalCode: 'M5V 3L9',
    });
  });

  it('keeps the original address for non-international quotes', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase({
          provider_rate_id: 'gigl:service-centre:5',
          quote_request: null,
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress
      )
    ).resolves.toEqual(shippingAddress);
  });

  it('rejects saved international quote destinations that do not match checkout address', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase({
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
          quote_request: {
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              name: 'Jane Receiver',
              phone: '',
              address: '123 Queen Street West',
              city: 'Toronto',
              state: 'Ontario',
              country: 'United States',
              countryCode: 'US',
              postalCode: '10001',
            },
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
          },
        }) as unknown as SupabaseClient,
        'quote-1',
        {
          ...shippingAddress,
          country: 'Canada',
          countryCode: 'CA',
          postalCode: 'M5V 3L9',
        }
      )
    ).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_DESTINATION_MISMATCH',
      status: 400,
    });
  });

  it('rejects saved international quotes from another merchant before checkout', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase({
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
          quote_request: {
            merchantId: 'merchant-other',
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              name: 'Jane Receiver',
              phone: '',
              address: '123 Queen Street West',
              city: 'Toronto',
              state: 'Ontario',
              country: 'Canada',
              countryCode: 'CA',
            },
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
          },
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [checkoutPhoneItem],
          shippingFee: 10_000,
        }
      )
    ).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_MERCHANT_MISMATCH',
      status: 400,
    });
  });

  it('rejects saved international quotes that no longer match checkout items or price', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase({
          price: 10_000,
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
          quote_request: {
            merchantId: 'merchant-current',
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              name: 'Jane Receiver',
              phone: '',
              address: '123 Queen Street West',
              city: 'Toronto',
              state: 'Ontario',
              country: 'Canada',
              countryCode: 'CA',
            },
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
          },
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [{ ...checkoutPhoneItem, name: 'Laptop' }],
          shippingFee: 10_000,
        }
      )
    ).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
      status: 400,
    });
  });

  it('rejects saved international quotes when the checkout shipping fee changes', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase({
          price: 10_000,
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
          quote_request: {
            merchantId: 'merchant-current',
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              name: 'Jane Receiver',
              phone: '',
              address: '123 Queen Street West',
              city: 'Toronto',
              state: 'Ontario',
              country: 'Canada',
              countryCode: 'CA',
            },
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
          },
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [checkoutPhoneItem],
          shippingFee: 1,
        }
      )
    ).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
      status: 400,
    });
  });

  it('rejects changed checkout shipping fees when stored quote price is a string', async () => {
    await expect(
      enrichShippingAddressWithQuoteDestination(
        createSupabase({
          price: '10000',
          provider_rate_id: 'GIGL_INTL_1_2_3_4',
          quote_request: {
            merchantId: 'merchant-current',
            sessionId: 'session-1',
            shipmentType: 'international',
            receiver: {
              name: 'Jane Receiver',
              phone: '',
              address: '123 Queen Street West',
              city: 'Toronto',
              state: 'Ontario',
              country: 'Canada',
              countryCode: 'CA',
            },
            items: [{ name: 'Phone', quantity: 1, weight: 1, value: 100_000 }],
          },
        }) as unknown as SupabaseClient,
        'quote-1',
        shippingAddress,
        {
          merchantId: 'merchant-current',
          items: [checkoutPhoneItem],
          shippingFee: 1,
        }
      )
    ).rejects.toMatchObject({
      code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
      status: 400,
    });
  });
});
