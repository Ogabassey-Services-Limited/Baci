import { describe, expect, it, vi } from 'vitest';
import { createOrderWalletFundingIntentRepository } from '@/lib/order-wallet-funding-intent-repository';
import {
  createQueryResult,
  createTableSupabaseMock,
} from '@/lib/order-wallet-funding-intent-repository.test-utils';

describe('createOrderWalletFundingIntentRepository accounting reads', () => {
  it('normalizes payment settings and missing wallet balances', async () => {
    const rpc = vi
      .fn()
      .mockReturnValueOnce({
        maybeSingle: vi.fn(async () => ({
          data: {
            paystack_enabled: false,
            wallet_order_auto_debit_enabled: true,
            wallet_paystack_dva_enabled: true,
          },
          error: null,
        })),
      })
      .mockReturnValueOnce({
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      });
    const walletQuery = createQueryResult({ data: null });
    const supabase = createTableSupabaseMock({
      customer_wallets: [walletQuery],
    });
    const repository = createOrderWalletFundingIntentRepository({
      ...supabase.client,
      rpc,
    } as never);

    await expect(repository.getPaymentSettings('merchant-1')).resolves.toEqual({
      paystackEnabled: false,
      walletOrderAutoDebitEnabled: true,
      walletPaystackDvaEnabled: true,
    });
    await expect(repository.getPaymentSettings('merchant-1')).resolves.toEqual({
      paystackEnabled: true,
      walletOrderAutoDebitEnabled: false,
      walletPaystackDvaEnabled: false,
    });
    await expect(
      repository.getWalletBalance({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
      })
    ).resolves.toBe(0);
  });

  it('surfaces payment settings and wallet balance query failures', async () => {
    const rpc = vi.fn().mockReturnValueOnce({
      maybeSingle: vi.fn(async () => ({
        data: null,
        error: { message: 'settings failed' },
      })),
    });
    const supabase = createTableSupabaseMock({
      customer_wallets: [
        createQueryResult({
          data: null,
          error: { message: 'wallet failed' },
        }),
      ],
    });
    const repository = createOrderWalletFundingIntentRepository({
      ...supabase.client,
      rpc,
    } as never);

    await expect(repository.getPaymentSettings('merchant-1')).rejects.toThrow(
      'wallet funding settings lookup failed: settings failed'
    );
    await expect(
      repository.getWalletBalance({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
      })
    ).rejects.toThrow('customer wallet balance lookup failed: wallet failed');
  });

  it('sums savings redemptions and detects existing wallet redemptions', async () => {
    const savingsQuery = createQueryResult({
      data: [{ amount: 1500 }, { amount: '2500' }],
    });
    savingsQuery.eq.mockResolvedValueOnce({
      data: [{ amount: 1500 }, { amount: '2500' }],
      error: null,
    } as never);
    const supabase = createTableSupabaseMock({
      customer_savings_redemptions: [savingsQuery],
      customer_wallet_transactions: [
        createQueryResult({ data: { id: 'wallet-txn-1' } }),
        createQueryResult({ data: null }),
      ],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(repository.getSavingsRedeemedAmount('order-1')).resolves.toBe(
      4000
    );
    await expect(
      repository.hasWalletOrderRedemption({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
      })
    ).resolves.toBe(true);
    await expect(
      repository.hasWalletOrderRedemption({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-2',
      })
    ).resolves.toBe(false);
  });

  it('surfaces savings and wallet redemption query failures', async () => {
    const savingsQuery = createQueryResult({ data: null });
    savingsQuery.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'savings failed' },
    } as never);
    const malformedSavingsQuery = createQueryResult({ data: null });
    malformedSavingsQuery.eq.mockResolvedValueOnce({
      data: [{ amount: 'bad' }],
      error: null,
    } as never);
    const supabase = createTableSupabaseMock({
      customer_savings_redemptions: [savingsQuery, malformedSavingsQuery],
      customer_wallet_transactions: [
        createQueryResult({
          data: null,
          error: { message: 'redemption failed' },
        }),
      ],
    });
    const repository = createOrderWalletFundingIntentRepository(
      supabase.client as never
    );

    await expect(
      repository.getSavingsRedeemedAmount('order-1')
    ).rejects.toThrow('savings redemption lookup failed: savings failed');
    await expect(
      repository.getSavingsRedeemedAmount('order-1')
    ).rejects.toThrow('Invalid savings redemption amount');
    await expect(
      repository.hasWalletOrderRedemption({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
      })
    ).rejects.toThrow(
      'wallet order redemption lookup failed: redemption failed'
    );
  });
});
