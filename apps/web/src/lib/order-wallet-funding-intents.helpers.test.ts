import { describe, expect, it, vi } from 'vitest';
import {
  expireStaleWalletFundingIntents,
  findActiveWalletFundingIntentForTransfer,
  getOrderWalletFundingIntent,
  isWalletOrderAutoDebitEnabled,
  markWalletFundingIntentReviewRequired,
} from '@/lib/order-wallet-funding-intents';
import {
  createRepository,
  intent,
} from '@/lib/order-wallet-funding-intents.test-utils';

describe('order wallet funding intent helpers', () => {
  it('normalizes the payment settings gate', async () => {
    await expect(
      isWalletOrderAutoDebitEnabled({
        merchantId: 'merchant-1',
        repository: createRepository(),
      })
    ).resolves.toBe(true);

    await expect(
      isWalletOrderAutoDebitEnabled({
        merchantId: 'merchant-1',
        repository: createRepository({
          getPaymentSettings: vi.fn(async () => ({
            paystackEnabled: false,
            walletOrderAutoDebitEnabled: true,
            walletPaystackDvaEnabled: true,
          })),
        }),
      })
    ).resolves.toBe(false);
  });

  it('propagates payment settings lookup errors', async () => {
    const dbError = new Error('db');

    await expect(
      isWalletOrderAutoDebitEnabled({
        merchantId: 'merchant-1',
        repository: createRepository({
          getPaymentSettings: vi.fn(() => Promise.reject(dbError)),
        }),
      })
    ).rejects.toThrow('db');
  });

  it('returns an intent for polling through the repository', async () => {
    await expect(
      getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'intent-1',
        merchantId: 'merchant-1',
        repository: createRepository(),
      })
    ).resolves.toMatchObject({ id: 'intent-1' });
  });

  it('propagates scoped poll lookup errors', async () => {
    const dbError = new Error('db');

    await expect(
      getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'intent-1',
        merchantId: 'merchant-1',
        repository: createRepository({
          getOrderWalletFundingIntent: vi.fn(() => Promise.reject(dbError)),
        }),
      })
    ).rejects.toThrow('db');
  });

  it('expires stale intents through the repository before scoped polling', async () => {
    const repository = createRepository();
    const now = new Date('2026-05-26T12:35:00.000Z');

    await expireStaleWalletFundingIntents({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      now,
      repository,
    });

    expect(repository.expireStaleWalletFundingIntents).toHaveBeenCalledWith({
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      now,
      walletPaymentAccountId: undefined,
    });
  });

  it('propagates stale intent expiry errors', async () => {
    const dbError = new Error('db');

    await expect(
      expireStaleWalletFundingIntents({
        customerId: 'customer-1',
        merchantId: 'merchant-1',
        repository: createRepository({
          expireStaleWalletFundingIntents: vi.fn(() => Promise.reject(dbError)),
        }),
      })
    ).rejects.toThrow('db');
  });

  it('marks ambiguous intent matches for review', async () => {
    const repository = createRepository();

    await markWalletFundingIntentReviewRequired({
      gatewayReference: 'PSK_REF_1',
      intentIds: ['intent-1', 'intent-2'],
      reason: 'ambiguous wallet funding match',
      repository,
    });

    expect(repository.markWalletFundingIntentReviewRequired).toHaveBeenCalled();
  });

  it('propagates review-marking errors', async () => {
    const dbError = new Error('db');

    await expect(
      markWalletFundingIntentReviewRequired({
        gatewayReference: 'PSK_REF_1',
        intentIds: ['intent-1'],
        reason: 'ambiguous wallet funding match',
        repository: createRepository({
          markWalletFundingIntentReviewRequired: vi.fn(() =>
            Promise.reject(dbError)
          ),
        }),
      })
    ).rejects.toThrow('db');
  });

  it('matches a single active wallet intent by paid time and remaining expected amount', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        intent({ id: 'intent-match' }),
        intent({
          createdAt: '2026-05-26T11:00:00.000Z',
          expectedAmount: 25_000,
          expiresAt: '2026-05-26T11:30:00.000Z',
          id: 'intent-expired-window',
        }),
      ]),
    });

    const result = await findActiveWalletFundingIntentForTransfer({
      amount: 15_000,
      paidAt: new Date('2026-05-26T12:05:00.000Z'),
      repository,
      walletPaymentAccountId: 'wallet-account-1',
    });

    expect(result.kind).toBe('match');
    if (result.kind !== 'match') throw new Error('expected match');
    expect(result.intent.id).toBe('intent-match');
  });

  it('propagates active wallet intent lookup errors during transfer matching', async () => {
    const dbError = new Error('db');

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 15_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository: createRepository({
          findActiveWalletAccountIntents: vi.fn(() => Promise.reject(dbError)),
        }),
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).rejects.toThrow('db');
  });

  it('returns ambiguous instead of guessing when multiple active intents fit the transfer', async () => {
    const result = await findActiveWalletFundingIntentForTransfer({
      amount: 15_000,
      paidAt: new Date('2026-05-26T12:05:00.000Z'),
      repository: createRepository({
        findActiveWalletAccountIntents: vi.fn(async () => [
          intent({ id: 'intent-1' }),
          intent({ id: 'intent-2' }),
        ]),
      }),
      walletPaymentAccountId: 'wallet-account-1',
    });

    expect(result).toEqual({
      intentIds: ['intent-1', 'intent-2'],
      kind: 'ambiguous',
    });
  });

  it('matches a partial transfer against the in-window intent and skips expired windows', async () => {
    const candidate = intent({ expectedAmount: 15_000, fundedAmount: 0 });
    const result = await findActiveWalletFundingIntentForTransfer({
      amount: 5_000,
      paidAt: new Date('2026-05-26T12:05:00.000Z'),
      repository: createRepository({
        findActiveWalletAccountIntents: vi.fn(async () => [
          candidate,
          intent({
            createdAt: '2026-05-26T11:00:00.000Z',
            expiresAt: '2026-05-26T11:30:00.000Z',
            id: 'intent-expired-window',
          }),
        ]),
      }),
      walletPaymentAccountId: 'wallet-account-1',
    });

    // Partial transfers accumulate on the intent; the finalizer only debits
    // once the wallet balance covers target_order_amount.
    expect(result).toEqual({ intent: candidate, kind: 'match' });
  });
});
