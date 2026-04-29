import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MOBILE_TO_KUDA_PROVIDER } from '@/lib/network-utils';
import {
  chargeSavedVtuCard,
  confirmVtuCheckout,
  initializeVtuCheckout,
  listSavedVtuCards,
  normalizeVtuCheckoutPayload,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';

type MockFetchResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<Record<string, unknown>>;
};

type MockUserResult = {
  data: { user: { id: string } | null };
  error: Error | null;
};

type MockSessionResult = {
  data: { session: { access_token: string } | null };
};

const mockFetchWithTimeout =
  jest.fn<(...args: unknown[]) => Promise<MockFetchResponse>>();
const mockGetUser = jest.fn<() => Promise<MockUserResult>>();
const mockGetSession = jest.fn<() => Promise<MockSessionResult>>();

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
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
  });
});

describe('vtu-checkout service', () => {
  it('normalizes known mobile network providers before checkout', () => {
    expect(
      normalizeVtuCheckoutPayload({
        amount: 1000,
        networkProvider: 'mtn',
      })
    ).toMatchObject({ networkProvider: MOBILE_TO_KUDA_PROVIDER.mtn });
    expect(
      normalizeVtuCheckoutPayload({
        amount: 1000,
        networkProvider: 'airtel',
      })
    ).toMatchObject({ networkProvider: MOBILE_TO_KUDA_PROVIDER.airtel });
  });

  it('normalizes mixed-case network provider keys', () => {
    expect(
      normalizeVtuCheckoutPayload({ amount: 1000, networkProvider: 'MTN' })
    ).toMatchObject({ networkProvider: MOBILE_TO_KUDA_PROVIDER.mtn });
    expect(
      normalizeVtuCheckoutPayload({ amount: 1000, networkProvider: 'AirTel' })
    ).toMatchObject({ networkProvider: MOBILE_TO_KUDA_PROVIDER.airtel });
  });

  it('keeps missing, empty, and unknown network providers unchanged', () => {
    expect(normalizeVtuCheckoutPayload({ amount: 1000 })).not.toHaveProperty(
      'networkProvider'
    );
    expect(
      normalizeVtuCheckoutPayload({ amount: 1000, networkProvider: '' })
    ).toMatchObject({ networkProvider: '' });
    expect(
      normalizeVtuCheckoutPayload({ amount: 1000, networkProvider: 'unknown' })
    ).toMatchObject({ networkProvider: 'unknown' });
  });

  it('initializes VTU checkout with the authenticated token', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        authorization_url: 'https://paystack.com/pay/abc',
        gateway: 'paystack',
        reference: 'VTU-123',
        vtu_reference: 'REQ-123',
        vtu_transaction_id: 'vtu-1',
      }),
    });

    const result = await initializeVtuCheckout({
      amount: 1000,
      gateway: 'paystack',
      phoneNumber: '08012345678',
      networkProvider: 'mtn',
      type: 'airtime',
    });

    expect(result.reference).toBe('VTU-123');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'https://usebaci.com/api/vtu/checkout/initialize',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
    const checkoutRequest = mockFetchWithTimeout.mock.calls[0]?.[1] as {
      body: string;
    };
    expect(
      JSON.parse(checkoutRequest.body) as Record<string, unknown>
    ).toMatchObject({
      networkProvider: MOBILE_TO_KUDA_PROVIDER.mtn,
    });
  });

  it('confirms a successful VTU checkout', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        status: 'successful',
        reference: 'VTU-123',
        amount: 1000,
      }),
    });

    const result = await confirmVtuCheckout({
      gateway: 'paystack',
      reference: 'VTU-123',
    });

    expect(result.status).toBe('successful');
  });

  it('treats a not-yet-successful gateway confirmation as processing', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Payment is not yet successful',
        status: 'pending',
      }),
    });

    const result = await confirmVtuCheckout({
      gateway: 'paystack',
      reference: 'VTU-123',
    });

    expect(result).toMatchObject({
      reference: 'VTU-123',
      status: 'processing',
    });
  });

  it('throws a typed processing error instead of a payment failure after polling', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: 'VTU-123',
        status: 'processing',
      }),
    });

    await expect(
      waitForVtuConfirmation({
        gateway: 'paystack',
        maxAttempts: 1,
        reference: 'VTU-123',
      })
    ).rejects.toBeInstanceOf(VtuPaymentStillProcessingError);
  });

  it('lists saved cards for the current storefront', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        cards: [
          {
            id: 'card-1',
            provider: 'paystack',
            label: 'Access Bank ending 1234',
            brand: 'visa',
            bank: 'Access Bank',
            last4: '1234',
            exp_month: '08',
            exp_year: '2030',
            is_default: true,
          },
        ],
      }),
    });

    const result = await listSavedVtuCards();

    expect(result[0]?.label).toBe('Access Bank ending 1234');
  });

  it('handles saved-card charges that require extra authorization', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        requires_authorization: true,
        authorization_url: 'https://paystack.com/pay/auth',
        gateway: 'paystack',
        reference: 'VTU-123',
      }),
    });

    const result = await chargeSavedVtuCard({
      amount: 1000,
      phoneNumber: '08012345678',
      networkProvider: 'mtn',
      savedPaymentMethodId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'airtime',
    });

    expect(result).toMatchObject({
      authorization_url: 'https://paystack.com/pay/auth',
      requires_authorization: true,
    });
  });
});
