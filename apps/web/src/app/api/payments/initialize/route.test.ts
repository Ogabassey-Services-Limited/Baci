import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

vi.mock('nanoid', () => ({
  customAlphabet: () => () => 'ABCD12345678',
}));

// Juicyway mocks
const mockInitializeJuicyway = vi.fn();
const mockCapturePaymentWithCrypto = vi.fn();
const mockGetPaymentSession = vi.fn();
const mockGetPayment = vi.fn();

vi.mock('@/lib/juicyway', () => ({
  initializePayment: (...args: unknown[]) => mockInitializeJuicyway(...args),
  capturePaymentWithCrypto: (...args: unknown[]) =>
    mockCapturePaymentWithCrypto(...args),
  getPaymentSession: (...args: unknown[]) => mockGetPaymentSession(...args),
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
  extractCryptoAddress: (pm: Record<string, unknown> | null | undefined) => {
    if (!pm) return null;
    const addr =
      (pm.address as string) || (pm.params as { address?: string })?.address;
    if (!addr) return null;
    return {
      address: addr,
      chain: pm.chain || (pm.params as { chain?: string })?.chain || '',
      currency:
        pm.currency || (pm.params as { currency?: string })?.currency || '',
      qrcode: pm.qrcode,
    };
  },
  convertNgnKoboToUsdtCents: async (ngnKobo: number) => ({
    usdtCents: Math.ceil((ngnKobo / 100 / 1535) * 100),
    rate: 1535,
    ngnAmount: ngnKobo / 100,
  }),
  formatPhoneToE164: (phone: string) => `+234${phone.replace(/^0/, '')}`,
  generatePaymentReference: () => 'baci_test_ref123',
  getChainConfirmationTime: () => '1-3 minutes',
  isSupportedCurrency: (c: string) =>
    ['NGN', 'USD', 'USDT', 'USDC'].includes(c),
  JUICYWAY_CHAIN_SUPPORT: {
    USDT: ['TRX', 'ETH'],
    USDC: ['ETH', 'MATIC', 'AVAXC'],
  },
}));

// Korapay mocks
const mockInitializeKorapay = vi.fn();
vi.mock('@/lib/korapay', () => ({
  initializePayment: (...args: unknown[]) => mockInitializeKorapay(...args),
  calculatePlatformFee: (amount: number) => ({
    platformFee: amount * 0.015,
    merchantAmount: amount * 0.985,
  }),
  SUPPORTED_CURRENCIES: ['NGN', 'USD', 'GBP', 'EUR'],
}));

// Paystack mocks
const mockInitializePaystack = vi.fn();
vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: unknown[]) =>
    mockInitializePaystack(...args),
  calculatePlatformFee: (amount: number) => ({
    platformFee: Math.round(amount * 0.015),
    merchantAmount: amount - Math.round(amount * 0.015),
  }),
}));

// Supabase mocks
const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const ORDER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

let rpcResult: { data: unknown; error: unknown };
let rpcTransactionResult: { data: unknown; error: unknown };

function createMockSupabase() {
  return {
    rpc: vi.fn((name: string) => {
      if (name === 'get_order_payment_snapshot')
        return Promise.resolve(rpcResult);
      if (name === 'create_payment_transaction')
        return Promise.resolve(rpcTransactionResult);
      return Promise.resolve({ data: null, error: null });
    }),
  };
}

let merchantResult: { data: unknown; error: unknown };
let featureSettingsResult: { data: unknown; error: unknown };
let orderLookupResult: { data: unknown; error: unknown };

function createMockAdminClient() {
  return {
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(merchantResult),
            }),
          }),
        };
      }
      if (table === 'orders') {
        const orderQuery = {
          eq: vi.fn(),
          single: vi.fn().mockResolvedValue(orderLookupResult),
        };
        orderQuery.eq.mockReturnValue(orderQuery);
        return {
          select: () => orderQuery,
        };
      }
      if (table === 'merchant_feature_settings') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(featureSettingsResult),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

// Admin client is used for all Supabase operations (mobile Bearer-token compat).
// The mock returns separate sub-clients so RPC calls (snapshot, transaction)
// and table queries (merchants, feature_settings) can be controlled independently.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    ...createMockSupabase(),
    ...createMockAdminClient(),
  }),
}));

// ---- Import handler AFTER mocks ----
import { POST } from './route';

// ---- Helpers ----

const validBody = {
  merchant_id: MERCHANT_ID,
  order_id: ORDER_ID,
  amount: 5000,
  currency: 'NGN',
  customer_email: 'customer@example.com',
  customer_name: 'John Doe',
  customer_phone: '08012345678',
  billing_address: {
    line1: '123 Main St',
    city: 'Lagos',
    country: 'NG',
    zip_code: '100001',
  },
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/payments/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupDefaults() {
  rpcResult = {
    data: [{ merchant_id: MERCHANT_ID, total: 5000 }],
    error: null,
  };
  rpcTransactionResult = { data: null, error: null };
  merchantResult = {
    data: {
      id: MERCHANT_ID,
      business_name: 'Test Store',
      slug: 'test-store',
      paystack_subaccount_code: 'ACCT_test123',
    },
    error: null,
  };
  featureSettingsResult = { data: null, error: null };
  orderLookupResult = {
    data: { tracking_token: 'track-token-123' },
    error: null,
  };
}

// ---- Tests ----

describe('POST /api/payments/initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('JUICYWAY_SECRET_KEY', 'test-juicyway-key');
    setupDefaults();
  });

  describe('validation', () => {
    it('returns 400 for invalid merchant_id', async () => {
      const res = await POST(makeRequest({ ...validBody, merchant_id: 'bad' }));
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing customer_email', async () => {
      const { customer_email: _, ...body } = validBody;
      const res = await POST(makeRequest(body));
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for negative amount', async () => {
      const res = await POST(makeRequest({ ...validBody, amount: -100 }));
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('order validation', () => {
    it('returns 404 when order snapshot not found', async () => {
      rpcResult = { data: [], error: null };
      const res = await POST(makeRequest(validBody));
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.code).toBe('ORDER_NOT_FOUND');
    });

    it('returns 404 when RPC returns an error', async () => {
      rpcResult = { data: null, error: { message: 'Not found' } };
      const res = await POST(makeRequest(validBody));
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.code).toBe('ORDER_NOT_FOUND');
    });

    it('returns 403 on merchant mismatch', async () => {
      rpcResult = {
        data: [
          { merchant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', total: 5000 },
        ],
        error: null,
      };
      const res = await POST(makeRequest(validBody));
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.code).toBe('MERCHANT_MISMATCH');
    });

    it('returns 400 when amount exceeds order total', async () => {
      rpcResult = {
        data: [{ merchant_id: MERCHANT_ID, total: 1000 }],
        error: null,
      };
      const res = await POST(makeRequest(validBody));
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.code).toBe('AMOUNT_EXCEEDS_TOTAL');
    });
  });

  describe('merchant lookup', () => {
    it('returns 404 when merchant not found', async () => {
      merchantResult = { data: null, error: { message: 'Not found' } };
      const res = await POST(makeRequest(validBody));
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.code).toBe('MERCHANT_NOT_FOUND');
    });
  });

  describe('korapay gateway', () => {
    it('returns success with checkout_url for korapay', async () => {
      mockInitializeKorapay.mockResolvedValue({
        authorization_url: 'https://korapay.com/checkout/abc',
        checkout_url: 'https://korapay.com/checkout/abc',
      });
      const res = await POST(makeRequest({ ...validBody, gateway: 'korapay' }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.gateway).toBe('korapay');
      expect(json.checkout_url).toBe('https://korapay.com/checkout/abc');
    });

    it('returns 502 when korapay initialization throws', async () => {
      mockInitializeKorapay.mockRejectedValue(new Error('Korapay down'));
      const res = await POST(makeRequest({ ...validBody, gateway: 'korapay' }));
      const json = await res.json();
      expect(res.status).toBe(502);
      expect(json.code).toBe('GATEWAY_INIT_ERROR');
    });
  });

  describe('paystack gateway', () => {
    it('returns success with authorization_url for paystack', async () => {
      mockInitializePaystack.mockResolvedValue({
        authorization_url: 'https://paystack.com/pay/abc',
      });
      const res = await POST(
        makeRequest({ ...validBody, gateway: 'paystack' })
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.gateway).toBe('paystack');
      expect(json.authorization_url).toBe('https://paystack.com/pay/abc');
    });

    it('returns 400 when paystack subaccount not configured', async () => {
      merchantResult = {
        data: {
          id: MERCHANT_ID,
          business_name: 'Test Store',
          slug: 'test-store',
          paystack_subaccount_code: null,
        },
        error: null,
      };
      const res = await POST(
        makeRequest({ ...validBody, gateway: 'paystack' })
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.code).toBe('GATEWAY_NOT_CONFIGURED');
    });
  });

  describe('bnpl gateways', () => {
    it('includes the tracking token in BNPL launcher URLs', async () => {
      const res = await POST(
        makeRequest({ ...validBody, gateway: 'credit_direct' })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.gateway).toBe('credit_direct');
      expect(json.authorization_url).toContain(
        'orderId=a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      );
      expect(json.authorization_url).toContain('trackingToken=track-token-123');
      expect(json.checkout_url).toContain('trackingToken=track-token-123');
    });
  });

  describe('juicyway crypto gateway', () => {
    it('returns crypto_payment with address when immediately available', async () => {
      mockInitializeJuicyway.mockResolvedValue({
        id: 'session-123',
        status: 'pending',
      });
      mockCapturePaymentWithCrypto.mockResolvedValue({
        success: true,
        data: {
          payment: {
            id: 'payment-456',
            amount: 500000,
            status: 'processing',
            payment_method: {
              address: 'TRX_WALLET_ADDR_123',
              chain: 'TRX',
              currency: 'USDT',
              qrcode: 'https://qr.example.com/qr.png',
            },
          },
        },
      });

      const res = await POST(
        makeRequest({
          ...validBody,
          gateway: 'juicyway',
          crypto_chain: 'TRX',
          crypto_currency: 'USDT',
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.gateway).toBe('juicyway');
      expect(json.crypto_payment.address).toBe('TRX_WALLET_ADDR_123');
      expect(json.crypto_payment.chain).toBe('TRX');
      expect(json.crypto_payment.currency).toBe('USDT');
      expect(json.crypto_payment.payment_id).toBe('payment-456');
      expect(json.crypto_address_pending).toBeUndefined();
    });

    it('returns crypto_address_pending when address not ready after polling', {
      timeout: 30000,
    }, async () => {
      mockInitializeJuicyway.mockResolvedValue({
        id: 'session-123',
        status: 'pending',
      });
      mockCapturePaymentWithCrypto.mockResolvedValue({
        success: true,
        data: {
          payment: {
            id: 'payment-456',
            amount: 500000,
            status: 'pending',
            // No payment_method with address
          },
        },
      });
      // All polls return pending without address
      mockGetPaymentSession.mockResolvedValue({
        success: true,
        data: {
          status: 'pending',
          payment: { id: 'payment-456', status: 'pending' },
        },
      });
      mockGetPayment.mockResolvedValue({
        success: true,
        data: {
          status: 'pending',
          payment_method: { type: 'crypto_address' },
        },
      });

      const res = await POST(
        makeRequest({
          ...validBody,
          gateway: 'juicyway',
          crypto_chain: 'TRX',
          crypto_currency: 'USDT',
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.crypto_address_pending).toBe(true);
      expect(json.crypto_payment.address).toBe('');
      expect(json.session_id).toBe('session-123');
      expect(json.crypto_payment.payment_id).toBe('payment-456');
    });

    it('returns address found during polling', { timeout: 15000 }, async () => {
      mockInitializeJuicyway.mockResolvedValue({
        id: 'session-123',
        status: 'pending',
      });
      mockCapturePaymentWithCrypto.mockResolvedValue({
        success: true,
        data: {
          payment: { id: 'payment-456', amount: 500000, status: 'pending' },
        },
      });
      // First poll: no address; second poll: address available
      mockGetPaymentSession
        .mockResolvedValueOnce({
          success: true,
          data: {
            payment: { id: 'payment-456', status: 'pending' },
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            payment: {
              id: 'payment-456',
              status: 'processing',
              amount: 500000,
              payment_method: {
                address: 'TRX_ADDR_POLLED',
                chain: 'TRX',
                currency: 'USDT',
              },
            },
          },
        });
      mockGetPayment.mockResolvedValue({
        success: true,
        data: { status: 'pending', payment_method: { type: 'crypto_address' } },
      });

      const res = await POST(
        makeRequest({
          ...validBody,
          gateway: 'juicyway',
          crypto_chain: 'TRX',
          crypto_currency: 'USDT',
        })
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.crypto_payment.address).toBe('TRX_ADDR_POLLED');
      expect(json.crypto_address_pending).toBeUndefined();
    });

    it('returns 502 when capture fails', async () => {
      mockInitializeJuicyway.mockResolvedValue({
        id: 'session-123',
        status: 'pending',
      });
      mockCapturePaymentWithCrypto.mockResolvedValue({
        success: false,
        error: 'Capture failed',
      });

      const res = await POST(
        makeRequest({
          ...validBody,
          gateway: 'juicyway',
          crypto_chain: 'TRX',
          crypto_currency: 'USDT',
        })
      );
      const json = await res.json();

      expect(res.status).toBe(502);
      expect(json.code).toBe('GATEWAY_INIT_ERROR');
      expect(json.error).toContain('Capture failed');
    });

    it('returns 400 when JUICYWAY_SECRET_KEY not set', async () => {
      vi.stubEnv('JUICYWAY_SECRET_KEY', '');
      const res = await POST(
        makeRequest({ ...validBody, gateway: 'juicyway' })
      );
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.code).toBe('GATEWAY_NOT_CONFIGURED');
    });
  });

  describe('transaction record', () => {
    it('returns 500 when transaction RPC fails', async () => {
      rpcTransactionResult = {
        data: null,
        error: { message: 'RPC error' },
      };
      mockInitializeKorapay.mockResolvedValue({
        authorization_url: 'https://korapay.com/checkout/abc',
        checkout_url: 'https://korapay.com/checkout/abc',
      });

      const res = await POST(makeRequest({ ...validBody, gateway: 'korapay' }));
      const json = await res.json();
      expect(res.status).toBe(500);
      expect(json.code).toBe('TRANSACTION_CREATE_FAILED');
    });
  });
});
