import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidateMerchantFeed = vi.fn();
const mockResolveFeedMerchant = vi.fn();

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateMerchantFeed: (...args: unknown[]) =>
    mockRevalidateMerchantFeed(...args),
}));

vi.mock('@/lib/feed-identifier', () => ({
  isUuid: (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    ),
  resolveFeedMerchant: (...args: unknown[]) => mockResolveFeedMerchant(...args),
}));

import { POST } from './route';

function makeRequest(body: unknown, authHeader?: string): NextRequest {
  return new NextRequest(
    'http://localhost/api/feed/google-merchant/revalidate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/feed/google-merchant/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    mockResolveFeedMerchant.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
      country: 'NG',
      payout_currency: 'NGN',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // --- Auth tests ---

  it('returns 401 when CRON_SECRET is unset (fail-closed)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer undefined')
    );
    expect(res.status).toBe(401);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header is missing', async () => {
    const res = await POST(makeRequest({ identifier: 'ogabassey' }));
    expect(res.status).toBe(401);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer wrong-secret')
    );
    expect(res.status).toBe(401);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  // --- Validation tests ---

  it('returns 400 when neither merchant_id nor identifier is provided', async () => {
    const res = await POST(makeRequest({}, 'Bearer test-secret'));
    expect(res.status).toBe(400);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 400 when identifier is an empty string', async () => {
    const res = await POST(
      makeRequest({ identifier: '' }, 'Bearer test-secret')
    );
    expect(res.status).toBe(400);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 400 when request body is malformed JSON', async () => {
    const req = new NextRequest(
      'http://localhost/api/feed/google-merchant/revalidate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-secret',
        },
        body: 'not valid json',
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  // --- merchant_id (preferred path) ---

  it('revalidates with merchant_id directly', async () => {
    const merchantId = '22222222-2222-4222-8222-222222222222';
    const res = await POST(
      makeRequest({ merchant_id: merchantId }, 'Bearer test-secret')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ revalidated: true, merchant_id: merchantId });
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledWith(merchantId);
    expect(mockResolveFeedMerchant).not.toHaveBeenCalled();
  });

  it('merchant_id takes precedence when both fields are sent', async () => {
    const merchantId = '33333333-3333-4333-8333-333333333333';
    const res = await POST(
      makeRequest(
        { merchant_id: merchantId, identifier: 'ogabassey' },
        'Bearer test-secret'
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.merchant_id).toBe(merchantId);
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledWith(merchantId);
    expect(mockResolveFeedMerchant).not.toHaveBeenCalled();
  });

  // --- Legacy identifier (UUID) ---

  it('legacy identifier as UUID is used directly without resolution', async () => {
    const uuid = '44444444-4444-4444-8444-444444444444';
    const res = await POST(
      makeRequest({ identifier: uuid }, 'Bearer test-secret')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ revalidated: true, merchant_id: uuid });
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledWith(uuid);
    expect(mockResolveFeedMerchant).not.toHaveBeenCalled();
  });

  // --- Legacy identifier (slug) ---

  it('legacy identifier as slug resolves to merchant UUID', async () => {
    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer test-secret')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      revalidated: true,
      merchant_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(mockResolveFeedMerchant).toHaveBeenCalledWith('ogabassey', true);
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('returns 404 when slug resolution fails', async () => {
    mockResolveFeedMerchant.mockRejectedValue(new Error('Merchant not found'));
    const res = await POST(
      makeRequest({ identifier: 'nonexistent' }, 'Bearer test-secret')
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Merchant not found');
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  // --- Error handling ---

  it('returns 500 when revalidation throws', async () => {
    mockRevalidateMerchantFeed.mockImplementationOnce(() => {
      throw new Error('cache busted poorly');
    });

    const res = await POST(
      makeRequest(
        { merchant_id: '55555555-5555-4555-8555-555555555555' },
        'Bearer test-secret'
      )
    );

    expect(res.status).toBe(500);
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledTimes(1);
  });
});
