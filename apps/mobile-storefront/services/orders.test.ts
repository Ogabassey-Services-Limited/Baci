import { jest } from '@jest/globals';

type MockAuthUserResponse = {
  data: { user: { id: string } | null };
  error: null;
};

type MockAuthSessionResponse = {
  data: { session: { access_token: string } | null };
  error?: null;
};

type MockCreateOrderApiResponse = {
  order: {
    id: string;
    order_number: string;
    total: number;
    payment_status: string;
    shipping_status: string;
    tracking_token: string | null;
    created_at?: string;
  };
  wallet: null;
  amountDueToGateway: number;
};

const mockNetInfoFetch = jest.fn<() => Promise<{ isConnected: boolean }>>();
const mockSupabaseGetUser = jest.fn<() => Promise<MockAuthUserResponse>>();
const mockSupabaseGetSession =
  jest.fn<() => Promise<MockAuthSessionResponse>>();
const mockFetchJson = jest.fn<() => Promise<MockCreateOrderApiResponse>>();

type MockFetchResponse = {
  ok: boolean;
  status: number;
  json: typeof mockFetchJson;
};

type MockFetchOptions = {
  body: string;
  headers?: Record<string, string>;
};

const mockFetchResponse: MockFetchResponse = {
  ok: true,
  status: 200,
  json: mockFetchJson,
};
const mockFetchWithRetry = jest.fn<
  (url: string, options?: MockFetchOptions) => Promise<MockFetchResponse>
>(async () => mockFetchResponse);

mockNetInfoFetch.mockResolvedValue({ isConnected: true });
mockSupabaseGetUser.mockResolvedValue({
  data: { user: { id: 'user-1' } },
  error: null,
});
mockSupabaseGetSession.mockResolvedValue({
  data: { session: { access_token: 'token-123' } },
  error: null,
});
mockFetchJson.mockResolvedValue({
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

jest.mock('@react-native-community/netinfo', () => ({
  fetch: mockNetInfoFetch,
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
      getUser: mockSupabaseGetUser,
      getSession: mockSupabaseGetSession,
    },
  },
}));

jest.mock('@/lib/api', () => ({
  fetchWithRetry: mockFetchWithRetry,
  DEFAULT_TIMEOUT: 30000,
  ApiError: class extends Error {
    code: string;

    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  NetworkError: class extends Error {},
  RetryExhaustedError: class extends Error {},
  TimeoutError: class extends Error {},
}));

type CreateOrderResult = {
  order: {
    created_at: string;
  };
};

function getLastFetchCall(): [string, MockFetchOptions] {
  const fetchCall = mockFetchWithRetry.mock.calls.at(-1) as
    | [string, MockFetchOptions]
    | undefined;

  if (!fetchCall) {
    throw new Error(
      'Expected fetchWithRetry to be called before reading the request body'
    );
  }

  if (!fetchCall[1]?.body) {
    throw new Error(
      `Expected fetchWithRetry to be called with a JSON body, received: ${JSON.stringify(fetchCall)}`
    );
  }

  return fetchCall;
}

function getLastFetchBody() {
  const [, options] = getLastFetchCall();
  return JSON.parse(options.body);
}

function getLastFetchOptions(): MockFetchOptions {
  const [, options] = getLastFetchCall();
  return options;
}

describe('createOrder — variant_attributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchJson.mockResolvedValue({
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
          image_url: 'https://cdn.example.com/space-gray.jpg',
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

    const body = getLastFetchBody();
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        image_url: 'https://cdn.example.com/space-gray.jpg',
        variant_id: 'v-256gb',
        variant_attributes: { storage: '256GB', color: 'Space Gray' },
      })
    );
  });

  it('includes the selected image_url in the API payload', async () => {
    const { createOrder } = require('./orders');

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
          image_url: 'https://cdn.example.com/gold.jpg',
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

    const body = getLastFetchBody();
    expect(body.items[0].image_url).toBe('https://cdn.example.com/gold.jpg');
  });

  it('supports guest checkout when no authenticated session is present', async () => {
    const { createOrder } = require('./orders');

    mockSupabaseGetSession.mockResolvedValueOnce({
      data: { session: null },
    });
    mockSupabaseGetUser.mockResolvedValueOnce({
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

    expect(getLastFetchOptions()?.headers).not.toHaveProperty('Authorization');

    const body = getLastFetchBody();
    expect(body).not.toHaveProperty('user_id');
    expect(body.payment_method).toBe('pay_on_delivery');
  });

  it('includes the selected shipping quote metadata in the API payload', async () => {
    const { createOrder } = require('./orders');

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

    const body = getLastFetchBody();
    expect(body.selected_quote_id).toBe('98dd0f44-d780-4829-9163-3e8a088dcf95');
    expect(body.shipping_provider).toBe('TOPSHIP');
  });

  it('passes maxRetries: 0 to fetchWithRetry so orders are never automatically retried', async () => {
    const { createOrder } = require('./orders');

    await createOrder({
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      customer_phone: '+2348012345678',
      items: [{ id: 'prod-1', name: 'Product', quantity: 1, price: 5000 }],
      subtotal: 5000,
      shipping_fee: 500,
      payment_method: 'pay_on_delivery',
      shipping_address: {
        firstName: 'Test',
        lastName: 'User',
        address: '123 St',
        city: 'Lagos',
        state: 'Lagos',
      },
    });

    const retryOptions = mockFetchWithRetry.mock.calls.at(-1)?.[2] as
      | { maxRetries?: number }
      | undefined;
    expect(retryOptions?.maxRetries).toBe(0);
  });

  it('accepts successful order responses that omit created_at', async () => {
    const { createOrder } = require('./orders');

    mockFetchJson.mockResolvedValueOnce({
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

    const result = (await createOrder({
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
    })) as CreateOrderResult;

    expect(result.order.created_at).toEqual(expect.any(String));
  });
});

describe('createOrderWithOfflineSupport — offline queue contract', () => {
  const baseRequest = {
    customer_email: 'buyer@example.com',
    customer_name: 'Test Buyer',
    customer_phone: '+2348012345678',
    items: [{ id: 'item-1', name: 'Product', quantity: 1, price: 5000 }],
    subtotal: 5000,
    shipping_fee: 500,
    payment_method: 'pay_on_delivery' as const,
    shipping_address: {
      firstName: 'Test',
      lastName: 'Buyer',
      address: '123 St',
      city: 'Lagos',
      state: 'Lagos',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockSupabaseGetSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
    });
    mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const { offlineQueue } = require('@/lib/offline-queue');
    (offlineQueue.enqueue as jest.Mock).mockResolvedValue('queue-id-1');
  });

  it('queues the order when createOrder encounters a NETWORK_ERROR', async () => {
    const { createOrderWithOfflineSupport } = require('./orders');
    const { NetworkError } = require('@/lib/api');
    mockFetchWithRetry.mockRejectedValueOnce(new NetworkError('connection refused'));

    const result = await createOrderWithOfflineSupport(baseRequest);

    expect(result.queued).toBe(true);
    const { offlineQueue } = require('@/lib/offline-queue');
    expect(offlineQueue.enqueue).toHaveBeenCalledWith('create_order', baseRequest);
  });

  it('re-throws TIMEOUT_ERROR without queuing to avoid duplicate orders', async () => {
    const { createOrderWithOfflineSupport } = require('./orders');
    const { TimeoutError } = require('@/lib/api');
    mockFetchWithRetry.mockRejectedValueOnce(new TimeoutError('timed out'));

    await expect(createOrderWithOfflineSupport(baseRequest)).rejects.toMatchObject({
      code: 'TIMEOUT_ERROR',
    });

    const { offlineQueue } = require('@/lib/offline-queue');
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
  });
});
