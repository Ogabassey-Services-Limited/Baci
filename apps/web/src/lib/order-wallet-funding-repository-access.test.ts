import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRepository,
  intent,
} from '@/lib/order-wallet-funding-intents.test-utils';
import {
  expireStaleWalletFundingIntents,
  getOrderWalletFundingIntent,
  getRepository,
  isWalletOrderAutoDebitEnabled,
  markWalletFundingIntentReviewRequired,
} from '@/lib/order-wallet-funding-repository-access';

describe('order wallet funding repository access', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('throws when no repository or Supabase client is available', () => {
    expect(() => getRepository({})).toThrow('Supabase client is required');
  });

  // Tuple order: paystackEnabled, walletPaystackDvaEnabled, autoDebitEnabled, expected.
  it.each([
    [true, true, true, true],
    [false, true, true, false],
    [true, false, true, false],
    [true, true, false, false],
    [true, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [false, false, false, false],
  ])('only enables wallet auto-debit when all three payment flags are true', async (paystackEnabled, walletPaystackDvaEnabled, walletOrderAutoDebitEnabled, expected) => {
    await expect(
      isWalletOrderAutoDebitEnabled({
        merchantId: 'merchant-1',
        repository: createRepository({
          getPaymentSettings: vi.fn(async () => ({
            paystackEnabled,
            walletOrderAutoDebitEnabled,
            walletPaystackDvaEnabled,
          })),
        }),
      })
    ).resolves.toBe(expected);
  });

  it('propagates payment settings lookup failures', async () => {
    const repository = createRepository({
      getPaymentSettings: vi.fn(() =>
        Promise.reject(new Error('settings failed'))
      ),
    });

    await expect(
      isWalletOrderAutoDebitEnabled({
        merchantId: 'merchant-1',
        repository,
      })
    ).rejects.toThrow('settings failed');
  });

  it('delegates scoped intent polling to the repository', async () => {
    const repository = createRepository({
      getOrderWalletFundingIntent: vi.fn(async () =>
        intent({ id: 'intent-polled' })
      ),
    });

    await expect(
      getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'intent-polled',
        merchantId: 'merchant-1',
        repository,
      })
    ).resolves.toMatchObject({ id: 'intent-polled' });
    expect(repository.getOrderWalletFundingIntent).toHaveBeenCalledWith({
      customerId: 'customer-1',
      id: 'intent-polled',
      merchantId: 'merchant-1',
      repository,
    });
  });

  it('propagates intent polling failures', async () => {
    const repository = createRepository({
      getOrderWalletFundingIntent: vi.fn(() =>
        Promise.reject(new Error('intent failed'))
      ),
    });

    await expect(
      getOrderWalletFundingIntent({
        customerId: 'customer-1',
        id: 'intent-1',
        merchantId: 'merchant-1',
        repository,
      })
    ).rejects.toThrow('intent failed');
    expect(repository.getOrderWalletFundingIntent).toHaveBeenCalledWith({
      customerId: 'customer-1',
      id: 'intent-1',
      merchantId: 'merchant-1',
      repository,
    });
  });

  it('passes a provided now into stale intent expiry', async () => {
    const repository = createRepository();
    const now = new Date('2026-05-26T12:00:00.000Z');

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

  it('defaults stale intent expiry to the current time', async () => {
    const repository = createRepository();
    const now = new Date('2026-05-26T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    await expireStaleWalletFundingIntents({
      merchantId: 'merchant-1',
      repository,
    });

    expect(repository.expireStaleWalletFundingIntents).toHaveBeenCalledWith({
      customerId: undefined,
      merchantId: 'merchant-1',
      now,
      walletPaymentAccountId: undefined,
    });
  });

  it('propagates stale intent expiry failures with the default current time', async () => {
    const now = new Date('2026-05-26T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const repository = createRepository({
      expireStaleWalletFundingIntents: vi.fn(() =>
        Promise.reject(new Error('expire failed'))
      ),
    });

    await expect(
      expireStaleWalletFundingIntents({
        merchantId: 'merchant-1',
        repository,
      })
    ).rejects.toThrow('expire failed');
    expect(repository.expireStaleWalletFundingIntents).toHaveBeenCalledWith({
      customerId: undefined,
      merchantId: 'merchant-1',
      now,
      walletPaymentAccountId: undefined,
    });
  });

  it('delegates review marking to the repository', async () => {
    const repository = createRepository();

    await markWalletFundingIntentReviewRequired({
      gatewayReference: 'PSK_REF_1',
      intentIds: ['intent-1'],
      reason: 'ambiguous',
      repository,
    });

    expect(
      repository.markWalletFundingIntentReviewRequired
    ).toHaveBeenCalledWith({
      gatewayReference: 'PSK_REF_1',
      intentIds: ['intent-1'],
      reason: 'ambiguous',
      repository,
    });
  });

  it('propagates review marking failures', async () => {
    const repository = createRepository({
      markWalletFundingIntentReviewRequired: vi.fn(() =>
        Promise.reject(new Error('review failed'))
      ),
    });
    const args = {
      gatewayReference: 'PSK_REF_1',
      intentIds: ['intent-1'],
      reason: 'ambiguous',
      repository,
    };

    await expect(markWalletFundingIntentReviewRequired(args)).rejects.toThrow(
      'review failed'
    );
    expect(
      repository.markWalletFundingIntentReviewRequired
    ).toHaveBeenCalledWith(args);
  });
});
