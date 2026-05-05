import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockPreparePendingVtuTransaction = vi.fn();
const mockInitializePaystackTransaction = vi.fn();
const mockInitializeKorapayPayment = vi.fn();
const mockFrom = vi.fn();
const transactionsInsertCalls: Record<string, unknown>[] = [];

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  preparePendingVtuTransaction: (...args: unknown[]) =>
    mockPreparePendingVtuTransaction(...args),
}));

vi.mock('@/lib/paystack', () => ({
  initializeTransaction: (...args: unknown[]) =>
    mockInitializePaystackTransaction(...args),
}));

vi.mock('@/lib/korapay', () => ({
  initializePayment: (...args: unknown[]) =>
    mockInitializeKorapayPayment(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/vtu/checkout/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/vtu/checkout/initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
    mockPreparePendingVtuTransaction.mockResolvedValue({
      customer: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '08012345678',
      },
      merchant: {
        id: 'merchant-1',
        slug: 'ogabassey',
      },
      requestReference: 'REQ-123',
      transaction: {
        id: 'vtu-1',
        metadata: {},
        type: 'airtime',
      },
    });
    mockInitializePaystackTransaction.mockResolvedValue({
      authorization_url: 'https://paystack.com/pay/abc',
    });
    mockInitializeKorapayPayment.mockResolvedValue({
      authorization_url: 'https://korapay.com/pay/abc',
      checkout_url: 'https://korapay.com/pay/abc',
    });
    transactionsInsertCalls.length = 0;
    mockFrom.mockImplementation((table: string) => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        if (table === 'transactions') {
          transactionsInsertCalls.push(row);
        }
        return Promise.resolve({ error: null });
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(401);
  });

  it('rejects unsupported bank-transfer utility checkout', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'bank_transfer',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(400);
  });

  it('returns a hosted checkout payload for paystack', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        gateway: 'paystack',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      authorization_url: 'https://paystack.com/pay/abc',
      gateway: 'paystack',
      vtu_reference: 'REQ-123',
    });
  });

  // Phase B.7 — wallet residual coverage. The route delegates the
  // paymentSplit metadata write to preparePendingVtuTransaction (Phase
  // B.4); these tests pin the gateway-charges-residual contract that
  // the confirm route's amount-comparison guard depends on. If
  // transactions.amount drifted from the residual the gateway actually
  // charged, confirm would reject the verified payment with "amount
  // mismatch".

  it('passes through unchanged when walletAmount is 0', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 0,
        gateway: 'paystack',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(200);
    expect(mockInitializePaystackTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000 * 100 })
    );
    expect(transactionsInsertCalls[0]).toMatchObject({ amount: 1000 });
  });

  it('rejects walletAmount === amount and directs the client to the wallet-only route', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 1000,
        gateway: 'paystack',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toMatchObject({
      error: expect.stringMatching(/wallet-only/i),
    });
    expect(mockInitializePaystackTransaction).not.toHaveBeenCalled();
    expect(transactionsInsertCalls).toHaveLength(0);
  });

  it('paystack: charges only the residual when walletAmount < amount', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 300,
        gateway: 'paystack',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(200);
    expect(mockInitializePaystackTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 700 * 100 })
    );
    expect(transactionsInsertCalls[0]).toMatchObject({
      amount: 700,
      currency: 'NGN',
      status: 'pending',
      gateway: 'paystack',
    });
  });

  it('korapay: charges only the residual when walletAmount < amount', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        walletAmount: 250,
        gateway: 'korapay',
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
      })
    );

    expect(response.status).toBe(200);
    expect(mockInitializeKorapayPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 750 })
    );
    expect(transactionsInsertCalls[0]).toMatchObject({
      amount: 750,
      currency: 'NGN',
      gateway: 'korapay',
    });
  });
});
