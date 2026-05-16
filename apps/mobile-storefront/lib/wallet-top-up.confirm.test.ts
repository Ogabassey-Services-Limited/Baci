import { describe, expect, it } from '@jest/globals';
import { mockFetchWithTimeout } from '@/lib/wallet-top-up.test-utils';

const { confirmWalletTopUp } =
  require('@/lib/wallet-top-up') as typeof import('@/lib/wallet-top-up');

function getLastConfirmRequestBody() {
  const [, requestOptions] = mockFetchWithTimeout.mock.calls[0];
  if (
    typeof requestOptions !== 'object' ||
    requestOptions === null ||
    !('body' in requestOptions)
  ) {
    throw new Error('Expected wallet top-up confirm request body');
  }

  return JSON.parse(String(requestOptions.body)) as Record<string, unknown>;
}

describe('confirmWalletTopUp', () => {
  it('throws a clear error when confirm returns invalid JSON', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
    });

    await expect(
      confirmWalletTopUp({
        gateway: 'paystack',
        reference: 'WALLET-123',
      })
    ).rejects.toThrow(
      'Invalid server response (200 OK): Unexpected token < in JSON'
    );
  });

  it('confirms a successful wallet top-up response', async () => {
    mockFetchWithTimeout.mockResolvedValue({
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
      confirmWalletTopUp({
        gateway: 'paystack',
        merchantId: 'merchant-1',
        reference: 'WALLET-123',
      })
    ).resolves.toEqual({
      amount: 2500,
      reference: 'WALLET-123',
      status: 'successful',
      success: true,
      wallet: { balance: 5000 },
    });

    expect(getLastConfirmRequestBody()).toMatchObject({
      gateway: 'paystack',
      merchantId: 'merchant-1',
      reference: 'WALLET-123',
    });
    expect(getLastConfirmRequestBody()).not.toHaveProperty('merchantSlug');
  });

  it('preserves an explicit merchant slug when merchant id is also supplied', async () => {
    mockFetchWithTimeout.mockResolvedValue({
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

    await confirmWalletTopUp({
      gateway: 'paystack',
      merchantId: 'merchant-1',
      merchantSlug: 'explicit-store',
      reference: 'WALLET-123',
    });

    expect(getLastConfirmRequestBody()).toMatchObject({
      gateway: 'paystack',
      merchantId: 'merchant-1',
      merchantSlug: 'explicit-store',
      reference: 'WALLET-123',
    });
  });

  it('maps a 409 confirmation response to processing with the submitted reference', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: async () => ({
        error: 'Payment is not yet successful',
      }),
    });

    const result = await confirmWalletTopUp({
      gateway: 'korapay',
      reference: 'WALLET-123',
    });

    expect(result).toMatchObject({
      reference: 'WALLET-123',
      status: 'processing',
    });
  });

  it('throws the server error message for non-processing confirmation failures', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: 'Confirmation failed',
      }),
    });

    await expect(
      confirmWalletTopUp({
        gateway: 'paystack',
        reference: 'WALLET-123',
      })
    ).rejects.toThrow('Confirmation failed');
  });
});
