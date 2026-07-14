import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as webhookTest from './route.test-helpers';

let mockVerifyWebhookSignature: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  mockVerifyWebhookSignature = await webhookTest.setupJuicywayWebhookTest();
});

describe('POST /api/payments/juicyway/webhook legacy/cancelled flows', () => {
  it('processes legacy in-flight settlements created before expected metadata existed', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = {
      ...webhookTest.pendingCryptoTxn({}),
      created_at: '2026-06-25T14:00:00.000Z',
    };
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload();
    payload.data.amount = 5000;
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(200);
    expect(state.orderUpdated).toBe(true);
  });

  it('suppresses side effects + settlement and files reconciliation when the order was clamped as cancelled', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = {
      id: 'txn-123',
      status: 'pending',
      gateway_reference: 'TXN-123456',
      amount: '10000',
      platform_fee: '150',
      merchant_id: 'merchant-123',
      order_id: 'order-123',
      metadata: {
        juicyway_expected_amount: 10000,
        juicyway_expected_currency: 'NGN',
      },
    };

    // The order UPDATE returns the CLAMPED cancelled row.
    const cancelledOrder = {
      id: 'order-123',
      order_number: 'ORD-001',
      customer_email: 'customer@example.com',
      customer_name: 'Jane Doe',
      total: '10000',
      currency: 'NGN',
      shipping_status: 'cancelled',
      cancelled_at: '2026-06-15T00:00:00Z',
      order_items: [],
      ad_tracking: null,
    };

    let transactionCallCount = 0;

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: transaction, error: null }),
          };
        }
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === 'orders') {
        return {
          update: vi.fn(() => {
            const chain: Record<string, unknown> = {
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: cancelledOrder, error: null }),
              single: vi
                .fn()
                .mockResolvedValue({ data: cancelledOrder, error: null }),
            };
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.neq = vi.fn().mockReturnValue(chain);
            chain.in = vi.fn().mockReturnValue(chain);
            chain.select = vi.fn().mockReturnValue(chain);
            return chain;
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });
    webhookTest.mockAdminSupabase.rpc = vi
      .fn()
      .mockResolvedValue({ error: null });

    const payload = webhookTest.createSuccessPayload();
    const request = webhookTest.createWebhookRequest(payload);

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: 'Payment recorded; order was cancelled, filed for review',
    });
    // Settlement must NOT run for a cancelled order.
    expect(webhookTest.mockAdminSupabase.rpc).not.toHaveBeenCalled();
    // Reconciliation row filed through the service-role admin client.
    expect(webhookTest.mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'payment_received_after_cancellation',
        order_id: 'order-123',
      })
    );
  });
});
