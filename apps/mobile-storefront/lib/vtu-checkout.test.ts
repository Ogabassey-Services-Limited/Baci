import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { MOBILE_TO_KUDA_PROVIDER } from '@/lib/network-utils';
import { HttpError, NetworkError, TimeoutError } from '@/lib/fetch-with-timeout';
import {
  chargeSavedVtuCard,
  chargeWalletForVtu,
  computeVtuWalletAmount,
  confirmVtuCheckout,
  initializeVtuCheckout,
  listSavedVtuCards,
  normalizeVtuCheckoutPayload,
  shouldRotateWalletIdempotencyKeyForError,
  VTU_CHECKOUT_INITIALIZE_URL,
  VTU_CHECKOUT_WALLET_ONLY_URL,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';

type MockFetchResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<Record<string, unknown>>;
};

type JsonRequestInit = RequestInit & {
  body: string;
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

function getMockRequestInit(callIndex = 0): JsonRequestInit {
  const requestInit = mockFetchWithTimeout.mock.calls[callIndex]?.[1];
  expect(requestInit).toHaveProperty('body');
  if (!requestInit || typeof (requestInit as RequestInit).body !== 'string') {
    throw new Error('Expected request body to be a JSON string');
  }
  return requestInit as JsonRequestInit;
}

function parseMockRequestBody(callIndex = 0): Record<string, unknown> {
  const checkoutRequest = getMockRequestInit(callIndex);
  return JSON.parse(checkoutRequest.body) as Record<string, unknown>;
}

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

jest.mock('@/lib/fetch-with-timeout', () => {
  const actual = jest.requireActual<
    typeof import('@/lib/fetch-with-timeout')
  >('@/lib/fetch-with-timeout');
  return {
    ...actual,
    fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
  };
});

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

afterEach(() => {
  jest.useRealTimers();
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
      VTU_CHECKOUT_INITIALIZE_URL,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
    expect(parseMockRequestBody()).toMatchObject({
      networkProvider: MOBILE_TO_KUDA_PROVIDER.mtn,
    });
  });

  it('sends bank transfer as a utility checkout gateway while using Paystack for confirmation', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        authorization_url: 'https://paystack.com/pay/bank-transfer',
        gateway: 'paystack',
        reference: 'VTU-BANK-123',
        vtu_reference: 'REQ-BANK-123',
        vtu_transaction_id: 'vtu-bank-1',
      }),
    });

    const result = await initializeVtuCheckout({
      amount: 1000,
      gateway: 'bank_transfer',
      phoneNumber: '08012345678',
      networkProvider: 'mtn',
      type: 'airtime',
    });

    expect(result.gateway).toBe('paystack');
    expect(parseMockRequestBody()).toMatchObject({
      gateway: 'bank_transfer',
    });
  });

  it('confirms a successful VTU checkout', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        status: 'SUCCESSFUL',
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

  it('throws a clear error for non-string confirmation status', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: 'VTU-123',
        status: 123,
      }),
    });

    await expect(
      confirmVtuCheckout({
        gateway: 'paystack',
        reference: 'VTU-123',
      })
    ).rejects.toThrow('Unexpected VTU checkout status: 123');
  });

  it('throws a clear error for unexpected checkout statuses', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: 'VTU-123',
        status: 'failed',
      }),
    });

    await expect(
      confirmVtuCheckout({
        gateway: 'paystack',
        reference: 'VTU-123',
      })
    ).rejects.toThrow('Unexpected VTU checkout status: failed');
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

  it('does not wait after the final polling attempt', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        reference: 'VTU-123',
        status: 'processing',
      }),
    });

    try {
      const confirmation = expect(
        waitForVtuConfirmation({
        gateway: 'paystack',
        maxAttempts: 1,
        reference: 'VTU-123',
        })
      ).rejects.toBeInstanceOf(VtuPaymentStillProcessingError);

      await jest.runOnlyPendingTimersAsync();

      await confirmation;
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      setTimeoutSpy.mockRestore();
    }
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

  // Phase B.8 — wallet-payment threading. Three behaviours pinned at
  // the network layer:
  //   1. Hybrid initialize forwards walletAmount to the server.
  //   2. Card-only initialize strips walletAmount entirely (no
  //      `walletAmount: 0` noise; mirrors orders' guard).
  //   3. Wallet-only POSTs to the dedicated route with a fresh
  //      Idempotency-Key header.

  it('initializeVtuCheckout: forwards walletAmount when positive (hybrid)', async () => {
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

    await initializeVtuCheckout({
      amount: 1000,
      gateway: 'paystack',
      networkProvider: 'mtn',
      phoneNumber: '08012345678',
      type: 'airtime',
      walletAmount: 300,
    });

    expect(parseMockRequestBody()).toMatchObject({
      walletAmount: 300,
      amount: 1000,
    });
  });

  it('initializeVtuCheckout: strips walletAmount when 0 (card-only)', async () => {
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

    await initializeVtuCheckout({
      amount: 1000,
      gateway: 'paystack',
      networkProvider: 'mtn',
      phoneNumber: '08012345678',
      type: 'airtime',
      walletAmount: 0,
    });

    expect(parseMockRequestBody()).not.toHaveProperty('walletAmount');
  });

  it('chargeWalletForVtu: posts to wallet-only with the caller-supplied Idempotency-Key header', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'successful',
        reference: 'VTU-456',
        amount: 1000,
      }),
    });

    // Caller-supplied UUID — the contract change. The form
    // controller holds this key in a ref so a network failure
    // doesn't lose it; chargeWalletForVtu is a pure transport.
    const idempotencyKey = '11111111-2222-3333-4444-555555555555';
    const result = await chargeWalletForVtu({
      amount: 1000,
      networkProvider: 'mtn',
      phoneNumber: '08012345678',
      type: 'airtime',
      walletAmount: 1000,
      idempotencyKey,
    });

    expect(result).toMatchObject({
      status: 'successful',
      reference: 'VTU-456',
    });
    const [url, init] = mockFetchWithTimeout.mock.calls[0] ?? [];
    expect(url).toBe(VTU_CHECKOUT_WALLET_ONLY_URL);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe(idempotencyKey);
    const body = parseMockRequestBody();
    expect(body).toMatchObject({
      walletAmount: 1000,
      amount: 1000,
    });
    // The key MUST stay in the header, NOT be sent as a request
    // body field — leaking it into the body would defeat the
    // schema's parsed shape and could expose the key in logs.
    expect(body).not.toHaveProperty('idempotencyKey');
  });
});

describe('computeVtuWalletAmount', () => {
  it('clamps a stale selection amount down to the current bill total', () => {
    // User enabled wallet for ₦1000 plan, then switched to a ₦500
    // plan — the captured selection.amount is now larger than the
    // bill. Without clamping the server would 400 on
    // walletAmount > amount.
    expect(computeVtuWalletAmount(1000, 500)).toBe(500);
  });

  it('passes through a selection amount within the bill total', () => {
    expect(computeVtuWalletAmount(300, 1000)).toBe(300);
  });

  it('treats wallet-toggle-off (selection 0 or undefined) as no wallet contribution', () => {
    expect(computeVtuWalletAmount(0, 1000)).toBe(0);
    expect(computeVtuWalletAmount(undefined, 1000)).toBe(0);
  });

  it('rejects negative or non-finite inputs by returning 0', () => {
    expect(computeVtuWalletAmount(-1, 1000)).toBe(0);
    expect(computeVtuWalletAmount(Number.NaN, 1000)).toBe(0);
    expect(computeVtuWalletAmount(500, Number.NaN)).toBe(0);
    expect(computeVtuWalletAmount(500, 0)).toBe(0);
  });
});

describe('shouldRotateWalletIdempotencyKeyForError', () => {
  // The contract: keep the key (return false) for any failure that
  // could leave server state in flight; only rotate (return true) on
  // 4xx HTTP responses where the request was rejected before any
  // state was created.

  it('returns true for HTTP 400-499 (request rejected, no server state)', () => {
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(400, 'bad'))
    ).toBe(true);
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(401, 'auth'))
    ).toBe(true);
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(422, 'invalid'))
    ).toBe(true);
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(499, 'closed'))
    ).toBe(true);
  });

  it('returns false for HTTP 5xx — server may have persisted partial state', () => {
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(500, 'oops'))
    ).toBe(false);
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(502, 'gateway'))
    ).toBe(false);
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(503, 'unavail'))
    ).toBe(false);
    expect(
      shouldRotateWalletIdempotencyKeyForError(new HttpError(504, 'timeout'))
    ).toBe(false);
  });

  it('returns false for network errors — request may not have reached the server', () => {
    expect(
      shouldRotateWalletIdempotencyKeyForError(new NetworkError('offline'))
    ).toBe(false);
  });

  it('returns false for timeout errors — request status is unknown', () => {
    expect(
      shouldRotateWalletIdempotencyKeyForError(new TimeoutError(30000))
    ).toBe(false);
  });

  it('returns false for unknown / non-HTTP errors — fail safe by keeping the key', () => {
    expect(
      shouldRotateWalletIdempotencyKeyForError(new Error('parse failed'))
    ).toBe(false);
    expect(shouldRotateWalletIdempotencyKeyForError('bare string')).toBe(false);
    expect(shouldRotateWalletIdempotencyKeyForError(undefined)).toBe(false);
    expect(shouldRotateWalletIdempotencyKeyForError(null)).toBe(false);
  });
});
