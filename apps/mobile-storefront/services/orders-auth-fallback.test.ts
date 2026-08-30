import { jest } from '@jest/globals';
import type { Session } from '@supabase/supabase-js';

const mockGetUser = jest.fn(() => new Promise<never>(() => undefined));
const mockGetSession =
  jest.fn<() => Promise<{ data: { session: Session | null } }>>();
const mockRefreshSession = jest.fn(() => new Promise<never>(() => undefined));
const mockFetchWithRetry = jest.fn<
  (
    url: string,
    init: { headers: Record<string, string> },
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
}));

jest.mock('@/lib/api', () => ({
  ApiError: class extends Error {},
  DEFAULT_TIMEOUT: 30_000,
  NetworkError: class extends Error {},
  RetryExhaustedError: class extends Error {},
  TimeoutError: class extends Error {},
  fetchWithRetry: mockFetchWithRetry,
}));

describe('createOrder checkout auth fallback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reaches the order request without queuing getUser behind a timed-out refresh', async () => {
    const nativeSetTimeout = global.setTimeout;
    const timeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback, delay, ...args) =>
        nativeSetTimeout(callback, delay === 5_000 ? 0 : delay, ...args)
      );
    const { createOrder } = require('./orders') as typeof import('./orders');
    mockGetSession
      .mockResolvedValueOnce({
        data: {
          session: {
            access_token: 'stored-token',
            user: { id: 'user-a' },
          } as Session,
        },
      })
      .mockImplementationOnce(() => new Promise<never>(() => undefined));

    const request: Parameters<typeof createOrder>[0] = {
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
      payment_method: 'card',
      shipping_address: {
        address: '1 Test Street',
        city: 'Lagos',
        firstName: 'Test',
        lastName: 'Buyer',
        state: 'Lagos',
      },
      shipping_fee: 2_000,
      source: 'mobile',
      subtotal: 100_000,
    };

    const firstResult = createOrder(request);

    await expect(firstResult).resolves.toMatchObject({
      order: { id: 'order-1' },
    });

    const secondResult = createOrder(request);
    await expect(secondResult).resolves.toMatchObject({
      order: { id: 'order-1' },
    });

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);
    expect(mockFetchWithRetry).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/api\/orders$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stored-token',
        }),
      }),
      expect.objectContaining({ maxRetries: 0, timeout: 30_000 })
    );
    const secondRequestHeaders = mockFetchWithRetry.mock.calls[1]?.[1]?.headers;
    expect(secondRequestHeaders).not.toHaveProperty('Authorization');
  });
});
