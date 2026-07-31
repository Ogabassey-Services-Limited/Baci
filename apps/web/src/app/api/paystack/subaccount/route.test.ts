import { type NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSubaccountRouteMocks,
  makeRequest,
  resetSubaccountRouteMocks,
} from './subaccount-route.test-utils';

const { POST } = await import('./route');

const mocks = getSubaccountRouteMocks();

describe('POST /api/paystack/subaccount: request validation', () => {
  beforeEach(resetSubaccountRouteMocks);

  it('returns 401 when the request is unauthenticated', async () => {
    mocks.authenticateApiRequest.mockResolvedValueOnce({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not authenticated' });
  });

  it('enforces CSRF for cookie-authenticated requests', async () => {
    mocks.checkCsrfProtection.mockResolvedValueOnce({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });
    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Invalid CSRF token' });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('skips CSRF for bearer-authenticated requests', async () => {
    const response = await POST(
      makeRequest(
        {
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        },
        { Authorization: 'Bearer token-123' }
      )
    );
    expect(response.status).toBe(200);
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant context is missing', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValueOnce(null);
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller lacks integrations permission', async () => {
    mocks.hasPermission.mockReturnValueOnce(false);
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const response = await POST(makeRequest('not valid json{{{'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Invalid JSON in request body',
    });
  });

  it('returns 400 when the request payload is invalid', async () => {
    const response = await POST(
      makeRequest({ accountNumber: '123', bankCode: '044' })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid input');
  });

  it('rejects an unscoped payout mutation before merchant lookup', async () => {
    const response = await POST(
      new Request('http://localhost/api/paystack/subaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: '1234567890',
          bankCode: '044',
          businessName: 'Baci Store',
        }),
      }) as unknown as NextRequest
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid input' });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 400 when payout mode is explicitly provided', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        payoutMode: 'weekly',
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Payout mode is no longer supported in the bank details save flow',
    });
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
  });
});
