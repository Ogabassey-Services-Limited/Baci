import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as webhookTest from './route.test-helpers';

let verifySignature: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  verifySignature = await webhookTest.setupJuicywayWebhookTest();
});

describe('Juicyway USDT wallet settlement', () => {
  it('credits the currency account after signature and amount validation', async () => {
    verifySignature.mockResolvedValue(true);
    const transaction = {
      amount: '25',
      created_at: '2026-07-11T00:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
      merchant_id: 'merchant-1',
      metadata: {
        customer_id: 'customer-1',
        juicyway_expected_amount: 2500,
        juicyway_expected_currency: 'USDT',
        transaction_type: 'wallet_usdt_topup',
        wallet_credit_amount: 25,
      },
      order_id: null,
      platform_fee: 0,
      status: 'pending',
    };
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    webhookTest.mockAdminSupabase.from = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
      update,
    })) as unknown as typeof webhookTest.mockAdminSupabase.from;
    webhookTest.mockAdminSupabase.rpc = vi.fn().mockResolvedValue({
      data: [
        {
          currency: 'USDT',
          new_balance: 25,
          success: true,
          transaction_id: 'ledger-1',
        },
      ],
      error: null,
    });
    const payload = webhookTest.createSuccessPayload('WUSDT-TEST');
    payload.data.amount = 2500;
    payload.data.currency = 'USDT';

    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(200);
    expect(webhookTest.mockAdminSupabase.rpc).toHaveBeenCalledWith(
      'credit_customer_wallet_account',
      expect.objectContaining({ p_amount: 25, p_currency: 'USDT' })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });

  it('reads wallet transactions with the service-role client', async () => {
    verifySignature.mockResolvedValue(true);
    const transaction = {
      amount: '25',
      created_at: '2026-07-11T00:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
      merchant_id: 'merchant-1',
      metadata: {
        customer_id: 'customer-1',
        juicyway_expected_amount: 2500,
        juicyway_expected_currency: 'USDT',
        transaction_type: 'wallet_usdt_topup',
        wallet_credit_amount: 25,
      },
      order_id: null,
      platform_fee: 0,
      status: 'pending',
    };
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    webhookTest.mockAdminSupabase.from = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
      update,
    })) as unknown as typeof webhookTest.mockAdminSupabase.from;
    webhookTest.mockAdminSupabase.rpc = vi.fn().mockResolvedValue({
      data: [
        {
          currency: 'USDT',
          new_balance: 25,
          success: true,
          transaction_id: 'ledger-1',
        },
      ],
      error: null,
    });
    const payload = webhookTest.createSuccessPayload('WUSDT-ADMIN');
    payload.data.amount = 2500;
    payload.data.currency = 'USDT';

    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(200);
    expect(webhookTest.mockAdminSupabase.from).toHaveBeenCalledWith(
      'transactions'
    );
  });

  it('marks a failed wallet top-up transaction as failed', async () => {
    verifySignature.mockResolvedValue(true);
    const updateBuilder = { eq: vi.fn() };
    updateBuilder.eq.mockReturnValue(updateBuilder);
    const update = vi.fn(() => updateBuilder);
    webhookTest.mockAdminSupabase.from = vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          metadata: { transaction_type: 'wallet_usdt_topup' },
          status: 'pending',
        },
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
      update,
    })) as unknown as typeof webhookTest.mockAdminSupabase.from;
    const payload = webhookTest.createFailedPayload();
    payload.data.reference = 'wusdt_failed';

    const response = await webhookTest.postJuicywayWebhook(
      webhookTest.createWebhookRequest(payload)
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith(
      'id',
      '11111111-1111-4111-8111-111111111111'
    );
  });
});
