import { jest } from '@jest/globals';
import { AuthRefreshDiscardedError, type Session } from '@supabase/supabase-js';

const mockGetUser = jest.fn<
  (jwt?: string) => Promise<{
    data: { user: { id: string } | null };
    error: Error | null;
  }>
>(() => new Promise<never>(() => undefined));
const mockGetSession =
  jest.fn<() => Promise<{ data: { session: Session | null } }>>();
const mockRefreshSession = jest.fn<
  () => Promise<{
    data: { session: Session | null };
    error: Error | null;
  }>
>(() => new Promise<never>(() => undefined));
const mockFetchWithRetry = jest.fn<
  (
    url: string,
    init: { body: string; headers: Record<string, string> },
    options: unknown
  ) => Promise<unknown>
>(async () => ({
  json: async () => ({
    amountDueToGateway: 102_000,
    order: {
      created_at: '2026-08-30T00:00:00Z',
      id: 'order-1',
      order_number: 'ORD-001',
      payment_status: 'unpaid',
      shipping_status: 'pending',
      total: 102_000,
      tracking_token: null,
    },
    wallet: null,
  }),
  ok: true,
  status: 200,
}));

const orderRequest = {
  customer_email: 'buyer@example.com',
  customer_name: 'Buyer',
  customer_phone: '+2348012345678',
  items: [
    {
      id: 'product-1',
      name: 'Phone',
      price: 100_000,
      quantity: 1,
    },
  ],
  payment_method: 'card' as const,
  shipping_address: {
    address: '1 Test Street',
    city: 'Lagos',
    firstName: 'Test',
    lastName: 'Buyer',
    state: 'Lagos',
  },
  shipping_fee: 2_000,
  source: 'mobile' as const,
  subtotal: 100_000,
};

function sessionFixture(
  accessToken: string,
  refreshToken: string,
  userId = 'user-a'
): Session {
  return {
    access_token: accessToken,
    expires_at: 1_800_000_000,
    expires_in: 3_600,
    refresh_token: refreshToken,
    token_type: 'bearer',
    user: {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-08-30T00:00:00Z',
      id: userId,
      role: 'authenticated',
      updated_at: '2026-08-30T00:00:00Z',
      user_metadata: {},
    },
  };
}

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { apiUrl: 'https://test.api', merchantId: 'merchant-1' },
    },
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'test-uuid',
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/lib/offline-queue', () => ({
  offlineQueue: { enqueue: jest.fn() },
}));

jest.mock('@/services/analytics', () => ({
  trackError: jest.fn(),
  trackEvent: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      refreshSession: mockRefreshSession,
    },
  },
  supabaseAuthStorage: {},
  supabaseAuthStorageKey: 'auth-key',
}));

jest.mock('@/lib/api', () => ({
  ApiError: class extends Error {},
  DEFAULT_TIMEOUT: 30_000,
  NetworkError: class extends Error {},
  RetryExhaustedError: class extends Error {},
  TimeoutError: class extends Error {},
  fetchWithRetry: mockFetchWithRetry,
}));

jest.mock('./orders-session', () => ({
  getCheckoutStoredSession: async () => {
    const { data } = await mockGetSession();
    return data.session;
  },
}));

const { createOrder } =
  jest.requireActual<typeof import('./orders')>('./orders');

describe('createOrder checkout auth fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockImplementation(() => new Promise<never>(() => undefined));
    mockRefreshSession.mockImplementation(
      () => new Promise<never>(() => undefined)
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reaches the order request without queuing getUser behind a timed-out refresh', async () => {
    jest.useFakeTimers();
    mockGetSession.mockResolvedValue({
      data: {
        session: sessionFixture('stored-token', 'refresh-token'),
      },
    });

    const firstResult = createOrder(orderRequest);
    await jest.advanceTimersByTimeAsync(9_000);

    await expect(firstResult).resolves.toMatchObject({
      order: { id: 'order-1' },
    });

    const secondResult = createOrder(orderRequest);
    await jest.advanceTimersByTimeAsync(9_000);
    await expect(secondResult).resolves.toMatchObject({
      order: { id: 'order-1' },
    });

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRefreshSession).toHaveBeenCalledTimes(2);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);
    const firstRequestHeaders = mockFetchWithRetry.mock.calls[0]?.[1]?.headers;
    expect(firstRequestHeaders).not.toHaveProperty('Authorization');
    const secondRequestHeaders = mockFetchWithRetry.mock.calls[1]?.[1]?.headers;
    expect(secondRequestHeaders).not.toHaveProperty('Authorization');
  });

  it('uses a same-account session rotated after the checkout session read', async () => {
    const capturedSession = sessionFixture(
      'captured-token',
      'captured-refresh-token'
    );
    const rotatedSession = sessionFixture(
      'rotated-token',
      'rotated-refresh-token'
    );
    mockGetSession
      .mockResolvedValueOnce({ data: { session: capturedSession } })
      .mockResolvedValueOnce({ data: { session: rotatedSession } });
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRefreshDiscardedError(),
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-a' } },
      error: null,
    });

    await expect(createOrder(orderRequest)).resolves.toMatchObject({
      order: { id: 'order-1' },
    });

    expect(mockFetchWithRetry.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer rotated-token',
    });
    expect(mockGetUser).toHaveBeenCalledWith('rotated-token');
  });

  it('validates the captured checkout bearer when auth storage switches accounts', async () => {
    const accountASession = sessionFixture(
      'account-a-token',
      'account-a-refresh-token',
      'user-a'
    );
    mockGetSession.mockResolvedValue({ data: { session: accountASession } });
    mockRefreshSession.mockResolvedValue({
      data: { session: accountASession },
      error: null,
    });
    mockGetUser.mockImplementation(async (jwt) => ({
      data: { user: { id: jwt ? 'user-a' : 'user-b' } },
      error: null,
    }));

    await expect(createOrder(orderRequest)).resolves.toMatchObject({
      order: { id: 'order-1' },
    });

    expect(mockGetUser).toHaveBeenCalledWith('account-a-token');
    expect(mockFetchWithRetry.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer account-a-token',
    });
    expect(
      JSON.parse(mockFetchWithRetry.mock.calls[0]?.[1]?.body ?? '{}') as Record<
        string,
        unknown
      >
    ).toMatchObject({ user_id: 'user-a' });
  });
});
