import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  hasExistingMerchantRateOrder,
  prepareCheckoutIdempotencyReplay,
} from './checkout-idempotency-replay';
import {
  buildOrderIdempotencyPayload,
  hashOrderIdempotencyPayload,
} from './order-idempotency';
import { buildLegacyOrderIdempotencyPayload } from './order-idempotency-legacy';

const basePayload = {
  customer_email: 'buyer@example.com',
  customer_name: 'Buyer',
  delivery_method: 'airport' as const,
  airport_type: 'delivery' as const,
  items: [{ price: 1000, quantity: 1 }],
  merchant_id: '11111111-1111-1111-1111-111111111111',
};

function rpcClient(data: unknown, error: unknown = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  } as unknown as SupabaseClient;
}

function adminClient(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const byKey = vi.fn().mockReturnValue({ maybeSingle });
  const byMerchant = vi.fn().mockReturnValue({ eq: byKey });
  const select = vi.fn().mockReturnValue({ eq: byMerchant });
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    byMerchant,
    byKey,
    maybeSingle,
  };
}

describe('hasExistingMerchantRateOrder', () => {
  it('returns true when the merchant-scoped idempotency row exists', async () => {
    const client = adminClient({ id: 'order-1' });

    await expect(
      hasExistingMerchantRateOrder({
        adminSupabase: client.client,
        merchantId: basePayload.merchant_id,
        requestIdempotencyKey: 'checkout-1',
        shippingRateId: 'rate-1',
      })
    ).resolves.toBe(true);
    expect(client.from).toHaveBeenCalledWith('orders');
    expect(client.select).toHaveBeenCalledWith('id');
  });

  it('falls back to current rate verification when the lookup fails', async () => {
    const client = adminClient(null, new Error('database unavailable'));

    await expect(
      hasExistingMerchantRateOrder({
        adminSupabase: client.client,
        merchantId: basePayload.merchant_id,
        requestIdempotencyKey: 'checkout-1',
        shippingRateId: 'rate-1',
      })
    ).resolves.toBe(false);
  });
});

describe('prepareCheckoutIdempotencyReplay', () => {
  it('uses the current hash when the legacy probe fails', async () => {
    const supabase = rpcClient(false, new Error('probe unavailable'));
    const expectedHash = hashOrderIdempotencyPayload(
      buildOrderIdempotencyPayload(basePayload)
    );

    await expect(
      prepareCheckoutIdempotencyReplay({
        ...basePayload,
        canonicalAirportType: basePayload.airport_type,
        canonicalDeliveryMethod: basePayload.delivery_method,
        merchantId: basePayload.merchant_id,
        payload: basePayload,
        requestIdempotencyKey: 'checkout-1',
        supabase,
      })
    ).resolves.toEqual({
      checkoutRequestHash: expectedHash,
      isLegacyIdempotencyReplay: false,
    });
  });

  it('uses the legacy hash only when the database confirms a legacy order', async () => {
    const supabase = rpcClient(true);
    const expectedHash = hashOrderIdempotencyPayload(
      buildLegacyOrderIdempotencyPayload(basePayload)
    );

    await expect(
      prepareCheckoutIdempotencyReplay({
        canonicalAirportType: basePayload.airport_type,
        canonicalDeliveryMethod: basePayload.delivery_method,
        merchantId: basePayload.merchant_id,
        payload: basePayload,
        requestIdempotencyKey: 'checkout-1',
        supabase,
      })
    ).resolves.toEqual({
      checkoutRequestHash: expectedHash,
      isLegacyIdempotencyReplay: true,
    });
  });

  it('does not build or probe a hash when idempotency is absent', async () => {
    const supabase = rpcClient(false);

    await expect(
      prepareCheckoutIdempotencyReplay({
        canonicalAirportType: basePayload.airport_type,
        canonicalDeliveryMethod: basePayload.delivery_method,
        merchantId: basePayload.merchant_id,
        payload: basePayload,
        requestIdempotencyKey: null,
        supabase,
      })
    ).resolves.toEqual({
      checkoutRequestHash: null,
      isLegacyIdempotencyReplay: false,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
