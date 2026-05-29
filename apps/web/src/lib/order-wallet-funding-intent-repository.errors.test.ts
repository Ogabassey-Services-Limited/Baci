import { describe, expect, it } from 'vitest';
import { createOrderWalletFundingIntentRepository } from '@/lib/order-wallet-funding-intent-repository';
import {
  createQueryResult,
  createSupabaseMock,
  createTableSupabaseMock,
  intentRow,
} from '@/lib/order-wallet-funding-intent-repository.test-utils';

describe('order wallet funding intent repository errors', () => {
  it('marks review-required intents through one atomic RPC', async () => {
    const supabase = createTableSupabaseMock({});
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await repository.markWalletFundingIntentReviewRequired({
      gatewayReference: 'PSK_REF_1',
      intentIds: [],
      reason: 'ambiguous',
    });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();

    await repository.markWalletFundingIntentReviewRequired({
      gatewayReference: 'PSK_REF_1',
      intentIds: ['intent-1'],
      reason: 'ambiguous',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'mark_wallet_funding_intents_review_required',
      {
        p_gateway_reference: 'PSK_REF_1',
        p_intent_ids: ['intent-1'],
        p_reason: 'ambiguous',
      }
    );
  });

  it('surfaces RPC errors for expiration and intent creation', async () => {
    const expireSupabase = createSupabaseMock({
      expireError: { message: 'permission denied' },
    });
    const expireRepository = createOrderWalletFundingIntentRepository(
      expireSupabase.client as never
    );

    await expect(
      expireRepository.expireStaleWalletFundingIntents({
        now: new Date('2026-05-26T12:00:00.000Z'),
      })
    ).rejects.toThrow('expire stale wallet funding intents failed');

    const createSupabase = createSupabaseMock({
      createError: { message: 'duplicate key' },
    });
    const createRepository = createOrderWalletFundingIntentRepository(
      createSupabase.client as never
    );

    await expect(
      createRepository.insertOrderWalletFundingIntent({
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
    ).rejects.toThrow('wallet funding intent insert failed');
  });

  it('throws on malformed database money and missing provider values', async () => {
    const activeIntentQuery = createQueryResult({
      data: { ...intentRow, expected_amount: 'not-money' },
    });
    const missingProviderQuery = createQueryResult({
      data: { ...intentRow, provider: null },
    });
    const supabase = createTableSupabaseMock({
      order_wallet_funding_intents: [activeIntentQuery, missingProviderQuery],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.findActiveOrderIntent({ orderId: 'order-1' })
    ).rejects.toThrow('Invalid intent expected amount');
    await expect(
      repository.getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'intent-1',
        merchantId: 'merchant-1',
      })
    ).rejects.toThrow('Missing wallet funding provider');
  });

  it('surfaces query and review-RPC errors', async () => {
    const savingsQuery = createQueryResult({
      data: null,
      error: { message: 'savings lookup failed' },
    });
    savingsQuery.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'savings lookup failed' },
    } as never);
    const supabase = createTableSupabaseMock({
      customer_wallets: [
        createQueryResult({
          data: null,
          error: { message: 'wallet lookup failed' },
        }),
      ],
      customer_savings_redemptions: [savingsQuery],
    });
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'review update failed' },
    } as never);
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.getWalletBalance({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
      })
    ).rejects.toThrow('customer wallet balance lookup failed');
    await expect(
      repository.getSavingsRedeemedAmount('order-1')
    ).rejects.toThrow('savings redemption lookup failed');
    await expect(
      repository.markWalletFundingIntentReviewRequired({
        gatewayReference: 'PSK_REF_1',
        intentIds: ['intent-1', 'intent-2'],
        reason: 'ambiguous',
      })
    ).rejects.toThrow('wallet funding intent review update failed');
  });
});
