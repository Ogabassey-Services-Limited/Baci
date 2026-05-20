import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
  recordMerchantSettlement: vi.fn(),
  sendEmail: vi.fn(),
  transactionSelectSingle: vi.fn(),
  transactionUpdateMaybeSingle: vi.fn(),
  orderUpdateSingle: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mocks.logger,
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: (...args: unknown[]) => mocks.notifyNewOrder(...args),
  notifyPaymentReceived: (...args: unknown[]) =>
    mocks.notifyPaymentReceived(...args),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mocks.createServiceClient(),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void callback();
    },
  };
});

import { POST } from './route';

function signPayload(rawBody: string, secret: string) {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function createRequest(body: Record<string, unknown>, signature?: string) {
  const rawBody = JSON.stringify(body);
  return new NextRequest('https://usebaci.com/api/payments/klump/webhook', {
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-Klump-Signature': signature } : {}),
      'X-Klump-Webhook-Attempt': '1',
      'X-Klump-Webhook-Id': 'webhook-123',
    },
    method: 'POST',
  });
}

function makeQueryChain<T>(result: T) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    neq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function makeUpdateChain<T>(result: T) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    neq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function createSupabaseMock({
  orderUpdateResult = {
    data: {
      currency: 'NGN',
      customer_email: 'buyer@example.com',
      customer_id: 'customer-123',
      customer_name: 'Buyer Name',
      customer_phone: '+2348000000000',
      discount_amount: 0,
      gift_wrapping_fee: 0,
      id: 'order-123',
      merchant_id: 'merchant-123',
      order_items: [
        {
          name: 'Phone',
          price: 50000,
          quantity: 1,
          subtotal: 50000,
        },
      ],
      order_number: 'ORD-123',
      payment_status: 'paid',
      shipping_address: { address: '1 Market Street' },
      shipping_fee: '0',
      shipping_status: 'processing',
      subtotal: '50000',
      tax_amount: 0,
      tax_basis: null,
      total: '50000',
      updated_at: '2026-05-20T00:00:00.000Z',
    },
    error: null,
  },
  transactionUpdateResult = {
    data: { id: 'transaction-123' },
    error: null,
  },
}: {
  orderUpdateResult?: { data: unknown; error: unknown };
  transactionUpdateResult?: { data: unknown; error: unknown };
} = {}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn(() =>
            makeQueryChain({
              data: {
                amount: '50000',
                currency: 'NGN',
                gateway_reference: 'BAC-ABCD12345678',
                id: 'transaction-123',
                merchant_id: 'merchant-123',
                metadata: {},
                order_id: 'order-123',
                platform_fee: null,
                status: 'pending',
              },
              error: null,
            })
          ),
          update: vi.fn((payload: unknown) => {
            mocks.transactionUpdateMaybeSingle(payload);
            return makeUpdateChain(transactionUpdateResult);
          }),
        };
      }

      if (table === 'orders') {
        return {
          update: vi.fn((payload: unknown) => {
            mocks.orderUpdateSingle(payload);
            return makeUpdateChain(orderUpdateResult);
          }),
        };
      }

      if (table === 'merchants') {
        return {
          select: vi.fn(() =>
            makeQueryChain({
              data: {
                business_name: 'Baci Store',
                cac_rc_number: null,
                email: 'merchant@example.com',
                email_sender_name: null,
                slug: 'baci-store',
                support_email: null,
                tax_identification_number: null,
              },
              error: null,
            })
          ),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((name: string, args: unknown) => {
      if (name === 'record_merchant_settlement') {
        mocks.recordMerchantSettlement(args);
        return Promise.resolve({ data: null, error: null });
      }

      const result = {
        data: { current_status: 'claimed', we_won: true },
        error: null,
      };

      return Object.assign(Promise.resolve(result), {
        single: () => Promise.resolve(result),
      });
    }),
  };
}

const successfulPayload = {
  data: {
    amount: 50000,
    currency: 'NGN',
    id: 'klump-txn-123',
    is_live: true,
    merchant_reference: 'BAC-ABCD12345678',
    status: 'successful',
  },
  event: 'klump.payment.transaction.successful',
};

describe('POST /api/payments/klump/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KLUMP_SECRET_KEY = 'klump-secret';
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';
    mocks.createServiceClient.mockReturnValue(createSupabaseMock());
    mocks.sendEmail.mockResolvedValue({
      messageId: 'message-123',
      success: true,
    });
  });

  it('rejects webhook calls with invalid signatures before database writes', async () => {
    const response = await POST(
      createRequest(successfulPayload, 'bad-signature')
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Invalid signature');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('marks the Klump transaction and order paid after a signed successful event', async () => {
    const rawBody = JSON.stringify(successfulPayload);
    const response = await POST(
      createRequest(successfulPayload, signPayload(rawBody, 'klump-secret'))
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      message: 'Klump payment processed successfully',
      success: true,
    });
    expect(mocks.transactionUpdateMaybeSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
      })
    );
    expect(mocks.orderUpdateSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_status: 'paid',
        shipping_status: 'processing',
      })
    );
    expect(
      mocks.transactionUpdateMaybeSingle.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.orderUpdateSingle.mock.invocationCallOrder[0]);
    expect(mocks.recordMerchantSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        p_gateway: 'klump',
        p_gateway_reference: 'BAC-ABCD12345678',
        p_gross_amount: 50000,
        p_merchant_id: 'merchant-123',
        p_source_id: 'order-123',
        p_source_type: 'order',
      })
    );
  });

  it('acknowledges non-success events without marking the order paid', async () => {
    const payload = {
      ...successfulPayload,
      event: 'klump.payment.transaction.initiated',
    };
    const rawBody = JSON.stringify(payload);

    const response = await POST(
      createRequest(payload, signPayload(rawBody, 'klump-secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Event ignored');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('does not mark the order paid when the transaction update fails', async () => {
    mocks.createServiceClient.mockReturnValue(
      createSupabaseMock({
        transactionUpdateResult: {
          data: null,
          error: { message: 'transaction update failed' },
        },
      })
    );
    const rawBody = JSON.stringify(successfulPayload);

    const response = await POST(
      createRequest(successfulPayload, signPayload(rawBody, 'klump-secret'))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to update transaction');
    expect(mocks.transactionUpdateMaybeSingle).toHaveBeenCalled();
    expect(mocks.orderUpdateSingle).not.toHaveBeenCalled();
  });
});
