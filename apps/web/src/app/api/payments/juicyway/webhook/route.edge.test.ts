import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as webhookTest from './route.test-helpers';

let mockVerifyWebhookSignature: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  mockVerifyWebhookSignature = await webhookTest.setupJuicywayWebhookTest();
});

describe('POST /api/payments/juicyway/webhook edge cases', () => {
  it('processes payment without order_id', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = {
      id: 'txn-123',
      status: 'pending',
      gateway_reference: 'TXN-123456',
      amount: '10000',
      platform_fee: '150',
      merchant_id: 'merchant-123',
      order_id: null, // No order_id
      metadata: {
        juicyway_expected_amount: 10000,
        juicyway_expected_currency: 'NGN',
      },
    };

    let transactionCallCount = 0;

    const fromMock = vi.fn((table) => {
      if (table === 'transactions') {
        transactionCallCount++;
        if (transactionCallCount === 1) {
          // First call: fetch transaction
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: transaction, error: null }),
          };
        }
        // Second call: update transaction
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    (webhookTest.mockSupabase as Record<string, unknown>).from = fromMock;
    webhookTest.mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });

    const payload = webhookTest.createSuccessPayload();
    const request = webhookTest.createWebhookRequest(payload);

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: 'Payment processed successfully',
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling Tests
  // ---------------------------------------------------------------------------

  it('returns 500 on unexpected error', async () => {
    mockVerifyWebhookSignature.mockRejectedValue(
      new Error('Crypto API failure')
    );

    const payload = webhookTest.createSuccessPayload();
    const request = webhookTest.createWebhookRequest(payload);

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      error: 'Webhook processing failed',
      details: 'Crypto API failure',
    });
  });

  it('returns 400 when reference is missing', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const payload = webhookTest.createSuccessPayload();
    payload.data.reference = ''; // Empty reference

    const request = webhookTest.createWebhookRequest(payload);

    const response = await webhookTest.postJuicywayWebhook(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Missing reference' });
  });
});
