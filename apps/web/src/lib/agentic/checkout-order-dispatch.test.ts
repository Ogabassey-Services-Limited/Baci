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

  it('returns the order RPC error without creating a false success', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'insufficient_stock', message: 'insufficient_stock' },
    });

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      rpc,
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

  it('falls back to zero when the order total is not numeric', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'order-1', total: 'not-a-number' }],
      error: null,
    });

    const result = await createAgenticCheckoutOrder(orderPayload(), {
      rpc,
    } as unknown as SupabaseClient);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      amountDueToGateway: 0,
      order: { id: 'order-1' },
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
      { rpc } as unknown as SupabaseClient
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
        error,
        message: 'Webhook trigger failed',
        sessionId: 'agentic_session_1',
      })
    );
  });
});
