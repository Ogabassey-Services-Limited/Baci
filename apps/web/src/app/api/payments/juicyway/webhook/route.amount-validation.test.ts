import { beforeEach, describe, expect, it, type vi } from 'vitest';
import type { JuicywayWebhookPayload } from '@/lib/juicyway';
import * as webhookTest from './route.test-helpers';

let mockVerifyWebhookSignature: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  mockVerifyWebhookSignature = await webhookTest.setupJuicywayWebhookTest();
});

describe('POST /api/payments/juicyway/webhook amount validation', () => {
  it('rejects an underpaid stablecoin settlement with 400 and does not mark paid', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    // Settled 5000 cents against an expected 10000 — a 50% underpayment.
    const payload = webhookTest.createSuccessPayload();
    payload.data.amount = 5000;
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Payment amount mismatch' });
    expect(state.txnUpdated).toBe(false);
    expect(state.orderUpdated).toBe(false);
    expect(webhookTest.mockAdminSupabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects a settlement in the wrong currency with 400', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload();
    payload.data.amount = 10000;
    payload.data.currency = 'NGN'; // expected USDT
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Payment currency mismatch',
    });
    expect(state.orderUpdated).toBe(false);
  });

  it('rejects a missing settlement amount with 400 and does not mark paid', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload() as unknown as {
      data: Partial<JuicywayWebhookPayload['data']>;
    };
    delete payload.data.amount;
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload as JuicywayWebhookPayload)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Payment amount mismatch' });
    expect(state.txnUpdated).toBe(false);
    expect(state.orderUpdated).toBe(false);
  });

  it('rejects an invalid settlement amount with 400 and does not mark paid', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload() as unknown as {
      data: Omit<JuicywayWebhookPayload['data'], 'amount'> & {
        amount: unknown;
      };
    };
    payload.data.amount = 'not-a-number';
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload as JuicywayWebhookPayload)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Payment amount mismatch' });
    expect(state.txnUpdated).toBe(false);
    expect(state.orderUpdated).toBe(false);
  });

  it('rejects a missing settlement currency with 400 and does not mark paid', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload() as unknown as {
      data: Partial<JuicywayWebhookPayload['data']>;
    };
    payload.data.amount = 10000;
    delete payload.data.currency;
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload as JuicywayWebhookPayload)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Payment currency mismatch',
    });
    expect(state.txnUpdated).toBe(false);
    expect(state.orderUpdated).toBe(false);
  });

  it('accepts an exact stablecoin settlement and processes the payment', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload();
    payload.data.amount = 10000;
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(200);
    expect(state.orderUpdated).toBe(true);
  });

  it('accepts a settlement within the dust tolerance (<1% short)', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({
      juicyway_expected_amount: 10000,
      juicyway_expected_currency: 'USDT',
    });
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload();
    payload.data.amount = 9950; // 0.5% short — within tolerance
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(200);
    expect(state.orderUpdated).toBe(true);
  });

  it('rejects the payment when no expected amount is persisted', async () => {
    mockVerifyWebhookSignature.mockResolvedValue(true);

    const transaction = webhookTest.pendingCryptoTxn({});
    const state = webhookTest.wireProcessingMocks(transaction);

    const payload = webhookTest.createSuccessPayload();
    payload.data.amount = 5000;
    payload.data.currency = 'USDT';
    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Payment amount mismatch' });
    expect(state.orderUpdated).toBe(false);
  });
});
