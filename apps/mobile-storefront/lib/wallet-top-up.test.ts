import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  confirmWalletTopUp,
  initializeWalletTopUp,
  WalletTopUpStillProcessingError,
  waitForWalletTopUpConfirmation,
} from '@/lib/wallet-top-up';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  statusText?: string;
  json: () => Promise<Record<string, unknown>>;
};

type MockUserResult = {
  data: { user: { id: string } | null };
  error: Error | null;
};

type MockSessionResult = {
  data: { session: { access_token: string } | null };
  error: Error | null;
};

const mockFetchWithTimeout =
  jest.fn<(...args: unknown[]) => Promise<MockFetchResponse>>();
const mockGetUser = jest.fn<() => Promise<MockUserResult>>();
const mockGetSession = jest.fn<() => Promise<MockSessionResult>>();

jest.mock('@/env', () => ({
  EXPO_PUBLIC_API_URL: 'https://usebaci.com',
}));

jest.mock('@/lib/config', () => ({
  CONFIG: {
    MERCHANT_SLUG: 'demo-store',
  },
}));

jest.mock('@/lib/fetch-with-timeout', () => ({
  DEFAULT_TIMEOUT: 30000,
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      getSession: () => mockGetSession(),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'token-123' } },
    error: null,
  });
});

describe('wallet top-up client', () => {
  it('initializes a wallet top-up and returns checkout details', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        authorization_url: 'https://checkout.example.com/pay',
        checkout_url: 'https://checkout.example.com/pay',
        gateway: 'paystack',
        reference: 'WALLET-123',
        success: true,
      }),
    });

    await expect(
      initializeWalletTopUp({
        amount: 2500,
        customerName: 'Test Customer',
        customerPhone: '08012345678',
        gateway: 'paystack',
      })
    ).resolves.toEqual({
      authorization_url: 'https://checkout.example.com/pay',
      checkout_url: 'https://checkout.example.com/pay',
      gateway: 'paystack',
      reference: 'WALLET-123',
      success: true,
    });
  });

  it('throws the server error message when initialize returns a non-OK response', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: 'Amount must be at least NGN 100.',
      }),
    });

    await expect(
      initializeWalletTopUp({
        amount: 50,
        customerName: 'Test Customer',
        customerPhone: '08012345678',
        gateway: 'paystack',
      })
    ).rejects.toThrow('Amount must be at least NGN 100.');

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://usebaci.com/api/storefront/customer/wallet/top-up/initialize',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
        method: 'POST',
      })
    );
  });

  it('throws before initializing when the authenticated user is missing', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      initializeWalletTopUp({
        amount: 2500,
        customerName: 'Test Customer',
        customerPhone: '08012345678',
        gateway: 'paystack',
      })
    ).rejects.toThrow('Authentication required. Please sign in again.');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('throws before initializing when auth lookup fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error('auth failed'),
    });

    await expect(
      initializeWalletTopUp({
        amount: 2500,
        customerName: 'Test Customer',
        customerPhone: '08012345678',
        gateway: 'paystack',
      })
    ).rejects.toThrow('Authentication required. Please sign in again.');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('bubbles network errors from wallet top-up initialization', async () => {
    mockFetchWithTimeout.mockRejectedValue(new Error('network failed'));

    await expect(
      initializeWalletTopUp({
        amount: 2500,
        customerName: 'Test Customer',
        customerPhone: '08012345678',
        gateway: 'paystack',
      })
    ).rejects.toThrow('network failed');
  });

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
        reference: 'WALLET-123',
      })
    ).resolves.toEqual({
      amount: 2500,
      reference: 'WALLET-123',
      status: 'successful',
      success: true,
      wallet: { balance: 5000 },
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
  });

  it('throws when the auth session is unavailable', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      initializeWalletTopUp({
        amount: 2500,
        gateway: 'paystack',
      })
    ).rejects.toThrow('Authentication required. Please sign in again.');
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});
