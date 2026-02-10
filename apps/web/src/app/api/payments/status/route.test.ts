import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

const mockVerifyJuicywayPayment = vi.fn();
const mockGetJuicywaySession = vi.fn();
const mockGetJuicywayPayment = vi.fn();

vi.mock('@/lib/juicyway', () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyJuicywayPayment(...args),
  getPaymentSession: (...args: unknown[]) => mockGetJuicywaySession(...args),
  getPayment: (...args: unknown[]) => mockGetJuicywayPayment(...args),
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
}));

const mockVerifyPaystackPayment = vi.fn();

vi.mock('@/lib/paystack', () => ({
  verifyTransaction: (...args: unknown[]) => mockVerifyPaystackPayment(...args),
}));

// ---- Import handler AFTER mocks are set up ----
import { GET } from './route';

// ---- Helpers ----

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/payments/status');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return new NextRequest(url.toString(), {
    method: 'GET',
  });
}

// ---- Tests ----

describe('GET /api/payments/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when gateway is missing', async () => {
    const request = makeRequest({
      payment_id: 'pay_123',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when all identifiers are missing', async () => {
    const request = makeRequest({
      gateway: 'juicyway',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid query parameters');
    expect(json.details).toBeDefined();
  });

  it('returns 400 for juicyway when no payment_id or session_id provided', async () => {
    const request = makeRequest({
      gateway: 'juicyway',
      reference: 'ref_123', // reference alone is not enough for juicyway
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain(
      'Either payment_id or session_id is required for Juicyway verification'
    );
    expect(json.code).toBe('MISSING_ID');
    expect(json.gateway).toBe('juicyway');
  });

  it('returns verified succeeded status for juicyway payment', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        status: 'succeeded',
        payment: {
          id: 'pay_123',
          amount: 10000,
          currency: 'NGN',
          reference: 'ref_123',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_123',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.gateway).toBe('juicyway');
    expect(json.status).toBe('succeeded');
    expect(json.is_confirmed).toBe(true);
    expect(json.is_failed).toBe(false);
    expect(json.is_pending).toBe(false);
    expect(json.payment).toEqual({
      id: 'pay_123',
      amount: 10000,
      currency: 'NGN',
      reference: 'ref_123',
    });
    expect(mockVerifyJuicywayPayment).toHaveBeenCalledWith('pay_123');
  });

  it('returns failed status for juicyway payment', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        status: 'failed',
        payment: {
          id: 'pay_456',
          amount: 5000,
          currency: 'USD',
          reference: 'ref_456',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_456',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('failed');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(true);
    expect(json.is_pending).toBe(false);
  });

  it('returns cancelled status for juicyway payment', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        status: 'cancelled',
        payment: {
          id: 'pay_789',
          amount: 3000,
          currency: 'EUR',
          reference: 'ref_789',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_789',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('cancelled');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(true);
    expect(json.is_pending).toBe(false);
  });

  it('returns pending status for juicyway payment', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        status: 'pending',
        payment: {
          id: 'pay_pending',
          amount: 8000,
          currency: 'GBP',
          reference: 'ref_pending',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_pending',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('pending');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(false);
    expect(json.is_pending).toBe(true);
  });

  it('returns processing status for juicyway payment', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        status: 'processing',
        payment: {
          id: 'pay_processing',
          amount: 12000,
          currency: 'NGN',
          reference: 'ref_processing',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_processing',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('processing');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(false);
    expect(json.is_pending).toBe(true);
  });

  it('returns 400 when juicyway verify fails', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: false,
      error: 'Payment not found',
      code: 'PAYMENT_NOT_FOUND',
    });

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_invalid',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Payment not found');
    expect(json.code).toBe('PAYMENT_NOT_FOUND');
    expect(json.gateway).toBe('juicyway');
    expect(json.payment_id).toBe('pay_invalid');
  });

  it('returns crypto address when check_address=true and address is in session', async () => {
    mockGetJuicywaySession.mockResolvedValue({
      success: true,
      data: {
        payment: {
          id: 'pay_crypto',
          status: 'pending',
          payment_method: {
            address: '0x1234567890abcdef',
            chain: 'ethereum',
            currency: 'USDT',
            qrcode: 'data:image/png;base64,abc123',
          },
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      session_id: 'session_123',
      check_address: 'true',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.gateway).toBe('juicyway');
    expect(json.status).toBe('pending');
    expect(json.is_pending).toBe(false);
    expect(json.crypto_address).toEqual({
      address: '0x1234567890abcdef',
      chain: 'ethereum',
      currency: 'USDT',
      qrcode: 'data:image/png;base64,abc123',
    });
    expect(mockGetJuicywaySession).toHaveBeenCalledWith('session_123');
    expect(mockVerifyJuicywayPayment).not.toHaveBeenCalled();
  });

  it('returns crypto address from payment fallback when session has no address', async () => {
    mockGetJuicywaySession.mockResolvedValue({
      success: true,
      data: {
        payment: {
          id: 'pay_crypto_fallback',
          status: 'pending',
          payment_method: {
            // No address in session, but has other fields
            chain: 'polygon',
            currency: 'USDC',
            qrcode: 'data:image/png;base64,xyz789',
          },
        },
      },
    });

    mockGetJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        payment_method: {
          // Address found in payment endpoint fallback
          address: '0xabcdef1234567890',
          chain: 'polygon',
          currency: 'USDC',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      session_id: 'session_fallback',
      check_address: 'true',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.crypto_address).toEqual({
      address: '0xabcdef1234567890',
      chain: 'polygon',
      currency: 'USDC',
      qrcode: 'data:image/png;base64,xyz789',
    });
    expect(mockGetJuicywaySession).toHaveBeenCalledWith('session_fallback');
    expect(mockGetJuicywayPayment).toHaveBeenCalledWith('pay_crypto_fallback');
  });

  it('returns pending with crypto_address null when address not ready', async () => {
    mockGetJuicywaySession.mockResolvedValue({
      success: true,
      data: {
        payment: {
          id: 'pay_no_address',
          status: 'pending',
          payment_method: {
            // No address yet
            chain: 'bitcoin',
            currency: 'BTC',
          },
        },
      },
    });

    mockGetJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        payment_method: {
          // Still no address in payment endpoint either
          chain: 'bitcoin',
          currency: 'BTC',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      session_id: 'session_pending',
      check_address: 'true',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.gateway).toBe('juicyway');
    expect(json.status).toBe('pending');
    expect(json.is_pending).toBe(true);
    expect(json.crypto_address).toBeNull();
  });

  it('uses session_id as fallback when payment_id is not provided', async () => {
    mockVerifyJuicywayPayment.mockResolvedValue({
      success: true,
      data: {
        status: 'succeeded',
        payment: {
          id: 'pay_from_session',
          amount: 15000,
          currency: 'NGN',
          reference: 'ref_session',
        },
      },
    });

    const request = makeRequest({
      gateway: 'juicyway',
      session_id: 'session_fallback_verify',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockVerifyJuicywayPayment).toHaveBeenCalledWith(
      'session_fallback_verify'
    );
  });

  it('returns verified success status for paystack payment', async () => {
    mockVerifyPaystackPayment.mockResolvedValue({
      success: true,
      data: {
        id: 123456,
        status: 'success',
        amount: 50000,
        currency: 'NGN',
        reference: 'paystack_ref_123',
      },
    });

    const request = makeRequest({
      gateway: 'paystack',
      reference: 'paystack_ref_123',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.gateway).toBe('paystack');
    expect(json.status).toBe('success');
    expect(json.is_confirmed).toBe(true);
    expect(json.is_failed).toBe(false);
    expect(json.is_pending).toBe(false);
    expect(json.payment).toEqual({
      id: 123456,
      amount: 50000,
      currency: 'NGN',
      reference: 'paystack_ref_123',
    });
    expect(mockVerifyPaystackPayment).toHaveBeenCalledWith('paystack_ref_123');
  });

  it('returns failed status for paystack payment', async () => {
    mockVerifyPaystackPayment.mockResolvedValue({
      success: true,
      data: {
        id: 789012,
        status: 'failed',
        amount: 25000,
        currency: 'NGN',
        reference: 'paystack_failed',
      },
    });

    const request = makeRequest({
      gateway: 'paystack',
      reference: 'paystack_failed',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('failed');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(true);
    expect(json.is_pending).toBe(false);
  });

  it('returns abandoned status for paystack payment', async () => {
    mockVerifyPaystackPayment.mockResolvedValue({
      success: true,
      data: {
        id: 345678,
        status: 'abandoned',
        amount: 30000,
        currency: 'NGN',
        reference: 'paystack_abandoned',
      },
    });

    const request = makeRequest({
      gateway: 'paystack',
      reference: 'paystack_abandoned',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('abandoned');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(true);
    expect(json.is_pending).toBe(false);
  });

  it('returns pending status for paystack payment', async () => {
    mockVerifyPaystackPayment.mockResolvedValue({
      success: true,
      data: {
        id: 901234,
        status: 'pending',
        amount: 40000,
        currency: 'NGN',
        reference: 'paystack_pending',
      },
    });

    const request = makeRequest({
      gateway: 'paystack',
      reference: 'paystack_pending',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('pending');
    expect(json.is_confirmed).toBe(false);
    expect(json.is_failed).toBe(false);
    expect(json.is_pending).toBe(true);
  });

  it('returns 400 when paystack verify fails', async () => {
    mockVerifyPaystackPayment.mockResolvedValue({
      success: false,
      error: 'Transaction not found',
      code: 'TRANSACTION_NOT_FOUND',
    });

    const request = makeRequest({
      gateway: 'paystack',
      reference: 'invalid_ref',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Transaction not found');
    expect(json.code).toBe('TRANSACTION_NOT_FOUND');
  });

  it('returns 400 for paystack when reference is missing', async () => {
    const request = makeRequest({
      gateway: 'paystack',
      payment_id: 'some_id', // paystack needs reference, not payment_id
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Unsupported gateway or missing reference');
    expect(mockVerifyPaystackPayment).not.toHaveBeenCalled();
  });

  it('returns 400 for unsupported gateway', async () => {
    const request = makeRequest({
      gateway: 'korapay',
      reference: 'some_ref',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Unsupported gateway or missing reference');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockVerifyJuicywayPayment.mockRejectedValue(
      new Error('Network connection failed')
    );

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_error',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to check payment status');
    expect(json.details).toBe('Network connection failed');
  });

  it('handles non-Error exceptions in catch block', async () => {
    mockVerifyJuicywayPayment.mockRejectedValue('String error');

    const request = makeRequest({
      gateway: 'juicyway',
      payment_id: 'pay_string_error',
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to check payment status');
    expect(json.details).toBe('Unknown error');
  });
});
