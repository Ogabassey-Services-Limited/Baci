import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as webhookTest from './route.test-helpers';

// Regression coverage for the wedge class from incident ORD-260711-00NT-5:
// a completed transaction whose order flip never landed must be HEALED by a
// redelivery (not acked away), and an order-update failure must fail closed
// so the sender redelivers — while still recording the merchant settlement.

let mockVerifyWebhookSignature: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  mockVerifyWebhookSignature = await webhookTest.setupJuicywayWebhookTest();
});

const baseTransaction = {
  amount: '10000',
  gateway_reference: 'TXN-123456',
  id: 'txn-123',
  merchant_id: 'merchant-123',
  metadata: {
    juicyway_expected_amount: 10000,
    juicyway_expected_currency: 'NGN',
  },
  order_id: 'order-123',
  platform_fee: '150',
  status: 'pending',
};

const paidOrderRow = {
  ad_tracking: null,
  cancelled_at: null,
  currency: 'NGN',
  customer_email: 'customer@example.com',
  customer_id: 'customer-123',
  customer_name: 'Jane Doe',
  customer_phone: '+2341234567890',
  id: 'order-123',
  order_items: [],
  order_number: 'ORD-001',
  payment_status: 'paid',
  shipping_address: { address: '123 Main St', city: 'Lagos', state: 'Lagos' },
  shipping_fee: '500',
  shipping_status: 'processing',
  subtotal: '9500',
  total: '10000',
  updated_at: '2026-07-13T00:00:00Z',
};

describe('POST /api/payments/juicyway/webhook — wedge regression', () => {
  it('heals a wedged order on redelivery instead of acking Already processed', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    let transactionCallCount = 0;
    let orderUpdated = false;
    const orderStateLookup = vi.fn().mockResolvedValue({
      data: {
        cancelled_at: null,
        id: 'order-123',
        payment_status: 'pending',
        shipping_status: 'pending',
      },
      error: null,
    });

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ...baseTransaction, status: 'completed' },
              error: null,
            }),
          };
        }
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'orders') {
        return {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: orderStateLookup,
          select: vi.fn().mockReturnThis(),
          update: vi.fn(() => {
            orderUpdated = true;
            const chain: Record<string, unknown> = {
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: paidOrderRow, error: null }),
              single: vi
                .fn()
                .mockResolvedValue({ data: paidOrderRow, error: null }),
            };
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.neq = vi.fn().mockReturnValue(chain);
            chain.select = vi.fn().mockReturnValue(chain);
            return chain;
          }),
        };
      }
      if (table === 'merchants') {
        return {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { business_name: 'Test Store', slug: 'test-store' },
            error: null,
          }),
        };
      }
      return {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(),
        update: vi.fn().mockReturnThis(),
      };
    });

    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });
    webhookTest.mockAdminSupabase.rpc = vi
      .fn()
      .mockResolvedValue({ error: null });

    const request = webhookTest.createWebhookRequest(
      webhookTest.createSuccessPayload()
    );

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      message: 'Payment processed successfully',
      success: true,
    });
    expect(orderStateLookup).toHaveBeenCalled();
    expect(orderUpdated).toBe(true);
  });

  it('still acks Already processed when the order is genuinely paid', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        return {
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...baseTransaction, status: 'completed' },
            error: null,
          }),
        };
      }
      if (table === 'orders') {
        return {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              cancelled_at: null,
              id: 'order-123',
              payment_status: 'paid',
              shipping_status: 'processing',
            },
            error: null,
          }),
          select: vi.fn().mockReturnThis(),
          update: vi.fn(),
        };
      }
      return {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(),
        update: vi.fn().mockReturnThis(),
      };
    });

    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

    const request = webhookTest.createWebhookRequest(
      webhookTest.createSuccessPayload()
    );

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ message: 'Already processed' });
  });

  it('records settlement idempotently and acks when the paid flip finds 0 rows', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    let transactionCallCount = 0;
    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: baseTransaction, error: null }),
          };
        }
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'orders') {
        return {
          update: vi.fn(() => {
            const chain: Record<string, unknown> = {
              // CAS matched 0 rows: the order is already paid.
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            };
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.neq = vi.fn().mockReturnValue(chain);
            chain.select = vi.fn().mockReturnValue(chain);
            return chain;
          }),
        };
      }
      return {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(),
        update: vi.fn().mockReturnThis(),
      };
    });

    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });
    webhookTest.mockAdminSupabase.rpc = vi
      .fn()
      .mockResolvedValue({ error: null });

    const request = webhookTest.createWebhookRequest(
      webhookTest.createSuccessPayload()
    );

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    // Terminal ack: a 500 could never resolve when the order was paid
    // through another channel — but the captured money must still settle.
    expect(response.status).toBe(200);
    expect(data).toEqual({ message: 'Already processed' });
    expect(webhookTest.mockAdminSupabase.rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({
        p_gateway: 'juicyway',
        p_source_id: 'order-123',
      })
    );
  });

  it('records settlement but fails closed when the order update errors', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    let transactionCallCount = 0;
    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: baseTransaction, error: null }),
          };
        }
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }
      if (table === 'orders') {
        return {
          update: vi.fn(() => {
            const chain: Record<string, unknown> = {
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'column does not exist' },
              }),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'column does not exist' },
              }),
            };
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.neq = vi.fn().mockReturnValue(chain);
            chain.select = vi.fn().mockReturnValue(chain);
            return chain;
          }),
        };
      }
      return {
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn(),
        update: vi.fn().mockReturnThis(),
      };
    });

    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });
    webhookTest.mockAdminSupabase.rpc = vi
      .fn()
      .mockResolvedValue({ error: null });

    const request = webhookTest.createWebhookRequest(
      webhookTest.createSuccessPayload()
    );

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      code: 'ORDER_PAYMENT_COMPLETION_FAILED',
      error: 'Order payment completion failed',
    });
    // The merchant is still credited before the fail-closed response.
    expect(webhookTest.mockAdminSupabase.rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({
        p_gateway: 'juicyway',
        p_source_id: 'order-123',
      })
    );
  });
});
