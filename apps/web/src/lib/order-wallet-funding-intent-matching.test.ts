import { describe, expect, it, vi } from 'vitest';
import { findActiveWalletFundingIntentForTransfer } from '@/lib/order-wallet-funding-intent-matching';
import {
  createRepository,
  intent,
} from '@/lib/order-wallet-funding-intents.test-utils';

describe('findActiveWalletFundingIntentForTransfer', () => {
  it('matches a partial transfer below the remaining amount (finalizer accumulates)', async () => {
    const candidate = intent({
      expectedAmount: 15_000,
      fundedAmount: 0,
      id: 'intent-partial',
    });
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        candidate,
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
    ).resolves.toEqual({ intent: candidate, kind: 'match' });
  });

  it('returns none when every intent is outside the paid window', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
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

  it('matches an underfunded intent so follow-up transfers keep accumulating', async () => {
    const candidate = intent({
      expectedAmount: 15_000,
      fundedAmount: 5_000,
      id: 'intent-underfunded',
      status: 'underfunded',
    });
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [candidate]),
    });

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 4_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ intent: candidate, kind: 'match' });
  });

  it('returns none for zero and negative amounts without querying the repository', async () => {
    const repository = createRepository();

    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 0,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: -500,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });

    expect(repository.expireStaleWalletFundingIntents).not.toHaveBeenCalled();
    expect(repository.findActiveWalletAccountIntents).not.toHaveBeenCalled();
  });

  it('returns ambiguous when a transfer covers multiple active intents', async () => {
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

  it('matches the single intent a full-cover transfer fits when several are active', async () => {
    const small = intent({
      expectedAmount: 5_000,
      fundedAmount: 0,
      id: 'intent-small',
    });
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        small,
        intent({
          expectedAmount: 40_000,
          fundedAmount: 0,
          id: 'intent-large',
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
    ).resolves.toEqual({ intent: small, kind: 'match' });
  });

  it('treats a partial covering none of several active intents as a plain top-up', async () => {
    const repository = createRepository({
      findActiveWalletAccountIntents: vi.fn(async () => [
        intent({ expectedAmount: 15_000, fundedAmount: 0, id: 'intent-1' }),
        intent({ expectedAmount: 40_000, fundedAmount: 0, id: 'intent-2' }),
      ]),
    });

    // With multiple concurrent intents there is no safe attribution for a
    // partial — it credits the wallet without touching either intent.
    await expect(
      findActiveWalletFundingIntentForTransfer({
        amount: 2_000,
        paidAt: new Date('2026-05-26T12:05:00.000Z'),
        repository,
        walletPaymentAccountId: 'wallet-account-1',
      })
    ).resolves.toEqual({ kind: 'none' });
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
