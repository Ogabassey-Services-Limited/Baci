import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/shipping/merchant-rates/verify-order-shipping-rate', () => ({
  verifyOrderShippingRate: vi.fn(),
}));

import type {
  MerchantPickupAddress,
  MerchantRateKind,
} from '@/lib/shipping/merchant-rates/types';
import { verifyOrderShippingRate } from '@/lib/shipping/merchant-rates/verify-order-shipping-rate';
import { createAdminClient } from '@/lib/supabase/admin';
import { restampMerchantRateOnReuse } from './restamp-merchant-rate';

const ORDER_ID = '4dc0ee52-d9c4-406a-b6ca-80c84eef6a8f';
const MERCHANT_ID = 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2';
const RATE_ID = '123e4567-e89b-12d3-a456-426614174777';

interface OrderRow {
  shipping_provider: string | null;
  shipping_fee: number | null;
  subtotal: number | null;
  shipping_address: Record<string, unknown> | null;
}

function orderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    shipping_provider: null,
    shipping_fee: 1500,
    subtotal: 10_000,
    shipping_address: { state: 'Lagos', city: 'Ikeja', address: '5 Allen Ave' },
    ...overrides,
  };
}

interface VerifyOkOverrides {
  amount?: number;
  rateName?: string;
  kind?: MerchantRateKind;
  currency?: string;
  pickupAddress?: MerchantPickupAddress | null;
}

function verifyOk(overrides: VerifyOkOverrides = {}) {
  const kind = overrides.kind ?? 'ship';
  return {
    ok: true as const,
    amount: overrides.amount ?? 1500,
    rateName: overrides.rateName ?? 'Store Pickup',
    currency: overrides.currency ?? 'NGN',
    kind,
    ...(kind === 'pickup'
      ? { pickupAddress: overrides.pickupAddress ?? null }
      : {}),
  };
}

interface MockAdminOptions {
  orderRead: { data: OrderRow | null; error: unknown };
  merchantRead?: {
    data: { country: string | null; payout_currency: string | null } | null;
    error: unknown;
  };
  updateResults?: { error: unknown }[];
}

function createMockAdmin(options: MockAdminOptions) {
  const updateCalls: Record<string, unknown>[] = [];
  // Records every `.is(column, value)` filter appended to a stamp UPDATE so the
  // compare-and-set guard (`.is('shipping_provider', null)`) can be asserted.
  const isCalls: unknown[][] = [];
  const updateResults = options.updateResults ?? [{ error: null }];
  let updateIndex = 0;
  const merchantRead = options.merchantRead ?? {
    data: { country: 'NG', payout_currency: 'NGN' },
    error: null,
  };

  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    // The update chain (`update().eq().eq().is()`) is awaited directly for its
    // `{ error }` result, so return a NATIVE Promise with chainable `.eq()` /
    // `.is()`.
    builder.update = vi.fn((payload: Record<string, unknown>) => {
      updateCalls.push(payload);
      const result = updateResults[updateIndex] ?? { error: null };
      updateIndex += 1;
      const updateChain: Promise<{ error: unknown }> & {
        eq?: unknown;
        is?: unknown;
      } = Promise.resolve(result);
      updateChain.eq = vi.fn(() => updateChain);
      updateChain.is = vi.fn((...args: unknown[]) => {
        isCalls.push(args);
        return updateChain;
      });
      return updateChain;
    });
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() =>
      Promise.resolve(table === 'merchants' ? merchantRead : options.orderRead)
    );
    return builder;
  });

  return { client: { from } as never, updateCalls, isCalls, from };
}

function callRestamp() {
  return restampMerchantRateOnReuse({
    orderId: ORDER_ID,
    merchantId: MERCHANT_ID,
    shippingRateId: RATE_ID,
  });
}

describe('restampMerchantRateOnReuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('re-stamps a genuine merchant-rate order whose fee matches after a failed first stamp', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow({ shipping_fee: 1500 }), error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1500, rateName: 'Store Pickup' })
    );

    await callRestamp();

    expect(updateCalls).toEqual([
      {
        shipping_provider: 'MERCHANT',
        shipping_rate_id: RATE_ID,
        shipping_rate_name: 'Store Pickup',
      },
    ]);
  });

  it('scopes the stamp UPDATE to still-unstamped rows (compare-and-set)', async () => {
    // The UPDATE must carry `.is('shipping_provider', null)` so a concurrent
    // metadata writer that stamped a provider between the read-back and the
    // UPDATE is never overwritten.
    const { client, isCalls, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow({ shipping_fee: 1500 }), error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1500 })
    );

    await callRestamp();

    expect(updateCalls).toHaveLength(1);
    expect(isCalls).toContainEqual(['shipping_provider', null]);
  });

  it('stamps MERCHANT_PICKUP for a pickup rate whose fee matches', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: {
        data: orderRow({ shipping_provider: '   ', shipping_fee: 1500 }),
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1500, kind: 'pickup', rateName: 'Ikeja Store' })
    );

    await callRestamp();

    expect(updateCalls).toEqual([
      {
        shipping_provider: 'MERCHANT_PICKUP',
        shipping_rate_id: RATE_ID,
        shipping_rate_name: 'Ikeja Store',
        shipping_pickup_details: null,
      },
    ]);
  });

  it('snapshots the pickup address when re-stamping a pickup rate', async () => {
    const pickupAddress: MerchantPickupAddress = {
      label: 'Ikeja Store',
      address: '12 Allen Ave',
      city: 'Ikeja',
      state: 'Lagos',
      instructions: 'Ask for the front desk',
    };
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow({ shipping_fee: 1500 }), error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({
        amount: 1500,
        kind: 'pickup',
        rateName: 'Ikeja Store',
        pickupAddress,
      })
    );

    await callRestamp();

    expect(updateCalls).toEqual([
      {
        shipping_provider: 'MERCHANT_PICKUP',
        shipping_rate_id: RATE_ID,
        shipping_rate_name: 'Ikeja Store',
        shipping_pickup_details: pickupAddress,
      },
    ]);
  });

  it('does not verify or re-stamp when the metadata is already present', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: {
        data: orderRow({ shipping_provider: 'MERCHANT' }),
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await callRestamp();

    expect(verifyOrderShippingRate).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([]);
  });

  it('does NOT stamp a legacy pickup order (fee 0) when an arbitrary rate id recomputes a non-zero fee', async () => {
    // A legacy pickup/airport order also has a null shipping_provider. An
    // attacker with the order token/email forwards an arbitrary active paid
    // rate id; its recomputed fee (1500) does not match the order's stored fee
    // (0), so the fulfillment metadata is left untouched.
    const { client, updateCalls } = createMockAdmin({
      orderRead: {
        data: orderRow({
          shipping_provider: null,
          shipping_fee: 0,
          shipping_address: { state: 'Lagos' },
        }),
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1500 })
    );

    await callRestamp();

    expect(updateCalls).toEqual([]);
  });

  it('does NOT stamp a fee-0 order even when a GENUINE free merchant pickup rate recomputes to 0 (intentional zero-fee skip)', async () => {
    // A recomputed fee of 0 cannot distinguish this genuine free merchant
    // pickup rate from a legacy free pickup/airport order (both equal the
    // stored fee of 0), so fee-equality proves nothing. The order is left
    // unstamped by design — the narrow, non-monetary tradeoff documented on the
    // module.
    const { client, updateCalls } = createMockAdmin({
      orderRead: {
        data: orderRow({
          shipping_provider: null,
          shipping_fee: 0,
          shipping_address: { state: 'Lagos' },
        }),
        error: null,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 0, kind: 'pickup', rateName: 'Free Store Pickup' })
    );

    await callRestamp();

    expect(updateCalls).toEqual([]);
  });

  it('does not stamp when the recomputed fee differs from the stored shipping_fee', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow({ shipping_fee: 1500 }), error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1400 })
    );

    await callRestamp();

    expect(updateCalls).toEqual([]);
  });

  it('does not stamp when the rate does not verify against the order', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow(), error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue({
      ok: false,
      code: 'SHIPPING_RATE_INVALID',
      message: 'Selected shipping rate is not available',
    });

    await callRestamp();

    expect(updateCalls).toEqual([]);
  });

  it('retries without the soft-link id on a 23503 foreign-key violation', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow({ shipping_fee: 1500 }), error: null },
      updateResults: [{ error: { code: '23503' } }, { error: null }],
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1500, rateName: 'Standard' })
    );

    await callRestamp();

    expect(updateCalls).toEqual([
      {
        shipping_provider: 'MERCHANT',
        shipping_rate_id: RATE_ID,
        shipping_rate_name: 'Standard',
      },
      {
        shipping_provider: 'MERCHANT',
        shipping_rate_id: null,
        shipping_rate_name: 'Standard',
      },
    ]);
  });

  it('returns early without verifying when the order read-back errors', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: null, error: { message: 'read failed' } },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await callRestamp();

    expect(verifyOrderShippingRate).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([]);
  });

  it('returns early when the merchant read-back fails', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow(), error: null },
      merchantRead: { data: null, error: { message: 'merchant read failed' } },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);

    await callRestamp();

    expect(verifyOrderShippingRate).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([]);
  });

  it('never throws when the rate-config load outage rejects verification', async () => {
    const { client, updateCalls } = createMockAdmin({
      orderRead: { data: orderRow(), error: null },
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockRejectedValue(
      new Error('rate config load failed')
    );

    await expect(callRestamp()).resolves.toBeUndefined();
    expect(updateCalls).toEqual([]);
  });

  it('never throws when the stamp fails with a non-23503 error', async () => {
    const { client } = createMockAdmin({
      orderRead: { data: orderRow({ shipping_fee: 1500 }), error: null },
      updateResults: [{ error: { code: '42501', message: 'forbidden' } }],
    });
    vi.mocked(createAdminClient).mockReturnValue(client);
    vi.mocked(verifyOrderShippingRate).mockResolvedValue(
      verifyOk({ amount: 1500 })
    );

    await expect(callRestamp()).resolves.toBeUndefined();
  });
});
