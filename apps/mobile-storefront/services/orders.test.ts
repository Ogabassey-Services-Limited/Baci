// Mock dependencies before importing
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { merchantId: 'merchant-1', apiUrl: 'https://test.api' },
    },
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: jest.fn(),
  trackError: jest.fn(),
}));

jest.mock('@/lib/offline-queue', () => ({
  offlineQueue: { enqueue: jest.fn() },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'token-123' } },
        error: null,
      }),
    },
  },
}));

const mockFetchResponse = {
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({
    order: {
      id: 'order-1',
      order_number: 'ORD-001',
      total: 720000,
      payment_status: 'unpaid',
      shipping_status: 'pending',
      created_at: '2026-03-31T00:00:00Z',
      tracking_token: null,
    },
    wallet: null,
    amountDueToGateway: 720000,
  }),
};

jest.mock('@/lib/api', () => ({
  fetchWithRetry: jest.fn().mockResolvedValue(mockFetchResponse),
  DEFAULT_TIMEOUT: 30000,
  ApiError: class extends Error {
    code: string;
    constructor(m: string, c: string) {
      super(m);
      this.code = c;
    }
  },
  NetworkError: class extends Error {},
  RetryExhaustedError: class extends Error {},
  TimeoutError: class extends Error {},
}));

describe('createOrder — variant_attributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchResponse.json.mockResolvedValue({
      order: {
        id: 'order-1',
        order_number: 'ORD-001',
        total: 720000,
        payment_status: 'unpaid',
        shipping_status: 'pending',
        created_at: '2026-03-31T00:00:00Z',
        tracking_token: null,
      },
      wallet: null,
      amountDueToGateway: 720000,
    });
  });

  it('includes variant_attributes in the API payload', async () => {
    const { createOrder } = require('./orders');
    const { fetchWithRetry } = require('@/lib/api');

    await createOrder({
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      customer_phone: '+2348012345678',
      items: [
        {
          id: 'prod-1',
          name: 'MacBook Air M1',
          quantity: 1,
          price: 720000,
          variant_id: 'v-256gb',
          variant_attributes: { storage: '256GB', color: 'Space Gray' },
        },
      ],
      subtotal: 720000,
      shipping_fee: 2000,
      payment_method: 'card',
      shipping_address: {
        firstName: 'Test',
        lastName: 'User',
        address: '123 St',
        city: 'Lagos',
        state: 'Lagos',
      },
    });

    const fetchCall = (fetchWithRetry as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        variant_id: 'v-256gb',
        variant_attributes: { storage: '256GB', color: 'Space Gray' },
      })
    );
  });
});
