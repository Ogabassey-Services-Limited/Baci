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

  it('supports guest checkout when no authenticated session is present', async () => {
    const { createOrder } = require('./orders');
    const { fetchWithRetry } = require('@/lib/api');
    const { supabase } = require('@/lib/supabase');

    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
    });
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await createOrder({
      customer_email: 'guest@example.com',
      customer_name: 'Guest User',
      customer_phone: '+2348012345678',
      items: [
        {
          id: 'prod-guest-1',
          name: 'Guest Checkout Item',
          quantity: 1,
          price: 120000,
        },
      ],
      subtotal: 120000,
      shipping_fee: 2000,
      payment_method: 'pay_on_delivery',
      shipping_address: {
        firstName: 'Guest',
        lastName: 'User',
        address: '123 St',
        city: 'Lagos',
        state: 'Lagos',
      },
    });

    const fetchCall = (fetchWithRetry as jest.Mock).mock.calls.at(-1);
    expect(fetchCall?.[1]?.headers).not.toHaveProperty('Authorization');

    const body = JSON.parse(fetchCall?.[1]?.body ?? '{}');
    expect(body).not.toHaveProperty('user_id');
    expect(body.payment_method).toBe('pay_on_delivery');
  });

  it('includes the selected shipping quote metadata in the API payload', async () => {
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
        },
      ],
      subtotal: 720000,
      shipping_fee: 3638,
      tax_amount: 54000,
      selected_quote_id: '98dd0f44-d780-4829-9163-3e8a088dcf95',
      shipping_provider: 'TOPSHIP',
      payment_method: 'pay_on_delivery',
      shipping_address: {
        firstName: 'Test',
        lastName: 'User',
        address: '123 St',
        city: 'Lagos',
        state: 'Lagos',
      },
    });

    const fetchCall = (fetchWithRetry as jest.Mock).mock.calls.at(-1);
    const body = JSON.parse(fetchCall?.[1]?.body ?? '{}');

    expect(body.selected_quote_id).toBe(
      '98dd0f44-d780-4829-9163-3e8a088dcf95'
    );
    expect(body.shipping_provider).toBe('TOPSHIP');
  });

  it('accepts successful order responses that omit created_at', async () => {
    const { createOrder } = require('./orders');

    mockFetchResponse.json.mockResolvedValueOnce({
      order: {
        id: 'order-2',
        order_number: 'ORD-002',
        total: 122000,
        payment_status: 'pending',
        shipping_status: 'pending',
        tracking_token: null,
      },
      wallet: null,
      amountDueToGateway: 122000,
    });

    const result = await createOrder({
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      customer_phone: '+2348012345678',
      items: [
        {
          id: 'prod-1',
          name: 'MacBook Air M1',
          quantity: 1,
          price: 120000,
        },
      ],
      subtotal: 120000,
      shipping_fee: 2000,
      payment_method: 'pay_on_delivery',
      shipping_address: {
        firstName: 'Test',
        lastName: 'User',
        address: '123 St',
        city: 'Lagos',
        state: 'Lagos',
      },
    });

    expect(result.order.created_at).toEqual(expect.any(String));
  });
});
