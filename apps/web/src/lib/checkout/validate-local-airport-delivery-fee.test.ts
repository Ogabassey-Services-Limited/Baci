import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { LocalAirportDeliveryFeeMismatchError } from './local-airport-delivery-fee-mismatch-error';
import { validateLocalAirportDeliveryFee } from './validate-local-airport-delivery-fee';

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const GOFASTER_QUOTE_ID = '11111111-1111-4111-8111-111111111111';

function mockSupabase(quote: unknown, replay = false): SupabaseClient {
  const rpc = vi.fn((name: string) => {
    if (name === 'get_checkout_shipping_quote') {
      return Promise.resolve({ data: quote, error: null });
    }
    return Promise.resolve({ data: replay, error: null });
  });

  return { rpc } as unknown as SupabaseClient;
}

const validGoFasterQuote = {
  expires_at: '2099-01-01T00:00:00.000Z',
  price: 18_500,
  provider: 'GIGL',
  provider_rate_id: 'GIGL_30_0_1_0_1_4',
};

describe('validateLocalAirportDeliveryFee', () => {
  it('accepts a server-verified GIGL GoFaster airport quote at its stored price', async () => {
    const result = await validateLocalAirportDeliveryFee({
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      selectedQuoteId: GOFASTER_QUOTE_ID,
      shippingFee: 18_500,
      shippingProvider: 'GIGL',
      supabase: mockSupabase([validGoFasterQuote]),
    });

    expect(result).toEqual({
      isIdempotentLocalAirportReplay: false,
      localAirportShippingFee: null,
    });
  });

  it('allows a confirmed idempotent replay after the provider quote expires', async () => {
    const result = await validateLocalAirportDeliveryFee({
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      requestIdempotencyKey: 'airport-provider-retry-key',
      selectedQuoteId: GOFASTER_QUOTE_ID,
      shippingFee: 18_500,
      shippingProvider: 'GIGL',
      supabase: mockSupabase(
        [
          {
            ...validGoFasterQuote,
            expires_at: '2020-01-01T00:00:00.000Z',
          },
        ],
        true
      ),
    });

    expect(result).toEqual({
      isIdempotentLocalAirportReplay: true,
      localAirportShippingFee: null,
    });
  });

  it('rejects a selected road quote instead of bypassing the fixed airport fee', async () => {
    const promise = validateLocalAirportDeliveryFee({
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      selectedQuoteId: GOFASTER_QUOTE_ID,
      shippingFee: 12_000,
      shippingProvider: 'GIGL',
      supabase: mockSupabase([
        { ...validGoFasterQuote, provider_rate_id: 'GIGL_30_0_1_0_0_4' },
      ]),
    });

    await expect(promise).rejects.toMatchObject({
      code: 'AIRPORT_QUOTE_INVALID',
      status: 400,
    });
  });

  it('rejects a GIGL quote when the submitted provider is missing', async () => {
    const promise = validateLocalAirportDeliveryFee({
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      selectedQuoteId: GOFASTER_QUOTE_ID,
      shippingFee: 18_500,
      supabase: mockSupabase([validGoFasterQuote]),
    });

    await expect(promise).rejects.toMatchObject({
      code: 'AIRPORT_QUOTE_INVALID',
      status: 400,
    });
  });

  it('rejects a merchant-configured rate on the airport path', async () => {
    const promise = validateLocalAirportDeliveryFee({
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      shippingFee: 35_000,
      shippingRateId: '22222222-2222-4222-8222-222222222222',
      supabase: mockSupabase(null),
    });

    await expect(promise).rejects.toMatchObject({
      code: 'AIRPORT_QUOTE_INVALID',
      status: 400,
    });
  });

  it('rejects local airport delivery without a complete destination address', async () => {
    const promise = validateLocalAirportDeliveryFee({
      airportType: 'delivery',
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      shippingFee: 35_000,
      supabase: mockSupabase(null),
    });

    await expect(promise).rejects.toMatchObject({
      code: 'AIRPORT_ADDRESS_REQUIRED',
      status: 400,
    });
  });

  it('rejects a provider quote whose submitted fee differs from the stored price', async () => {
    const promise = validateLocalAirportDeliveryFee({
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      selectedQuoteId: GOFASTER_QUOTE_ID,
      shippingFee: 17_500,
      shippingProvider: 'GIGL',
      supabase: mockSupabase([validGoFasterQuote]),
    });

    await expect(promise).rejects.toBeInstanceOf(
      LocalAirportDeliveryFeeMismatchError
    );
  });

  it('allows a confirmed idempotent replay to keep the original local airport fee', async () => {
    const result = await validateLocalAirportDeliveryFee({
      airportType: 'delivery',
      deliveryMethod: 'airport',
      merchantId: MERCHANT_ID,
      requestIdempotencyKey: 'airport-retry-key',
      shippingAddress: {
        address: '12 Airport Road',
        city: 'Ikeja',
        state: 'Lagos',
      },
      shippingFee: 25_000,
      supabase: mockSupabase(null, true),
    });

    expect(result).toEqual({
      isIdempotentLocalAirportReplay: true,
      localAirportShippingFee: 35_000,
    });
  });

  it('does not infer airport delivery from a legacy fee on a metadata-free non-airport order', async () => {
    const supabase = mockSupabase(null);
    const result = await validateLocalAirportDeliveryFee({
      deliveryMethod: 'door',
      merchantId: MERCHANT_ID,
      shippingFee: 25_000,
      supabase,
    });

    expect(result).toEqual({
      isIdempotentLocalAirportReplay: false,
      localAirportShippingFee: null,
    });
  });

  it('rejects non-airport metadata that contradicts a legacy airport address marker', async () => {
    const promise = validateLocalAirportDeliveryFee({
      deliveryMethod: 'door',
      merchantId: MERCHANT_ID,
      shippingAddress: { address: 'Airport Delivery' },
      shippingFee: 0,
      supabase: mockSupabase(null),
    });

    await expect(promise).rejects.toMatchObject({
      code: 'DELIVERY_METADATA_MISMATCH',
      status: 400,
    });
  });

  it('rejects a new metadata-free request at the legacy airport delivery fee', async () => {
    const promise = validateLocalAirportDeliveryFee({
      merchantId: MERCHANT_ID,
      shippingAddress: { address: '12 Airport Road' },
      shippingFee: 25_000,
      supabase: mockSupabase(null),
    });

    await expect(promise).rejects.toMatchObject({
      code: 'DELIVERY_METADATA_REQUIRED',
      status: 400,
    });
  });

  it('allows a confirmed replay of a metadata-free legacy airport amount', async () => {
    const result = await validateLocalAirportDeliveryFee({
      merchantId: MERCHANT_ID,
      requestIdempotencyKey: 'legacy-airport-retry-key',
      shippingFee: 25_000,
      supabase: mockSupabase(null, true),
    });

    expect(result).toEqual({
      isIdempotentLocalAirportReplay: true,
      localAirportShippingFee: null,
    });
  });
});
