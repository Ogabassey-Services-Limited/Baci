import { describe, expect, it } from '@jest/globals';
import { mockFetchWithTimeout } from '@/lib/wallet-top-up.test-utils';

const { WalletTopUpStillProcessingError, waitForWalletTopUpConfirmation } =
  require('@/lib/wallet-top-up') as typeof import('@/lib/wallet-top-up');

describe('waitForWalletTopUpConfirmation', () => {
  it('polls until a wallet top-up confirmation succeeds', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          error: 'Payment is not yet successful',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          amount: 2500,
          reference: 'WALLET-123',
          status: 'successful',
          success: true,
          wallet: { balance: 5000 },
        }),
      });

    await expect(
      waitForWalletTopUpConfirmation({
        gateway: 'paystack',
        maxAttempts: 2,
        reference: 'WALLET-123',
      })
    ).resolves.toMatchObject({
      reference: 'WALLET-123',
      status: 'successful',
    });
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
  });

  it('throws a typed processing error after polling attempts are exhausted', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        error: 'Payment is not yet successful',
      }),
    });

    await expect(
      waitForWalletTopUpConfirmation({
        gateway: 'paystack',
        maxAttempts: 1,
        reference: 'WALLET-123',
      })
    ).rejects.toBeInstanceOf(WalletTopUpStillProcessingError);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('fails fast for non-retryable confirmation errors', async () => {
    expect.assertions(4);

    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: 'Payment verification failed',
      }),
    });

    let caughtError: unknown;
    try {
      await waitForWalletTopUpConfirmation({
        gateway: 'paystack',
        maxAttempts: 3,
        reference: 'WALLET-123',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError).not.toBeInstanceOf(WalletTopUpStillProcessingError);
    expect((caughtError as Error).message).toBe('Payment verification failed');
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });
});
