import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAgenticCheckoutOrder,
  sendAgenticOrderCreatedWebhook,
} from '@/lib/agentic/checkout-order-dispatch';
import { sendAgenticWebhook } from '@/lib/agentic/webhooks';
import { logger } from '@/lib/logger';

vi.mock('@/lib/agentic/webhooks', () => ({
  sendAgenticWebhook: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const merchantId = '11111111-1111-4111-8111-111111111111';

// B3.5 round 5: `createAgenticCheckoutOrder` now calls
// `computeAgenticOrderTax`, which queries `merchants` (for VAT status)
// and `products`/`product_variants` (for per-line VAT). Provide a
// minimal `from()` stub that resolves merchant as not-registered by
// default — keeps the helper returning 0 and existing assertions
// unchanged. Tests that need VAT-registered behavior can override.
function makeFromStub(opts?: { vatStatus?: 'registered' | 'not_registered' }) {
  const vatStatus = opts?.vatStatus ?? 'not_registered';
  return (table: string) => {
    if (table === 'merchants') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { vat_registration_status: vatStatus },
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === 'products' || table === 'product_variants') {
      return {
        select: () => ({
          in: () => ({
            returns: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in dispatch test: ${table}`);
  };
}

function orderPayload() {
  return {
    customer_email: 'buyer@example.com',
    customer_name: 'Ada Lovelace',
    customer_phone: '+2348012345678',
    items: [
      {
        name: 'Phone',
        price: 500_000,
        product_id: 'product-1',
        quantity: 1,
      },
    ],
    merchant_id: merchantId,
    payment_method: 'bank_transfer',
    payment_status: 'pending',
    shipping_fee: 0,
    shipping_status: 'pending',
    source: 'agentic_ai',
    subtotal: 500_000,
    tax_amount: 0,
  };
}

describe('agentic checkout order dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an order through the order RPC and returns the order id', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'order-1', total: 500_000 }],
      error: null,
    });

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      rpc,
      from: makeFromStub(),
    } as unknown as SupabaseClient);

    expect(result).toMatchObject({
      ok: true,
      orderId: 'order-1',
      status: 201,
    });
    expect(rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_customer_email: 'buyer@example.com',
        p_items: [
          expect.objectContaining({
            product_id: 'product-1',
            quantity: 1,
          }),
        ],
        p_merchant_id: merchantId,
        p_payment_method: 'bank_transfer',
        p_user_id: null,
      })
    );
  });

  it('forwards computed VAT as p_tax_amount for VAT-registered merchants (Codex P1 round 5)', async () => {
    // The agentic `calculateCheckoutSession` always emits `tax: 0`,
    // so `body.tax_amount` arrives at the RPC as 0. Without this
    // recompute, a VAT-registered merchant gets `tax_amount_mismatch`
    // → 400 → broken checkout. Pin that the dispatch overrides
    // `p_tax_amount` with the per-line VAT sum.
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'order-vat-1', total: 537_500 }],
      error: null,
    });

    const from = (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { vat_registration_status: 'registered' },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: () => ({
            in: () => ({
              returns: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'product-1',
                      price: 500_000,
                      vat_category_code: 'S',
                      vat_rate: 7.5,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'product_variants') {
        return {
          select: () => ({
            in: () => ({
              returns: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error('unexpected');
    };

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      from,
      rpc,
    } as unknown as SupabaseClient);

    expect(result.ok).toBe(true);
    // ROUND(ROUND(1 * 500000, 2) * 7.5 / 100, 2) = 37500
    expect(rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_tax_amount: 37_500,
      })
    );
  });

  it('returns the order RPC error without creating a false success', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'insufficient_stock', message: 'insufficient_stock' },
    });

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      rpc,
      from: makeFromStub(),
    } as unknown as SupabaseClient);

    expect(result).toMatchObject({
      error: 'insufficient_stock',
      ok: false,
      orderId: undefined,
      status: 400,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'insufficient_stock',
        message: 'Agentic checkout order RPC failed',
      })
    );
  });

  it('does not expose unknown order RPC error details to callers', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST000', message: 'database internals leaked' },
    });

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      rpc,
      from: makeFromStub(),
    } as unknown as SupabaseClient);

    expect(result).toMatchObject({
      data: {
        details: 'Unable to create order',
        error: 'Failed to create order',
      },
      error: 'Unable to create order',
      ok: false,
      status: 500,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PGRST000',
        message: 'Agentic checkout order RPC failed',
      })
    );
  });

  it('rejects an order response when the order total is not numeric', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'order-1', total: 'not-a-number' }],
      error: null,
    });

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      rpc,
      from: makeFromStub(),
    } as unknown as SupabaseClient);

    expect(result).toMatchObject({
      data: { error: 'Invalid order total' },
      error: 'Invalid order total',
      ok: false,
      orderId: undefined,
      status: 422,
      statusText: 'Unprocessable Entity',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agentic checkout order returned invalid total',
        orderId: 'order-1',
        total: 'not-a-number',
      })
    );
  });

  it('rounds assurance fees before sending order items to the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'order-1', total: 500_000 }],
      error: null,
    });

    await createAgenticCheckoutOrder(
      {
        ...orderPayload(),
        items: [
          {
            has_assurance: true,
            name: 'Phone',
            price: 333.33,
            product_id: 'product-1',
            quantity: 1,
          },
        ],
      },
      { from: makeFromStub(), rpc } as unknown as SupabaseClient
    );

    expect(rpc).toHaveBeenCalledWith(
      'create_storefront_order',
      expect.objectContaining({
        p_items: [
          expect.objectContaining({
            assurance_fee: 16.67,
          }),
        ],
      })
    );
  });

  it('sends the agentic order-created webhook asynchronously', () => {
    sendAgenticOrderCreatedWebhook({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      currency: 'NGN',
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      total: 500000,
    });

    expect(sendAgenticWebhook).toHaveBeenCalledWith(
      'order.created',
      expect.objectContaining({
        id: 'order-1',
        currency: 'NGN',
        total: 500000,
        buyer: expect.objectContaining({
          email: 'buyer@example.com',
        }),
      })
    );
  });

  it('logs webhook delivery failures without throwing synchronously', async () => {
    const error = new Error('webhook offline');
    vi.mocked(sendAgenticWebhook).mockRejectedValue(error);

    expect(() =>
      sendAgenticOrderCreatedWebhook({
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        currency: 'NGN',
        orderId: 'order-1',
        sessionId: 'agentic_session_1',
        total: 500000,
      })
    ).not.toThrow();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: '{}',
        message: 'Webhook trigger failed',
        sessionId: 'agentic_session_1',
      })
    );
  });
});
