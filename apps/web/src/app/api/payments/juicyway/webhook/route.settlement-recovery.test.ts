import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as webhookTest from './route.test-helpers';

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

function transactionTable(callCount: number) {
  if (callCount === 1) {
    return {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: baseTransaction, error: null }),
    };
  }
  return {
    eq: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
  };
}

function updateChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const method of ['eq', 'in', 'select']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

describe('POST /api/payments/juicyway/webhook — settlement recovery', () => {
  it('records settlement idempotently when the paid flip finds 0 rows', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);
    let transactionCallCount = 0;
    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount += 1;
        return transactionTable(transactionCallCount);
      }
      if (table === 'orders') {
        return {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              cancelled_at: null,
              id: 'order-123',
              order_number: 'ORD-123',
              payment_status: 'paid',
              shipping_status: 'processing',
            },
            error: null,
          }),
          select: vi.fn().mockReturnThis(),
          update: vi.fn(() => updateChain({ data: null, error: null })),
        };
      }
      return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis() };
    });
    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockAdminSupabase.rpc.mockResolvedValue({ error: null });

    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(webhookTest.createSuccessPayload())
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'Already processed' });
    expect(webhookTest.mockAdminSupabase.rpc).toHaveBeenCalledWith(
      'record_merchant_settlement',
      expect.objectContaining({ p_source_id: 'order-123' })
    );
  });

  it('records settlement but fails closed when the order update errors', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);
    let transactionCallCount = 0;
    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount += 1;
        return transactionTable(transactionCallCount);
      }
      if (table === 'orders') {
        return {
          update: vi.fn(() =>
            updateChain({ data: null, error: { message: 'column missing' } })
          ),
        };
      }
      return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis() };
    });
    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockAdminSupabase.rpc.mockResolvedValue({ error: null });

    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(webhookTest.createSuccessPayload())
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: 'ORDER_PAYMENT_COMPLETION_FAILED',
      error: 'Order payment completion failed',
    });
  });

  it('files blocked unpaid order states for review instead of settling', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);
    let transactionCallCount = 0;
    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount += 1;
        return transactionTable(transactionCallCount);
      }
      if (table === 'orders') {
        return {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              cancelled_at: null,
              id: 'order-123',
              order_number: 'ORD-123',
              payment_status: 'bnpl_pending',
              shipping_status: 'pending',
            },
            error: null,
          }),
          select: vi.fn().mockReturnThis(),
          update: vi.fn(() => updateChain({ data: null, error: null })),
        };
      }
      return { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis() };
    });
    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;

    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(webhookTest.createSuccessPayload())
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: 'Payment recorded; blocked order filed for review',
      success: true,
    });
    expect(webhookTest.mockReconciliationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_type: 'gateway_payment_wedge_requires_review',
        order_id: 'order-123',
      })
    );
    expect(webhookTest.mockAdminSupabase.rpc).not.toHaveBeenCalled();
  });
});
