import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockJuicywayRequest = vi.fn();

vi.mock('./client', () => ({
  JUICYWAY_BASE_URL: 'https://sandbox.spendjuice.com',
  JUICYWAY_SECRET_KEY: 'sk_test_key',
  juicywayRequest: (...args: unknown[]) => mockJuicywayRequest(...args),
}));

import {
  capturePaymentWithCrypto,
  getPayment,
  getPaymentSession,
  initializePayment,
  verifyPayment,
} from './payments';
import type { JuicywayPaymentInitRequest } from './types';

const validInitRequest: JuicywayPaymentInitRequest = {
  amount: 5000,
  currency: 'NGN',
  customer: {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone_number: '+2348012345678',
    billing_address: {
      line1: '123 Main St',
      city: 'Lagos',
      country: 'NG',
      zip_code: '100001',
    },
    ip_address: '192.168.1.1',
  },
  description: 'Test payment',
  reference: 'baci_test_ref',
  payment_method: { type: 'card' },
  order: {
    identifier: 'order_123',
    items: [{ name: 'Widget', type: 'digital' }],
  },
};

describe('initializePayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when amount is less than 100', async () => {
    await expect(
      initializePayment({ ...validInitRequest, amount: 50 })
    ).rejects.toThrow('Amount must be at least 100');
  });

  it('throws when reference exceeds 50 characters', async () => {
    await expect(
      initializePayment({
        ...validInitRequest,
        reference: 'a'.repeat(51),
      })
    ).rejects.toThrow('Reference must be max 50 characters');
  });

  it('throws when description exceeds 200 characters', async () => {
    await expect(
      initializePayment({
        ...validInitRequest,
        description: 'a'.repeat(201),
      })
    ).rejects.toThrow('Description must be max 200 characters');
  });

  it('throws when API request fails', async () => {
    mockJuicywayRequest.mockResolvedValue({
      success: false,
      error: 'Server error',
    });

    await expect(initializePayment(validInitRequest)).rejects.toThrow(
      'Server error'
    );
  });

  it('returns payment session on success', async () => {
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        id: 'session_123',
        amount: 5000,
        currency: 'NGN',
        status: 'pending',
        links: { redirect_url: 'https://checkout.example.com' },
      },
    });

    const result = await initializePayment(validInitRequest);

    expect(result.id).toBe('session_123');
    expect(result.checkout_url).toBe('https://checkout.example.com');
    expect(mockJuicywayRequest).toHaveBeenCalledWith(
      '/payment-sessions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('extracts checkout_url from nested data.links', async () => {
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        data: {
          id: 'session_456',
          amount: 5000,
          checkout_url: 'https://nested-checkout.example.com',
        },
      },
    });

    const result = await initializePayment(validInitRequest);

    expect(result.checkout_url).toBe('https://nested-checkout.example.com');
  });

  it('extracts payment id from nested payment object', async () => {
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        payment: { id: 'pay_789', status: 'pending' },
        links: { redirect_url: 'https://checkout.example.com' },
      },
    });

    const result = await initializePayment(validInitRequest);

    expect(result.id).toBe('pay_789');
  });
});

describe('getPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns VALIDATION_ERROR for invalid UUID', async () => {
    const result = await getPayment('not-a-uuid');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns payment data on success', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: { id: paymentId, status: 'succeeded', amount: 5000 },
    });

    const result = await getPayment(paymentId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('succeeded');
    }
  });

  it('unwraps nested data envelope', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        data: { id: paymentId, status: 'pending', amount: 3000 },
      },
    });

    const result = await getPayment(paymentId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(3000);
    }
  });

  it('passes through API errors', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: false,
      error: 'Not found',
      code: 'HTTP_404',
    });

    const result = await getPayment(paymentId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Not found');
    }
  });
});

describe('verifyPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success true when payment succeeded', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: { id: paymentId, status: 'succeeded', amount: 5000 },
    });

    const result = await verifyPayment(paymentId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect(result.data.status).toBe('succeeded');
    }
  });

  it('returns success false when payment failed', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: { id: paymentId, status: 'failed', amount: 5000 },
    });

    const result = await verifyPayment(paymentId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(false);
      expect(result.data.status).toBe('failed');
    }
  });

  it('propagates getPayment errors', async () => {
    const result = await verifyPayment('bad-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('getPaymentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns VALIDATION_ERROR for invalid session ID', async () => {
    const result = await getPaymentSession('not-uuid');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns session data on success', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        id: sessionId,
        status: 'pending',
        payment: { id: 'pay_123', status: 'pending', amount: 5000 },
      },
    });

    const result = await getPaymentSession(sessionId);

    expect(result.success).toBe(true);
    expect(mockJuicywayRequest).toHaveBeenCalledWith(
      `/payment-sessions/${sessionId}`,
      { method: 'GET' }
    );
  });

  it('passes through API errors', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: false,
      error: 'Session expired',
      code: 'HTTP_410',
    });

    const result = await getPaymentSession(sessionId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Session expired');
    }
  });
});

describe('capturePaymentWithCrypto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns VALIDATION_ERROR for invalid payment ID', async () => {
    const result = await capturePaymentWithCrypto('bad', 'TRX', 'USDT');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns VALIDATION_ERROR for unsupported chain/currency combo', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    const result = await capturePaymentWithCrypto(paymentId, 'TRX', 'USDC');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not supported on TRX');
    }
  });

  it('sends correct payload and returns crypto address', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        id: paymentId,
        status: 'processing',
        payment: {
          id: 'pay_456',
          amount: 5000,
          status: 'processing',
          payment_method: {
            address: 'TRX_ADDR_123',
            chain: 'TRX',
            currency: 'USDT',
            type: 'crypto_address',
          },
        },
      },
    });

    const result = await capturePaymentWithCrypto(paymentId, 'TRX', 'USDT');

    expect(result.success).toBe(true);
    expect(mockJuicywayRequest).toHaveBeenCalledWith(
      `/payment-sessions/${paymentId}`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          crypto_address: { chain: 'TRX', currency: 'USDT' },
        }),
      })
    );
  });

  it('allows USDC on ETH chain', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: true,
      data: {
        payment: {
          id: 'pay_789',
          amount: 1000,
          status: 'processing',
          payment_method: {
            address: 'ETH_ADDR',
            chain: 'ETH',
            currency: 'USDC',
          },
        },
      },
    });

    const result = await capturePaymentWithCrypto(paymentId, 'ETH', 'USDC');

    expect(result.success).toBe(true);
  });

  it('passes through API errors', async () => {
    const paymentId = '550e8400-e29b-41d4-a716-446655440000';
    mockJuicywayRequest.mockResolvedValue({
      success: false,
      error: 'Capture timeout',
      code: 'HTTP_504',
    });

    const result = await capturePaymentWithCrypto(paymentId, 'TRX', 'USDT');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Capture timeout');
    }
  });
});
