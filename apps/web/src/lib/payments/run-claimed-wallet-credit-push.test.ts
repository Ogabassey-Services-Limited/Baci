import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClaim = vi.fn();
const mockRelease = vi.fn();

vi.mock('@/lib/payments/claim-wallet-credit-push', () => ({
  claimWalletCreditPush: (...args: unknown[]) => mockClaim(...args),
}));

vi.mock('@/lib/payments/release-wallet-credit-push', () => ({
  releaseWalletCreditPush: (...args: unknown[]) => mockRelease(...args),
}));

import { runClaimedWalletCreditPush } from './run-claimed-wallet-credit-push';

const baseArgs = {
  allowInitialClaim: true,
  claimToken: 'claim-token-1',
  onFailure: vi.fn(),
  reference: 'WAL-123',
  transactionId: 'transaction-1',
};

describe('runClaimedWalletCreditPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClaim.mockResolvedValue({ status: 'claimed' });
    mockRelease.mockResolvedValue({ status: 'released' });
  });

  it('runs the notification only for the claim winner', async () => {
    const notify = vi.fn().mockResolvedValue({ status: 'sent' });

    await runClaimedWalletCreditPush({ ...baseArgs, notify });

    expect(mockClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        allowInitialClaim: true,
        claimToken: 'claim-token-1',
      })
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('releases a retryable notification failure with the same claim token', async () => {
    const notify = vi.fn().mockResolvedValue({ status: 'retryable_error' });

    await runClaimedWalletCreditPush({ ...baseArgs, notify });

    expect(mockRelease).toHaveBeenCalledWith({
      claimToken: 'claim-token-1',
      reference: 'WAL-123',
      transactionId: 'transaction-1',
    });
  });

  it('does not notify after another worker wins the claim', async () => {
    mockClaim.mockResolvedValue({ status: 'already_claimed' });
    const notify = vi.fn();

    await runClaimedWalletCreditPush({ ...baseArgs, notify });

    expect(notify).not.toHaveBeenCalled();
  });

  it('retries transient claim and release errors once', async () => {
    mockClaim
      .mockResolvedValueOnce({ error: 'claim reset', status: 'error' })
      .mockResolvedValueOnce({ status: 'claimed' });
    mockRelease
      .mockResolvedValueOnce({ error: 'release reset', status: 'error' })
      .mockResolvedValueOnce({ status: 'released' });

    await runClaimedWalletCreditPush({
      ...baseArgs,
      notify: vi.fn().mockResolvedValue({ status: 'retryable_error' }),
    });

    expect(mockClaim).toHaveBeenCalledTimes(2);
    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(baseArgs.onFailure).not.toHaveBeenCalled();
  });

  it('reports an exhausted claim retry without notifying', async () => {
    mockClaim.mockResolvedValue({
      error: 'database unavailable',
      status: 'error',
    });
    const notify = vi.fn();

    await runClaimedWalletCreditPush({ ...baseArgs, notify });

    expect(mockClaim).toHaveBeenCalledTimes(2);
    expect(notify).not.toHaveBeenCalled();
    expect(baseArgs.onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Wallet-credit push claim failed after retry: database unavailable',
      })
    );
  });

  it('reports an exhausted release retry', async () => {
    mockRelease.mockResolvedValue({
      error: 'database unavailable',
      status: 'error',
    });

    await runClaimedWalletCreditPush({
      ...baseArgs,
      notify: vi.fn().mockResolvedValue({ status: 'retryable_error' }),
    });

    expect(mockRelease).toHaveBeenCalledTimes(2);
    expect(baseArgs.onFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Wallet-credit push release failed after retry: database unavailable',
      })
    );
  });

  it('releases the claim and reports an unexpected notification error', async () => {
    const error = new Error('sender crashed');

    await runClaimedWalletCreditPush({
      ...baseArgs,
      notify: vi.fn().mockRejectedValue(error),
    });

    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(baseArgs.onFailure).toHaveBeenCalledWith(error);
  });
});
