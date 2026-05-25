import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockResolveCustomerSavingsContext = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/app/api/storefront/customer/savings/shared', () => ({
  resolveCustomerSavingsContext: (...args: unknown[]) =>
    mockResolveCustomerSavingsContext(...args),
}));

import { POST } from './route';

function postRequest(body: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/customer/savings/auto-debit/confirm',
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

describe('/api/storefront/customer/savings/auto-debit/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer' },
      user: { id: 'user-1' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
    mockResolveCustomerSavingsContext.mockResolvedValue({
      customer: { id: 'customer-1' },
      merchant: { id: 'merchant-1' },
      supabase: { rpc: mockRpc },
    });
  });

  it('returns 401 before confirmation lookup when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await POST(
      postRequest({ merchantSlug: 'ogabassey', reference: 'SAV-AUTH-123' })
    );

    expect(response.status).toBe(401);
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-authorization reference', async () => {
    const response = await POST(
      postRequest({ merchantSlug: 'ogabassey', reference: 'WAL-123' })
    );

    expect(response.status).toBe(400);
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed confirmation JSON', async () => {
    const response = await POST(
      new NextRequest(
        'http://localhost:3000/api/storefront/customer/savings/auto-debit/confirm',
        {
          body: '{',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'MALFORMED_JSON',
      error: 'Malformed JSON',
    });
    expect(mockResolveCustomerSavingsContext).not.toHaveBeenCalled();
  });

  it('reports processing until the referenced authorization is fully accounted', async () => {
    mockRpc.mockResolvedValue({
      data: [{ saved_payment_method_id: null, status: 'processing' }],
      error: null,
    });

    const response = await POST(
      postRequest({ merchantSlug: 'ogabassey', reference: 'SAV-AUTH-123' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ reference: 'SAV-AUTH-123', status: 'processing' });
    expect(mockRpc).toHaveBeenCalledWith(
      'confirm_customer_savings_authorization',
      {
        p_customer_id: 'customer-1',
        p_merchant_id: 'merchant-1',
        p_reference: 'SAV-AUTH-123',
      }
    );
  });

  it('returns only the payment method tied to the processed reference', async () => {
    mockRpc.mockResolvedValue({
      data: [{ saved_payment_method_id: 'method-new', status: 'successful' }],
      error: null,
    });

    const response = await POST(
      postRequest({ merchantSlug: 'ogabassey', reference: 'SAV-AUTH-123' })
    );

    await expect(response.json()).resolves.toEqual({
      reference: 'SAV-AUTH-123',
      savedPaymentMethodId: 'method-new',
      status: 'successful',
      success: true,
    });
  });

  it('does not expose unscoped or failed confirmation lookups', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const notFound = await POST(
      postRequest({ merchantSlug: 'ogabassey', reference: 'SAV-AUTH-123' })
    );
    expect(notFound.status).toBe(404);

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });
    const failed = await POST(
      postRequest({ merchantSlug: 'ogabassey', reference: 'SAV-AUTH-123' })
    );
    expect(failed.status).toBe(500);
  });
});
