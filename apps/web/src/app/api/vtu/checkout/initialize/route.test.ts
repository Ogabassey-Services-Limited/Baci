import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockPreparePendingVtuTransaction = vi.fn();
const mockInitializePaystackTransaction = vi.fn();
const mockInitializeKorapayPayment = vi.fn();
const mockFrom = vi.fn();

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
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
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
});
