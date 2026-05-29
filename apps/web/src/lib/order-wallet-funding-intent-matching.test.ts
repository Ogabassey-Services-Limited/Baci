import { describe, expect, it, vi } from 'vitest';
import { findActiveWalletFundingIntentForTransfer } from '@/lib/order-wallet-funding-intent-matching';
import {
  createRepository,
  intent,
} from '@/lib/order-wallet-funding-intents.test-utils';

describe('findActiveWalletFundingIntentForTransfer', () => {
  it('returns none when no active intent fits the paid window and amount', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        intent({ expectedAmount: 15_000, fundedAmount: 0 }),
        intent({
          createdAt: '2026-05-26T11:00:00.000Z',
          expiresAt: '2026-05-26T11:30:00.000Z',
          id: 'intent-outside-window',
        }),
      ]),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 5_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
  });

  it('returns the single matching intent at the inclusive start boundary', async () => {
    const candidate = intent({
      createdAt: '2026-05-26T12:00:00.000Z',
      expiresAt: '2026-05-26T12:30:00.000Z',
      id: 'intent-match',
    });
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [candidate]),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 14_999.99,
        paidAt: new Date('2026-05-26T12:00:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ intent: candidate, kind: 'match' });
    expect(repository.expireStaleWalletFundingIntents).toHaveBeenCalledWith({
      now: new Date('2026-05-26T12:00:00.000Z'),
      walletPaymentAccountId: 'wallet-account-1',
    });
    expect(repository.findActiveWalletAccountIntents).toHaveBeenCalledWith({
      walletPaymentAccountId: 'wallet-account-1',
    });
  });

  it('excludes payments at the exclusive expiry boundary', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        intent({
          createdAt: '2026-05-26T12:00:00.000Z',
          expiresAt: '2026-05-26T12:30:00.000Z',
          id: 'intent-expired-boundary',
        }),
      ]),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 15_000,
        paidAt: new Date('2026-05-26T12:30:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
  });

  it('uses the one-kobo threshold for amount matching', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        intent({ id: 'intent-threshold' }),
      ]),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 14_999.98,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
  });

  it('returns ambiguous when multiple active intents fit', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        intent({ id: 'intent-1' }),
        intent({ id: 'intent-2' }),
      ]),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 15_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({
      intentIds: ['intent-1', 'intent-2'],
      kind: 'ambiguous',
    });
  });

  it('returns none for invalid transfer inputs without querying the repository', async () => {
    const repository = createRepository();

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: Number.NaN,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 15_000,
        paidAt: new Date('invalid'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 15_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: '',
      })
    ).resolves.toEqual({ kind: 'none' });

    expect(repository.expireStaleWalletFundingIntents).not.toHaveBeenCalled();
    expect(repository.findActiveWalletAccountIntents).not.toHaveBeenCalled();
  });

  it('propagates repository lookup errors after expiring stale intents', async () => {
    const lookupError = new Error('repository unavailable');
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(() => {
        throw lookupError;
      }),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 15_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).rejects.toThrow(lookupError);
    expect(repository.expireStaleWalletFundingIntents).toHaveBeenCalledWith({
      now: new Date('2026-05-26T12:05:00.000Z'),
      walletPaymentAccountId: 'wallet-account-1',
    });
  });
});
