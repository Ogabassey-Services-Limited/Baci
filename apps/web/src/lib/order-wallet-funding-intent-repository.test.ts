import { describe, expect, it } from 'vitest';
import { createOrderWalletFundingIntentRepository } from '@/lib/order-wallet-funding-intent-repository';
import {
  createQueryResult,
  createSupabaseMock,
  createTableSupabaseMock,
  intentRow,
} from '@/lib/order-wallet-funding-intent-repository.test-utils';

describe('createOrderWalletFundingIntentRepository', () => {
  it('expires stale intents through the scoped RPC', async () => {
    const supabase = createSupabaseMock();
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await repository.expireStaleWalletFundingIntents({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      now: new Date('2026-05-26T12:00:00.000Z'),
      walletPaymentAccountId: 'wallet-account-1',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'expire_order_wallet_funding_intents',
      {
        p_customer_id: 'customer-1',
        p_merchant_id: 'merchant-1',
        p_now: '2026-05-26T12:00:00.000Z',
        p_wallet_payment_account_id: 'wallet-account-1',
      }
    );
  });

  it('creates intents through the authenticated creation RPC and normalizes the response', async () => {
    const supabase = createSupabaseMock();
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    const intent = await repository.insertOrderWalletFundingIntent({
      currency: 'NGN',
      customerId: 'customer-1',
      expectedAmount: 15_000,
      expiresAt: '2026-05-26T12:30:00.000Z',
      merchantId: 'merchant-1',
      orderId: 'order-1',
      targetOrderAmount: 18_000,
      walletBalanceSnapshot: 3_000,
      walletPaymentAccountId: 'wallet-account-1',
    });

    expect(intent.provider).toBe('paystack');
    expect(intent.expectedAmount).toBe(15_000);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_order_wallet_funding_intent_for_customer',
      {
        p_customer_id: 'customer-1',
        p_merchant_id: 'merchant-1',
        p_now: '2026-05-26T12:00:00.000Z',
        p_order_id: 'order-1',
        p_wallet_payment_account_id: 'wallet-account-1',
      }
    );
  });

  it('rejects unsupported providers returned by the database', async () => {
    const supabase = createSupabaseMock({
      createIntentRow: { ...intentRow, provider: 'other' },
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.insertOrderWalletFundingIntent({
        currency: 'NGN',
        customerId: 'customer-1',
        expectedAmount: 15_000,
        expiresAt: '2026-05-26T12:30:00.000Z',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        targetOrderAmount: 18_000,
        walletBalanceSnapshot: 3_000,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).rejects.toThrow('Unsupported wallet funding provider');
  });

  it('rejects unsupported statuses returned by the database', async () => {
    const supabase = createSupabaseMock({
      createIntentRow: { ...intentRow, status: 'unknown_status' },
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.insertOrderWalletFundingIntent({
        currency: 'NGN',
        customerId: 'customer-1',
        expectedAmount: 15_000,
        expiresAt: '2026-05-26T12:30:00.000Z',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        targetOrderAmount: 18_000,
        walletBalanceSnapshot: 3_000,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).rejects.toThrow('Unsupported wallet funding status');
  });

  it('finds active order intents with a quoted terminal-status filter', async () => {
    const intentQuery = createQueryResult({ data: intentRow });
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intents: [intentQuery],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.findActiveOrderIntent({ orderId: 'order-1' })
    ).resolves.toMatchObject({ id: 'intent-1' });
    expect(intentQuery.not).toHaveBeenCalledWith(
      'status',
      'in',
      '("expired","cancelled","failed")'
    );
  });

  it('returns null when no active order intent exists', async () => {
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intents: [createQueryResult({ data: null })],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.findActiveOrderIntent({ orderId: 'order-1' })
    ).resolves.toBeNull();
  });

  it('lists active wallet-account intents', async () => {
    const activeWalletIntentsQuery = createQueryResult({
      data: [intentRow, { ...intentRow, id: 'intent-2' }],
    });
    activeWalletIntentsQuery.order.mockResolvedValueOnce({
      data: [intentRow, { ...intentRow, id: 'intent-2' }],
      error: null,
    } as never);
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intents: [activeWalletIntentsQuery],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.findActiveWalletAccountIntents({
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toHaveLength(2);
  });

  it('resolves the owning intent for a transfer reference already in the payments ledger', async () => {
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intent_payments: [
        createQueryResult({ data: { intent_id: 'intent-1' } }),
      ],
      order_wallet_funding_intents: [createQueryResult({ data: intentRow })],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.findWalletAccountIntentByTransferReference({
        gatewayReference: 'PSTK-REF-1',
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toMatchObject({ id: 'intent-1' });
  });

  it('returns null when no payment ledger row exists for the transfer reference', async () => {
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intent_payments: [createQueryResult({ data: null })],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.findWalletAccountIntentByTransferReference({
        gatewayReference: 'PSTK-REF-MISSING',
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toBeNull();
  });

  it('reads scoped order rows and returns null when missing', async () => {
    const orderRow = {
      currency: 'NGN',
      customer_id: 'customer-1',
      id: 'order-1',
      merchant_id: 'merchant-1',
      payment_status: 'pending',
      total: 20_000,
    };
    const supabase = createTableSupabaseMock({
      orders: [
        createQueryResult({ data: orderRow }),
        createQueryResult({ data: null }),
      ],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.getOrderForCustomer({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
      })
    ).resolves.toMatchObject({ total: 20_000 });
    await expect(
      repository.getOrderForCustomer({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'missing-order',
      })
    ).resolves.toBeNull();
  });

  it('reads scoped intent polling rows and returns null when missing', async () => {
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intents: [
        createQueryResult({ data: intentRow }),
        createQueryResult({ data: null }),
      ],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'intent-1',
        merchantId: 'merchant-1',
      })
    ).resolves.toMatchObject({ id: 'intent-1' });
    await expect(
      repository.getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'missing-intent',
        merchantId: 'merchant-1',
      })
    ).resolves.toBeNull();
  });
});
